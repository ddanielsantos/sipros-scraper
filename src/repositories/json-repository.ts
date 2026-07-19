import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProcessoSeletivo, SearchFilters, PaginatedResult } from "../types";
import type { ProcessoRepository } from "../repository";

export class JsonRepository implements ProcessoRepository {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async saveAll(processos: ProcessoSeletivo[]): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const payload = {
      scraped_at: new Date().toISOString(),
      total: processos.length,
      processos,
    };

    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  async findAll(): Promise<ProcessoSeletivo[]> {
    const data = await this.#readFile();
    return data.processos;
  }

  async findById(id: number): Promise<ProcessoSeletivo | null> {
    const all = await this.findAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async search(
    filters: SearchFilters,
  ): Promise<PaginatedResult<ProcessoSeletivo>> {
    const all = await this.findAll();

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.max(filters.page_size ?? 20, 1);

    // Aplica filtros
    let filtered = all;

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

    // Paginação
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

  async #readFile(): Promise<{
    scraped_at: string;
    total: number;
    processos: ProcessoSeletivo[];
  }> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { scraped_at: "", total: 0, processos: [] };
    }
  }
}
