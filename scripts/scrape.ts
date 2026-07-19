/**
 * Script CLI para execução única de scraping.
 * Exit code 0 = sucesso, 1 = falha (compatível com cron).
 *
 * Uso:
 *   bun run scripts/scrape.ts
 *
 * Variáveis de ambiente (opcionais):
 *   DATA_FILE=./data/sipros.json
 *   LOG_LEVEL=info
 *   LOG_JSON=false
 *   HEADLESS=true
 *   SCRAPE_TIMEOUT_MS=60000
 */
import { loadConfig } from "../src/config";
import { Logger } from "../src/logger";
import { runScrapeCycle } from "../src/runner";
import { JsonRepository } from "../src/repositories/json-repository";

async function main() {
  const config = loadConfig();
  const log = new Logger({ level: config.logLevel, json: config.logJson });

  const repo = new JsonRepository(config.dataFile);

  const result = await runScrapeCycle(repo, config, log);

  process.exit(result.success ? 0 : 1);
}

main();
