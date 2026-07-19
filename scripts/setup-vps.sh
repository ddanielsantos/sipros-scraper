#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────
# SIPROS Scraper — setup automatizado para VPS (Ubuntu 22.04+)
# ────────────────────────────────────────────────────────────────
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/ddanielsantos/sipros-scraper/main/scripts/setup-vps.sh | bash
# ────────────────────────────────────────────────────────────────

REPO_URL="${REPO_URL:-https://github.com/ddanielsantos/sipros-scraper.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/sipros-scraper}"
SCRAPE_INTERVAL="${SCRAPE_INTERVAL:-30}"  # minutos
LOG_FILE="$INSTALL_DIR/logs/scraper.log"

# Cores
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
  echo 10 | sudo tee /proc/sys/vm/swappiness > /dev/null
  ok "Swap de 1GB configurado."
else
  ok "Swap já configurado ($(free -m | awk '/^Swap:/{print $2}')MB)."
fi

# ── 3. Instala dependências de sistema ───────────────────────────
info "Instalando dependências (curl, git, unzip, jq)..."
sudo apt-get install -y -qq curl git unzip jq
ok "Dependências instaladas."

# ── 4. Corrige DNS (sipros.pa.gov.br tem DNSSEC mal configurado) ─
info "Corrigindo DNS para evitar erro de DNSSEC do sipros.pa.gov.br..."
sudo sed -i 's/#DNS=/DNS=1.1.1.1 1.0.0.1/' /etc/systemd/resolved.conf 2>/dev/null || true
sudo sed -i 's/#FallbackDNS=/FallbackDNS=1.1.1.1 1.0.0.1/' /etc/systemd/resolved.conf 2>/dev/null || true
sudo sed -i 's/#DNSSEC=no/DNSSEC=no/' /etc/systemd/resolved.conf 2>/dev/null || true
sudo systemctl restart systemd-resolved 2>/dev/null || true
ok "DNS configurado (Cloudflare 1.1.1.1, DNSSEC desligado)."

# ── 5. Instala Bun ──────────────────────────────────────────────
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

# ── 6. Clona / atualiza repositório ─────────────────────────────
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

# ── 7. Instala dependências do projeto ──────────────────────────
info "Instalando dependências do projeto..."
bun install --frozen-lockfile
ok "Dependências instaladas."

# ── 8. Instala Playwright + Chromium + libs ─────────────────────
info "Instalando Chromium e dependências de sistema..."
bunx playwright install --with-deps chromium
ok "Chromium pronto."

# ── 9. Cria diretórios ───────────────────────────────────────────
mkdir -p data logs

# ── 10. Cria arquivo .env ────────────────────────────────────────
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

# ── 11. Testa execução ───────────────────────────────────────────
info "Testando scraping (primeira execução)..."
if bun run scripts/scrape.ts; then
  TOTAL=$(jq '.total' data/sipros.json 2>/dev/null || echo "?")
  ok "Scraping funcionou! $TOTAL processos extraídos."
else
  aviso "Scraping falhou no teste. Verifique manualmente com: cd $INSTALL_DIR && bun run scripts/scrape.ts"
fi

# ── 12. Agenda crontab ──────────────────────────────────────────
CRON_EXPR="*/${SCRAPE_INTERVAL} 6-22 * * 1-6"
CRON_JOB="${CRON_EXPR} cd ${INSTALL_DIR} && bun run scripts/scrape.ts >> ${LOG_FILE} 2>&1"

if crontab -l 2>/dev/null | grep -q "$INSTALL_DIR"; then
  ok "Crontab já configurado para $INSTALL_DIR."
else
  info "Adicionando ao crontab..."
  echo "  $CRON_JOB"
  (
    crontab -l 2>/dev/null || true
    echo "$CRON_JOB"
  ) | crontab -
  ok "Crontab configurado! O scraping rodará a cada $SCRAPE_INTERVAL minutos (seg-sex, 6h-22h)."
fi

# ── 13. Resumo final ────────────────────────────────────────────
echo ""
echo -e "${VERDE}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${VERDE}║              SIPROS Scraper — Setup Concluído!         ║${RESET}"
echo -e "${VERDE}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "  📁  Diretório:   $INSTALL_DIR"
echo "  📊  Dados:       $INSTALL_DIR/data/sipros.json"
echo "  ⏰  Cron:        $CRON_EXPR (seg-sex, 6h-22h)"
echo "  📝  Log:         $LOG_FILE"
echo ""
echo "  Comandos úteis:"
echo "    cd $INSTALL_DIR"
echo "    make scrape                 # execução manual"
echo "    make logs                   # acompanhar logs"
echo "    make data                   # resumo dos dados"
echo "    make cron                   # ver crontab"
echo "    git pull                    # atualizar código"
echo ""
