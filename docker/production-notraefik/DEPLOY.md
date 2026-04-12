# MindCalm - Deploy sulla VM Ubuntu (senza Traefik)

Stack applicativo sulla VM Proxmox/Ubuntu (192.168.0.123), porta 3003.
Il reverse proxy e SSL sono gestiti dal Traefik Gateway sul NAS Synology.

```
Internet
  |
Router (port forward 80->NAS:8880, 443->NAS:8443)
  |
NAS Synology (traefik-gateway)
  |
  mindcalm.datagestio.com --> 192.168.0.123:3003
  |
VM Ubuntu (/opt/mindcalm)
  |
  mindcalm_notraefik_api (:3003 -> :3000 interno)
  mindcalm_notraefik_postgres (solo rete interna)
```

---

## Prerequisiti

```bash
# Docker e Docker Compose v2 devono essere installati
docker --version
docker compose version
```

---

## 1. Clonare il repository

```bash
cd /opt
sudo git clone https://github.com/cavajere/mindcalm.git mindcalm
sudo chown -R enrico:enrico mindcalm
```

## 2. Configurare l'environment

```bash
cd /opt/mindcalm/docker/production-notraefik
cp .env.example .env
```

Per un **deploy demo** il `.env.example` contiene gia' valori funzionanti, basta copiarlo.

Per **produzione reale**, modifica i valori sensibili:

```bash
nano .env
```

| Variabile | Come generare |
|---|---|
| `POSTGRES_PASSWORD` | Password sicura a scelta |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | Password sicura a scelta |

## 3. Creare le directory dati

```bash
mkdir -p ./data/postgres ./data/audio ./data/hls ./data/images
```

## 4. Build e primo avvio

```bash
docker compose up -d --build
```

L'entrypoint del container API esegue automaticamente:
- `prisma migrate deploy` (migrazioni database)
- Setup permessi directory storage (`/data/audio`, `/data/hls`, `/data/images`)

## 5. Verifica

```bash
# Stato container
docker compose ps

# Log API (ctrl+c per uscire)
docker compose logs -f api

# Health check dalla VM
curl http://localhost:3003/api/health

# Health check dal NAS
curl http://192.168.0.123:3003/api/health

# Health check da Internet (dopo configurazione DNS)
curl -I https://mindcalm.datagestio.com
```

## 6. DNS

Il Traefik Gateway ha gia' la rotta configurata in `traefik-dynamic.yml`:

```yaml
mindcalm:
  rule: "Host(`mindcalm.datagestio.com`)"
  service: mindcalm  # -> http://192.168.0.123:3003
```

Serve un record DNS A su Cloudflare:

```
mindcalm.datagestio.com -> IP pubblico del router
```

Se esiste gia' un wildcard `*.datagestio.com`, non serve fare nulla.

---

## Aggiornamento

```bash
cd /opt/mindcalm
git pull origin main
cd docker/production-notraefik
docker compose build --pull
docker compose up -d
```

Le migrazioni Prisma vengono applicate automaticamente dall'entrypoint ad ogni avvio.

---

## Comandi utili

```bash
# Log in tempo reale
docker compose logs -f

# Riavvio API (senza rebuild)
docker compose restart api

# Rebuild completo (dopo modifiche al Dockerfile)
docker compose build --no-cache && docker compose up -d

# Shell nel container API
docker compose exec api sh

# Accesso diretto al database
docker compose exec postgres psql -U mindcalm_demo -d mindcalm_demo

# Backup database
docker compose exec postgres pg_dump -U mindcalm_demo mindcalm_demo > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U mindcalm_demo -d mindcalm_demo < backup.sql
```

---

## Troubleshooting

### Il container API non parte

```bash
docker compose logs api
```

Cause comuni:
- PostgreSQL non ancora pronto (il healthcheck risolve, ma al primo avvio puo' servire piu' tempo)
- Variabili mancanti nel `.env`
- Porta 3003 gia' occupata (`ss -tlnp | grep 3003`)

### Errore 502 dal browser

Il Traefik Gateway non riesce a raggiungere il backend:
1. Container non running: `docker compose ps`
2. Firewall sulla VM blocca la porta: `sudo ufw status`
3. IP della VM cambiato: aggiornare `traefik-dynamic.yml` sul NAS

### Permessi storage

Se l'upload di audio/immagini fallisce:

```bash
chmod -R 777 ./data/audio ./data/hls ./data/images
```

---

## Mappa porte (tutti i servizi sulla VM)

| Servizio | Porta Host | Porta Container | Dominio |
|---|---|---|---|
| Datagestio API | 3000 | 3000 | datagestio.com |
| Localo API | 3001 | 3000 | localo.it |
| AlTavolo API | 3002 | 3000 | altavolo.it |
| **MindCalm API** | **3003** | **3000** | **mindcalm.datagestio.com** |
