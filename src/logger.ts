type Level = "debug" | "info" | "warn" | "error";

const LEVEL_NUM: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: Level;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export class Logger {
  private minLevel: number;
  private jsonMode: boolean;
  private ctx: Record<string, unknown>;

  constructor(opts: { level?: Level; json?: boolean } = {}) {
    this.minLevel = LEVEL_NUM[opts.level ?? "info"];
    this.jsonMode = opts.json ?? false;
    this.ctx = {};
  }

  child(extra: Record<string, unknown>): Logger {
    const l = new Logger({ level: this.#levelName(), json: this.jsonMode });
    l.ctx = { ...this.ctx, ...extra };
    return l;
  }

  debug(msg: string, extra?: Record<string, unknown>): void {
    this.#log("debug", msg, extra);
  }
  info(msg: string, extra?: Record<string, unknown>): void {
    this.#log("info", msg, extra);
  }
  warn(msg: string, extra?: Record<string, unknown>): void {
    this.#log("warn", msg, extra);
  }
  error(msg: string, extra?: Record<string, unknown>): void {
    this.#log("error", msg, extra);
  }

  #log(level: Level, message: string, extra?: Record<string, unknown>): void {
    if (LEVEL_NUM[level] < this.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.ctx,
      ...extra,
    };

    if (this.jsonMode) {
      // JSON lines — fácil de ingerir por agregadores de log
      if (level === "error") {
        process.stderr.write(JSON.stringify(entry) + "\n");
      } else {
        process.stdout.write(JSON.stringify(entry) + "\n");
      }
    } else {
      const prefix = this.#formatPrefix(level);
      const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
      const line = `${prefix} ${message}${suffix}`;
      if (level === "error") {
        process.stderr.write(line + "\n");
      } else {
        process.stdout.write(line + "\n");
      }
    }
  }

  #formatPrefix(level: Level): string {
    const icon: Record<Level, string> = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
    };
    const ts = new Date().toISOString().slice(11, 23);
    return `${icon[level]} [${ts}] [${level.toUpperCase()}]`;
  }

  #levelName(): Level {
    for (const [k, v] of Object.entries(LEVEL_NUM)) {
      if (v === this.minLevel) return k as Level;
    }
    return "info";
  }
}

/** Logger global padrão */
export const log = new Logger();
