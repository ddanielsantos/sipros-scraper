# CRON — SIPROS Scraper

## Na VPS

```cron
*/30 6-22 * * 1-6 cd /home/ubuntu/sipros-scraper && bun run scripts/scrape.ts >> /home/ubuntu/sipros-scraper/logs/scraper.log 2>&1
```

## Instalação via script (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/ddanielsantos/sipros-scraper/main/scripts/setup-vps.sh | bash
```

O script faz tudo: instala dependências, corrige DNS, configura crontab e logrotate.

## Na máquina local

```cron
*/30 6-22 * * 1-6 cd /caminho/sipros-scraper && bun run scripts/scrape.ts >> /caminho/sipros-scraper/logs/scraper.log 2>&1
```

## Logs

```bash
tail -f ~/sipros-scraper/logs/scraper.log
```
