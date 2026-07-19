import { chromium, type Page } from "playwright";
import type { ProcessoSeletivo, ScrapeResult } from "./types";

const URL = "https://www.sipros.pa.gov.br/selecoes/disponiveis";

export async function scrapeSipros(): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();

  await page.goto(URL, { waitUntil: "load", timeout: 60000 });

  // Aguarda os cards de processos seletivos estarem visíveis no DOM
  await page.waitForSelector("div.pricing-area div.row > div.col-sm-4.plan.price-one", {
    timeout: 30000,
  });

  // Pequena pausa extra para renderização de CSS/classes wow.js
  await page.waitForTimeout(1500);

  const processos: ProcessoSeletivo[] = await page.evaluate(() => {
    const cards = document.querySelectorAll<HTMLDivElement>(
      "div.pricing-area div.row > div.col-sm-4.plan.price-one",
    );

    return Array.from(cards)
      .map((card): ProcessoSeletivo | null => {
        const ul = card.querySelector("ul");
        if (!ul) return null;

        const items = ul.querySelectorAll<HTMLLIElement>("li");

        // id: "processo_seletivo_550"
        const idLi = items[0];
        if (!idLi) return null;
        const idMatch = idLi.id.match(/processo_seletivo_(\d+)/);
        if (!idMatch) return null;
        const id = parseInt(idMatch[1]!, 10);

        // Órgão (h1 dentro do primeiro li)
        const h1 = idLi.querySelector("h1");
        const orgao = h1?.textContent?.trim() ?? "";

        // Título (span dentro do primeiro li)
        const span = idLi.querySelector("span");
        const titulo = span?.textContent?.trim() ?? "";

        // Lista de textos ignorando o li do link e o li de ação
        const textItems: string[] = [];
        for (let i = 1; i < items.length; i++) {
          const li = items[i];
          if (!li) continue;
          if (li.querySelector("a")) continue;
          if (li.classList.contains("plan-action")) continue;
          const text = li.textContent?.trim() ?? "";
          if (text) textItems.push(text);
        }

        const stripPrefix = (text: string): string =>
          text.replace(/^[^:]+:\s*/, "");

        const inscricoesRaw =
          textItems.find((t) => t.startsWith("Inscrições")) ?? "";
        const inscricoes = stripPrefix(inscricoesRaw);

        const vencimentoRaw =
          textItems.find((t) => t.startsWith("Vencimento Base")) ?? "";
        const vencimento_base = stripPrefix(vencimentoRaw);

        const vagasRaw = textItems.find((t) => t.startsWith("Vagas")) ?? "";
        const vagasMatch = vagasRaw.match(/(\d+)/);
        const vagas = vagasMatch ? parseInt(vagasMatch[1]!, 10) : 0;

        // Cargos é o que sobra depois de remover os campos conhecidos
        const knownFields = [inscricoesRaw, vencimentoRaw, vagasRaw].filter(
          Boolean,
        );
        const cargos =
          textItems.find((t) => !knownFields.includes(t)) ?? "";

        // Link de detalhes
        const linkLi = Array.from(items).find((li) =>
          li.querySelector('a[href*="/selecoes/"]'),
        );
        const link = linkLi?.querySelector("a")?.getAttribute("href") ?? "";

        return {
          id,
          orgao,
          titulo,
          inscricoes,
          vencimento_base,
          cargos,
          vagas,
          link,
        };
      })
      .filter((p): p is ProcessoSeletivo => p !== null);
  });

  await browser.close();

  return {
    scraped_at: new Date().toISOString(),
    total: processos.length,
    processos,
  };
}
