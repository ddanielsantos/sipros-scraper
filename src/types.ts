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

/** Processo persistido no repositório (com campos de controle) */
export interface ProcessoPersistido extends ProcessoSeletivo {
  /** Continua disponível no site? */
  ativo: boolean;
  /** Quando foi visto pela primeira vez */
  primeira_vez_visto: string;
  /** Quando foi visto pela última vez */
  ultima_vez_visto: string;
}

/** Resultado completo de uma execução de scraping */
export interface ScrapeResult {
  scraped_at: string;
  total: number;
  processos: ProcessoSeletivo[];
}

/** Estrutura do arquivo JSON persistido */
export interface JsonFileContent {
  ultima_atualizacao: string;
  total_historicos: number;
  total_ativos: number;
  processos: ProcessoPersistido[];
}

// ─── Filtros e paginação (preparado para a futura API) ──────────────

export interface SearchFilters {
  apenas_ativos?: boolean;
  orgao?: string;
  cargo?: string;
  vagas_min?: number;
  vagas_max?: number;
  inscricao_ate?: string;
  termo?: string;
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
