#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────
# SIPROS Scraper — setup automatizado para VPS (Ubuntu 22.04+)
# ────────────────────────────────────────────────────────────────
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/seu-user/sipros-scraper/main/scripts/setup-vps.sh | bash
#   ou
#   bash scripts/setup-vps.sh
# ────────────────────────────────────────────────────────────────

REPO_URL="${REPO_URL:-https://github.com/seu-user/sipros-scraper.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/sipros-scraper}"
SCRAPE_INTERVAL="${SCRAPE_INTERVAL:-30}"  # minutos

# Cores para output
VERDE='\033[0;32m'
AMARELO='\033[1;33m'
AZUL='\033[0;34m'
RESET='\033[0m'

info()  { echo -e "${AZUL}[INFO]${RESET}  $1"; }
ok()    { echo -e "${VERDE}[OK]${RESET}    $1"; }
aviso() { echo -e "${AMARELO}[AVISO]${RESET} $1"; }

# ── 1. Atualiza sistema ──────────────────────────────────────────
info "Atualizando pacotes do sistema..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq
ok "Sistema atualizado."

# ── 2. Configura swap (1GB RAM pode ser pouco para Chromium) ─────
if [ "$(free -m | awk '/^Swap:/{print $2}')" -lt 512 ]; then
  info "Configurando 1GB de swap..."
  sudo fallocate -l 1G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
  # Prioridade baixa para evitar swap desnecessário
  echo 10 | sudo tee /proc/sys/vm/swappiness > /dev/null
  ok "Swap de 1GB configurado."
else
  ok "Swap já configurado ($(free -m | awk '/^Swap:/{print $2}')MB)."
fi

# ── 3. Instala dependências ─────────────────────────────────────
info "Instalando dependências (curl, git, unzip)..."
sudo apt-get install -y -qq curl git unzip
ok "Dependências instaladas."

# ── 4. Instala Bun ──────────────────────────────────────────────
if ! command -v bun &>/dev/null; then
  info "Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  # shellcheck disable=SC2016
  echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
  # shellcheck disable=SC2016
  echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "Bun $(bun --version) instalado."
else
  ok "Bun $(bun --version) já instalado."
fi

# ── 4. Clona / atualiza repositório ─────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  info "Atualizando repositório existente em $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git pull
  ok "Repositório atualizado."
else
  info "Clonando repositório em $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "Repositório clonado."
fi

cd "$INSTALL_DIR"

# ── 5. Instala dependências do projeto ──────────────────────────
info "Instalando dependências do projeto..."
bun install --frozen-lockfile
ok "Dependências instaladas."

# ── 6. Instala Playwright + Chromium + libs ─────────────────────
info "Instalando Chromium e dependências de sistema..."
bunx playwright install --with-deps chromium
ok "Chromium pronto."

# ── 7. Cria arquivo .env ────────────────────────────────────────
if [ ! -f .env ]; then
  info "Criando .env com valores padrão..."
  cat > .env <<-EOF
DATA_FILE=./data/sipros.json
LOG_LEVEL=info
LOG_JSON=false
HEADLESS=true
SCRAPE_TIMEOUT_MS=120000
SCRAPE_INTERVAL_MINUTES=$SCRAPE_INTERVAL
EOF
  ok ".env criado."
else
  ok ".env já existe."
fi

# ── 8. Cria diretório de dados ──────────────────────────────────
mkdir -p data

# ── 9. Testa execução ───────────────────────────────────────────
info "Testando scraping (primeira execução)..."
if bun run scripts/scrape.ts; then
  ok "Scraping funcionou! $(jq '.total' data/sipros.json 2>/dev/null || echo '?') processos extraídos."
else
  aviso "Scraping falhou no teste. Verifique manualmente com: cd $INSTALL_DIR && bun run scripts/scrape.ts"
fi

# ── 10. Agenda crontab ──────────────────────────────────────────
CRON_EXPR="*/${SCRAPE_INTERVAL} 6-22 * * 1-6"
CRON_JOB="${CRON_EXPR} cd ${INSTALL_DIR} && bun run scripts/scrape.ts >> /var/log/sipros-scraper.log 2>&1"

if crontab -l 2>/dev/null | grep -q "$INSTALL_DIR"; then
  ok "Crontab já configurado para $INSTALL_DIR."
else
  info "Adicionando ao crontab:"
  echo "  $CRON_JOB"
  (
    crontab -l 2>/dev/null || true
    echo "$CRON_JOB"
  ) | crontab -
  ok "Crontab configurado! O scraping rodará a cada $SCRAPE_INTERVAL minutos (seg-sex, 6h-22h)."
fi

# ── 11. Configura rotação de logs ───────────────────────────────
if command -v logrotate &>/dev/null; then
  LOGROTATE_CONF="/etc/logrotate.d/sipros-scraper"
  if [ ! -f "$LOGROTATE_CONF" ]; then
    info "Configurando logrotate..."
    sudo tee "$LOGROTATE_CONF" > /dev/null <<-EOF
/var/log/sipros-scraper.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    copytruncate
}
EOF
    ok "Logrotate configurado (30 dias de retenção)."
  fi
fi

# ── 12. Resumo final ────────────────────────────────────────────
echo ""
echo -e "${VERDE}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${VERDE}║              SIPROS Scraper — Setup Concluído!         ║${RESET}"
echo -e "${VERDE}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "  📁  Diretório:   $INSTALL_DIR"
echo "  📊  Dados:       $INSTALL_DIR/data/sipros.json"
echo "  ⏰  Cron:        $CRON_EXPR (seg-sex, 6h-22h)"
echo "  📝  Log:         /var/log/sipros-scraper.log"
echo ""
echo "  Comandos úteis:"
echo "    cd $INSTALL_DIR"
echo "    bun run scripts/scrape.ts        # execução manual"
echo "    bun run scripts/scheduler.ts     # scheduler contínuo"
echo "    crontab -l                        # ver cron"
echo "    tail -f /var/log/sipros-scraper.log  # acompanhar logs"
echo "    git pull                          # atualizar código"
echo ""
