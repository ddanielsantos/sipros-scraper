import type { ProcessoSeletivo, SearchFilters, PaginatedResult } from "./types";

/**
 * Contract for persisting and querying processos seletivos.
 *
 * Implementations can target JSON files, SQL databases, in-memory stores,
 * or any other backend — the scraper and API never need to know which.
 */
export interface ProcessoRepository {
  /** Substitui todo o dataset por um novo lote (upsert pelo id). */
  saveAll(processos: ProcessoSeletivo[]): Promise<void>;

  /** Retorna todos os processos salvos. */
  findAll(): Promise<ProcessoSeletivo[]>;

  /** Busca um processo pelo ID numérico. */
  findById(id: number): Promise<ProcessoSeletivo | null>;

  /** Busca paginada com filtros combinados. */
  search(filters: SearchFilters): Promise<PaginatedResult<ProcessoSeletivo>>;
}
