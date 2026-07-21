import { chromium, type Page, type Browser } from "playwright";
import { writeFile } from "node:fs/promises";
import type { ProcessoSeletivo, ScrapeResult } from "./types";

const URL = "https://www.sipros.pa.gov.br/selecoes/disponiveis";

/**
 * Verifica rapidamente se o site está acessível antes de abrir o browser.
 * Isso evita timeouts longos e separa problema de rede vs. problema de scraping.
 */
async function checkReachability(url: string): Promise<void> {
  // Alguns servidores/Cloudflare rejeitam HEAD, usamos GET e cancelamos o body
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  const response = await fetch(url, {
    method: "GET",
    signal: controller.signal,
    redirect: "follow",
  });

  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(
      `Site retornou HTTP ${response.status} ${response.statusText}`,
    );
  }

  // Cancela o stream imediatamente — não precisamos do corpo
  const reader = response.body?.getReader();
  if (reader) await reader.cancel();
}

export async function scrapeSipros(): Promise<ScrapeResult> {
  // ── Pre-flight: verifica conectividade antes de abrir o navegador ──
  await checkReachability(URL);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });

    page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "pt-BR",
    });

    // Timeout padrão para todos os waitFor* da página
    page.setDefaultTimeout(60_000);

    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120_000 });

    // Aguarda os cards de processos seletivos estarem no DOM
    await page.waitForSelector(
      "div.pricing-area div.row > div.col-sm-4.plan.price-one",
      { timeout: 30_000 },
    );

    // Pausa para as animações CSS (wow.js) finalizarem
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

          const idLi = items[0];
          if (!idLi) return null;
          const idMatch = idLi.id.match(/processo_seletivo_(\d+)/);
          if (!idMatch) return null;
          const id = parseInt(idMatch[1]!, 10);

          const h1 = idLi.querySelector("h1");
          const orgao = h1?.textContent?.trim() ?? "";

          const span = idLi.querySelector("span");
          const titulo = span?.textContent?.trim() ?? "";

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

          // ── Parse do vencimento ──────────────────────────────
          const vencimentoRaw =
            textItems.find((t) => t.startsWith("Vencimento Base")) ?? "";
          const vencimento_original = stripPrefix(vencimentoRaw);

          const parseReais = (str: string): number | null => {
            // "R$ 1.399,20" → 1399.20
            const cleaned = str
              .replace(/^R\$\s*/i, "")
              .replace(/\./g, "")
              .replace(/,/, ".");
            const n = parseFloat(cleaned);
            return isNaN(n) ? null : n;
          };

          let vencimento_min: number | null = null;
          let vencimento_max: number | null = null;

          if (vencimento_original) {
            // Formato range: "De R$ 1.399,20 a R$ 1.828,20"
            const rangeMatch = vencimento_original.match(
              /(?:De\s*)?R\$\s*([\d.]+,[\d]+)\s*a\s+R\$\s*([\d.]+,[\d]+)/i,
            );
            if (rangeMatch) {
              vencimento_min = parseReais(rangeMatch[1]!);
              vencimento_max = parseReais(rangeMatch[2]!);
            } else {
              // Valor único: "R$ 2.559,37"
              const val = parseReais(vencimento_original);
              vencimento_min = val;
              vencimento_max = val;
            }
          }

          // ── Vagas ────────────────────────────────────────────
          const vagasRaw = textItems.find((t) => t.startsWith("Vagas")) ?? "";
          const vagasMatch = vagasRaw.match(/(\d+)/);
          const vagas = vagasMatch ? parseInt(vagasMatch[1]!, 10) : 0;

          const knownFields = [inscricoesRaw, vencimentoRaw, vagasRaw].filter(
            Boolean,
          );
          const cargos =
            textItems.find((t) => !knownFields.includes(t)) ?? "";

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
            vencimento_min,
            vencimento_max,
            vencimento_original,
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
    // ── Debug artefacts ──────────────────────────────────────────
    if (page) {
      await page
        .screenshot({ path: "error-screenshot.png", fullPage: true })
        .catch(() => {});
      const html = await page
        .content()
        .catch(() => "<erro ao capturar HTML>");
      await writeFile("error-page.html", html, "utf-8").catch(() => {});
    }
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
