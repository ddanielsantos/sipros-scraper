/**
 * Serviço schedulado — mantém o scraper rodando em loop com intervalo configurável.
 *
 * Ideal para ambientes containerizados (Docker, K8s, etc.).
 * Responde a SIGTERM/SIGINT para desligamento gracioso.
 *
 * Uso:
 *   bun run scripts/scheduler.ts
 *
 * Variáveis de ambiente:
 *   SCRAPE_INTERVAL_MINUTES=30
 *   DATA_FILE=./data/sipros.json
 *   LOG_LEVEL=info
 */
import { loadConfig } from "../src/config";
import { Logger } from "../src/logger";
import { runScrapeCycle } from "../src/runner";
import { JsonRepository } from "../src/repositories/json-repository";

async function main() {
  const config = loadConfig();
  const log = new Logger({ level: config.logLevel, json: config.logJson });
  const repo = new JsonRepository(config.dataFile);

  const intervalMs = config.scrapeIntervalMinutes * 60 * 1000;

  log.info("Scheduler iniciado", {
    intervalMinutes: config.scrapeIntervalMinutes,
    dataFile: config.dataFile,
  });

  // ── Handler de desligamento gracioso ──────────────────────────
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Sinal ${signal} recebido. Desligando após ciclo atual...`);
    // O loop atual termina naturalmente; o próximo setInterval não dispara.
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Loop principal ────────────────────────────────────────────
  const tick = async () => {
    if (shuttingDown) {
      log.info("Desligamento concluído.");
      process.exit(0);
      return;
    }

    await runScrapeCycle(repo, config, log);
  };

  // Executa imediatamente na inicialização, depois entra no intervalo
  await tick();
  setInterval(tick, intervalMs);
}

main().catch((err) => {
  console.error("Falha fatal no scheduler:", err);
  process.exit(1);
});
