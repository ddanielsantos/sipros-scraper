/** Configuração centralizada via environment variables com defaults sensíveis. */
export interface Config {
  /** URL da página de processos disponíveis */
  scrapeUrl: string;
  /** Rodar com navegador visível? (útil para debug) */
  headless: boolean;

  /** Tipo de repositório: "json" ou futuramente "sql" */
  repositoryType: "json";
  /** Diretório onde os dados são persistidos */
  dataDir: string;
  /** Arquivo JSON (usado apenas quando repositoryType = "json") */
  dataFile: string;

  /** Intervalo em minutos entre execuções do scheduler */
  scrapeIntervalMinutes: number;
  /** Timeout máximo para uma execução de scraping (ms) */
  scrapeTimeoutMs: number;

  /** Nível de log */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Saída em JSON lines (para agregadores como Datadog, CloudWatch, etc.) */
  logJson: boolean;
}

export function loadConfig(): Config {
  return {
    scrapeUrl: env("SCRAPE_URL", "https://www.sipros.pa.gov.br/selecoes/disponiveis"),
    headless: env("HEADLESS", "true") !== "false",

    repositoryType: "json",
    dataDir: env("DATA_DIR", "data"),
    dataFile: env("DATA_FILE", "data/sipros.json"),

    scrapeIntervalMinutes: Number(env("SCRAPE_INTERVAL_MINUTES", "30")),
    scrapeTimeoutMs: Number(env("SCRAPE_TIMEOUT_MS", "60000")),

    logLevel: (env("LOG_LEVEL", "info") as Config["logLevel"]),
    logJson: env("LOG_JSON", "false") === "true",
  };
}

function env(key: string, fallback: string): string {
  return (process.env[key] as string | undefined) ?? fallback;
}
