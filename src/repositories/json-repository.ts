import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type {
  ProcessoSeletivo,
  ProcessoPersistido,
  SearchFilters,
  PaginatedResult,
  JsonFileContent,
} from "../types";
import type { ProcessoRepository } from "../repository";

export class JsonRepository implements ProcessoRepository {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Faz merge dos processos scraping com o histórico salvo:
   * - Processos que ainda estão no site → atualiza dados + marca ativo
   * - Processos novos → adiciona
   * - Processos que sumiram do site → mantém, mas marca como inativo
   */
  async saveAll(processos: ProcessoSeletivo[]): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const agora = new Date().toISOString();
    const existentes = await this.#readFile();
    const mapExistentes = new Map<number, ProcessoPersistido>();
    for (const p of existentes.processos) {
      mapExistentes.set(p.id, p);
    }

    const idsNovos = new Set<number>();

    // Atualiza ou insere cada processo vindo do site
    for (const p of processos) {
      idsNovos.add(p.id);
      const existente = mapExistentes.get(p.id);
      if (existente) {
        // Atualiza dados e reativa (caso estivesse inativo)
        existente.orgao = p.orgao;
        existente.titulo = p.titulo;
        existente.inscricoes = p.inscricoes;
        existente.vencimento_base = p.vencimento_base;
        existente.cargos = p.cargos;
        existente.vagas = p.vagas;
        existente.link = p.link;
        existente.ativo = true;
        existente.ultima_vez_visto = agora;
      } else {
        // Novo processo
        mapExistentes.set(p.id, {
          ...p,
          ativo: true,
          primeira_vez_visto: agora,
          ultima_vez_visto: agora,
        });
      }
    }

    // Marca como inativos os que estavam salvos mas não apareceram agora
    for (const p of mapExistentes.values()) {
      if (!idsNovos.has(p.id)) {
        p.ativo = false;
      }
    }

    const todos = Array.from(mapExistentes.values());
    // Ordena: ativos primeiro, depois por id decrescente
    todos.sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.id - a.id);

    const payload: JsonFileContent = {
      ultima_atualizacao: agora,
      total_historicos: todos.length,
      total_ativos: todos.filter((p) => p.ativo).length,
      processos: todos,
    };

    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  async findAll(): Promise<ProcessoPersistido[]> {
    const data = await this.#readFile();
    return data.processos;
  }

  async findById(id: number): Promise<ProcessoPersistido | null> {
    const all = await this.findAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async search(
    filters: SearchFilters,
  ): Promise<PaginatedResult<ProcessoPersistido>> {
    const all = await this.findAll();

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.max(filters.page_size ?? 20, 1);

    let filtered = all;

    if (filters.apenas_ativos !== false) {
      filtered = filtered.filter((p) => p.ativo);
    }

    if (filters.orgao) {
      const q = filters.orgao.toLowerCase();
      filtered = filtered.filter((p) => p.orgao.toLowerCase().includes(q));
    }

    if (filters.cargo) {
      const q = filters.cargo.toLowerCase();
      filtered = filtered.filter((p) => p.cargos.toLowerCase().includes(q));
    }

    if (filters.vagas_min !== undefined) {
      filtered = filtered.filter((p) => p.vagas >= filters.vagas_min!);
    }

    if (filters.vagas_max !== undefined) {
      filtered = filtered.filter((p) => p.vagas <= filters.vagas_max!);
    }

    if (filters.inscricao_ate) {
      filtered = filtered.filter((p) =>
        p.inscricoes.includes(filters.inscricao_ate!),
      );
    }

    if (filters.termo) {
      const q = filters.termo.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.orgao.toLowerCase().includes(q) ||
          p.titulo.toLowerCase().includes(q) ||
          p.cargos.toLowerCase().includes(q),
      );
    }

    const total = filtered.length;
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  async #readFile(): Promise<JsonFileContent> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {
        ultima_atualizacao: "",
        total_historicos: 0,
        total_ativos: 0,
        processos: [],
      };
    }
  }
}
