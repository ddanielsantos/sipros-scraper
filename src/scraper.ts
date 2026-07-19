import { chromium, type Page, type Browser } from "playwright";
import type { ProcessoSeletivo, ScrapeResult } from "./types";

const URL = "https://www.sipros.pa.gov.br/selecoes/disponiveis";

export async function scrapeSipros(): Promise<ScrapeResult> {
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page: Page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "pt-BR",
  });

  // Timeout padrão para todos os waitFor* da página
  page.setDefaultTimeout(30_000);

  try {
    // `domcontentloaded` = HTML parseado, sem esperar fonts/analytics/images
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Aguarda os cards de processos seletivos estarem no DOM
    await page.waitForSelector(
      "div.pricing-area div.row > div.col-sm-4.plan.price-one",
      { timeout: 20_000 },
    );

    // Pausa para as animações CSS (wow.js) finalizarem
    await page.waitForTimeout(1000);

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
          const link =
            linkLi?.querySelector("a")?.getAttribute("href") ?? "";

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

    return {
      scraped_at: new Date().toISOString(),
      total: processos.length,
      processos,
    };
  } catch (err) {
    // Tira screenshot para ajudar no debug
    await page
      .screenshot({ path: "error-screenshot.png", fullPage: true })
      .catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}
