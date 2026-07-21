import type {
  ProcessoSeletivo,
  ProcessoPersistido,
  SearchFilters,
  PaginatedResult,
} from "./types";

/**
 * Contract for persisting and querying processos seletivos.
 *
 * Implementations can target JSON files, SQL databases, in-memory stores,
 * or any other backend — the scraper and API never need to know which.
 */
export interface ProcessoRepository {
  /** Faz merge dos processos scraping com os já salvos (upsert + marcar inativos). */
  saveAll(processos: ProcessoSeletivo[]): Promise<void>;

  /** Retorna todos os processos salvos (ativos e inativos). */
  findAll(): Promise<ProcessoPersistido[]>;

  /** Busca um processo pelo ID numérico. */
  findById(id: number): Promise<ProcessoPersistido | null>;

  /** Busca paginada com filtros combinados. */
  search(filters: SearchFilters): Promise<PaginatedResult<ProcessoPersistido>>;
}
