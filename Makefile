.PHONY: scrape scheduler logs cron bootstrap docker-build docker-up docker-logs setup update data help

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Execução local ─────────────────────────────────────────────

scrape: ## Executa scraping único (CLI)
	bun run scripts/scrape.ts

scheduler: ## Executa scheduler contínuo (Ctrl+C para parar)
	bun run scripts/scheduler.ts

logs: ## Mostra últimos logs
	@if [ -f logs/scraper.log ]; then \
		tail -f logs/scraper.log; \
	else \
		echo "Log não encontrado. Execute 'make scrape' primeiro."; \
	fi

cron: ## Mostra crontab atual
	@crontab -l 2>/dev/null || echo "Nenhum crontab configurado."

bootstrap: ## Setup completo — sempre baixa a última versão do GitHub
	curl -fsSL https://raw.githubusercontent.com/ddanielsantos/sipros-scraper/main/scripts/setup-vps.sh | bash

# ── Docker ─────────────────────────────────────────────────────

docker-build: ## Constrói imagem Docker
	docker build -t sipros-scraper .

docker-up: ## Sobe o scheduler em container (detached)
	docker compose up -d

docker-down: ## Derruba o container
	docker compose down

docker-logs: ## Logs do container
	docker compose logs -f

docker-scrape: ## Executa scraping único dentro do container
	docker compose run --rm scraper bun run scripts/scrape.ts

# ── Setup / Manutenção ────────────────────────────────────────

setup: ## Instala dependências + Playwright (primeira vez)
	bun install
	bunx playwright install --with-deps chromium

update: ## Atualiza código + dependências
	git pull
	bun install --frozen-lockfile

data: ## Mostra resumo dos dados salvos
	@jq '{total, scraped_at, orgaos: [.processos[].orgao] | unique | length}' data/sipros.json 2>/dev/null || \
		echo "Nenhum dado ainda. Execute 'make scrape' primeiro."
