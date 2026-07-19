# ── Build ─────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ── Runtime ───────────────────────────────────────────────
FROM oven/bun:1-slim

WORKDIR /app

# Playwright precisa do Chromium e suas dependências
RUN apt-get update -qq \
 && apt-get install -y -qq \
      chromium \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
      libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 \
 && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium

# Copia apenas o necessário do build
COPY --from=builder /app /app
COPY . .

RUN mkdir -p data

# ── Uso ───────────────────────────────────────────────────
# Scheduler (loop contínuo):
#   docker run --rm -v ./data:/app/data sipros-scraper scheduler
#
# Scrape único (para cron externo):
#   docker run --rm -v ./data:/app/data sipros-scraper scrape

ENTRYPOINT ["bun", "run", "scripts/scheduler.ts"]
