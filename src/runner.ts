import { scrapeSipros } from "./scraper";
import type { ProcessoRepository } from "./repository";
import type { Config } from "./config";
import { Logger } from "./logger";

export interface ScrapeCycleResult {
  success: boolean;
  totalProcessos: number;
  durationMs: number;
  attempt: number;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 10_000; // 10s

/**
 * Executa um ciclo completo: verificação de rede → scraping → persistência.
 * Inclui retry automático com backoff exponencial para tolerar
 * instabilidades de rede (comuns em ambientes CI).
 */
export async function runScrapeCycle(
  repo: ProcessoRepository,
  config: Config,
  log: Logger,
): Promise<ScrapeCycleResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();

    try {
      log.info(`Iniciando ciclo de scraping (tentativa ${attempt}/${MAX_ATTEMPTS})`, {
        url: config.scrapeUrl,
      });

      const result = await scrapeSipros();

      await repo.saveAll(result.processos);

      const durationMs = Date.now() - start;

      log.info("Ciclo concluído com sucesso", {
        total: result.total,
        durationMs,
        attempt,
      });

      return { success: true, totalProcessos: result.total, durationMs, attempt };
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      lastError = msg;

      log.error("Ciclo de scraping falhou", {
        error: msg,
        stack,
        durationMs,
        attempt,
      });

      // Se ainda há tentativas, espera com backoff antes de retentar
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        log.info(`Aguardando ${delay}ms antes da próxima tentativa...`, {
          nextAttempt: attempt + 1,
          delayMs: delay,
        });
        await sleep(delay);
      }
    }
  }

  // Todas as tentativas esgotadas
  return {
    success: false,
    totalProcessos: 0,
    durationMs: 0,
    attempt: MAX_ATTEMPTS,
    error: lastError,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
