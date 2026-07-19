# ─────────────────────────────────────────────────────────
# CRON — SIPROS Scraper
# ─────────────────────────────────────────────────────────
#
# Instale no crontab do usuário:
#   crontab -e
# E adicione uma das linhas abaixo.
#
# Caminho do projeto (ajuste conforme seu ambiente):
PATH_PROJECT=/home/user/sipros-scraper

# ── Opção 1: A cada 30 minutos durante horário comercial ──
# Roda das 6h às 22h, a cada 30 min, de segunda a sábado.
*/30 6-22 * * 1-6 cd $PATH_PROJECT && bun run scripts/scrape.ts >> /var/log/sipros-scraper.log 2>&1

# ── Opção 2: A cada 2 horas, todo dia ──
# 0 */2 * * * cd $PATH_PROJECT && bun run scripts/scrape.ts >> /var/log/sipros-scraper.log 2>&1

# ── Opção 3: Uma vez por dia, às 8h ──
# 0 8 * * * cd $PATH_PROJECT && bun run scripts/scrape.ts >> /var/log/sipros-scraper.log 2>&1
