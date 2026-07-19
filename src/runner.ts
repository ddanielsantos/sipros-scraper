import { scrapeSipros } from "./scraper";
import type { ProcessoRepository } from "./repository";
import type { Config } from "./config";
import { Logger } from "./logger";

export interface ScrapeCycleResult {
  success: boolean;
  totalProcessos: number;
  durationMs: number;
  error?: string;
}

/**
 * Executa um ciclo completo: scraping → persistência.
 * Pode ser chamado tanto pelo cron quanto pelo scheduler.
 */
export async function runScrapeCycle(
  repo: ProcessoRepository,
  config: Config,
  log: Logger,
): Promise<ScrapeCycleResult> {
  const start = Date.now();

  try {
    log.info("Iniciando ciclo de scraping", { url: config.scrapeUrl });

    const result = await scrapeSipros();

    await repo.saveAll(result.processos);

    const durationMs = Date.now() - start;

    log.info("Ciclo concluído com sucesso", {
      total: result.total,
      durationMs,
    });

    return { success: true, totalProcessos: result.total, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);

    const stack = err instanceof Error ? err.stack : undefined;

    log.error("Ciclo de scraping falhou", {
      error: msg,
      stack,
      durationMs,
    });

    return { success: false, totalProcessos: 0, durationMs, error: msg + (stack ? `\n${stack}` : "") };
  }
}
