/**
 * Ponto de entrada principal — demo do scraper + consultas.
 *
 * Para uso em produção (cron), prefira:
 *   bun run scripts/scrape.ts
 *
 * Para scheduler contínuo (Docker):
 *   bun run scripts/scheduler.ts
 */
import { loadConfig } from "./src/config";
import { Logger } from "./src/logger";
import { runScrapeCycle } from "./src/runner";
import { JsonRepository } from "./src/repositories/json-repository";

async function main() {
  const config = loadConfig();
  const log = new Logger({ level: config.logLevel, json: config.logJson });
  const repo = new JsonRepository(config.dataFile);

  // 1. Scrape + persist
  const result = await runScrapeCycle(repo, config, log);

  if (!result.success) {
    log.error("Scraping falhou — abortando demonstração");
    process.exit(1);
  }

  // 2. Demonstração das queries do repositório
  log.info("=== Demonstração de queries ===");

  const todos = await repo.findAll();
  const ativos = todos.filter((p) => p.ativo);
  const inativos = todos.filter((p) => !p.ativo);
  log.info(`Repositório`, {
    total: todos.length,
    ativos: ativos.length,
    inativos: inativos.length,
  });

  if (ativos.length > 0) {
    const primeiro = ativos[0]!;
    log.info(`Busca por ID`, { id: primeiro.id, orgao: primeiro.orgao });
  }

  const paginado = await repo.search({ page: 1, page_size: 5 });
  log.info(`Paginação`, {
    page: paginado.page,
    totalPages: paginado.total_pages,
    total: paginado.total,
  });

  const sespa = await repo.search({ orgao: "SESPA" });
  log.info(`Filtro por órgão`, { orgao: "SESPA", total: sespa.total });

  const adm = await repo.search({ termo: "ASSISTENTE ADMINISTRATIVO" });
  log.info(`Filtro por termo`, { termo: "ASSISTENTE ADMINISTRATIVO", total: adm.total });

  log.info("Demonstração concluída");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
