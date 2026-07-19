/** Dados brutos de um processo seletivo extraído do SIPROS */
export interface ProcessoSeletivo {
  id: number;
  orgao: string;
  titulo: string;
  inscricoes: string;
  vencimento_base: string;
  cargos: string;
  vagas: number;
  link: string;
}

/** Resultado completo de uma execução de scraping */
export interface ScrapeResult {
  scraped_at: string;
  total: number;
  processos: ProcessoSeletivo[];
}

// ─── Filtros e paginação (preparado para a futura API) ──────────────

export interface SearchFilters {
  orgao?: string;
  cargo?: string;
  vagas_min?: number;
  vagas_max?: number;
  inscricao_ate?: string;          // data limite no formato "dd de Mês de aaaa"
  vencimento_min?: number;
  vencimento_max?: number;
  termo?: string;                  // busca geral no título ou órgão
  page?: number;
  page_size?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
