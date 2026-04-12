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
| `ADMIN_PASSWORD` | Password bootstrap sicura a scelta |
| `ADMIN_EMAIL` | Email dedicata al bootstrap admin |
| `CORS_ORIGIN` | Dominio pubblico reale dell'istanza |
| `DEPLOY_BRANCH` | Branch git da deployare (`main` in produzione) |

## 3. Creare le directory dati

```bash
mkdir -p ./data/postgres ./data/audio ./data/hls ./data/images
```

## 4. Build e primo avvio

```bash
./deploy.sh --reset-data
```

L'entrypoint del container API esegue automaticamente:
- `prisma migrate deploy` (migrazioni database)
- Setup permessi directory storage (`/data/audio`, `/data/hls`, `/data/images`)

## 4.1 Primo accesso admin

Con il nuovo flusso non viene eseguito alcun seed admin in produzione.

Il login iniziale usa il **bootstrap admin** configurato in `.env`:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Comportamento:

- se non esiste alcun admin attivo nel database, puoi accedere a `/admin/login` con le credenziali bootstrap
- dopo il login verrai reindirizzato a `/admin/setup`
- da lì crei il primo admin reale nel database
- appena esiste almeno un admin attivo, il bootstrap admin da ENV smette di funzionare

### Deploy automatico con script

In alternativa ai comandi manuali puoi usare:

```bash
cd /opt/mindcalm/docker/production-notraefik
chmod +x deploy.sh
./deploy.sh
```

#### Uso rapido

Scenario tipico:

```bash
# 1. Vai nella cartella del deploy
cd /opt/mindcalm/docker/production-notraefik

# 2. Verifica o modifica il file .env
nano .env

# 3. Verifica il branch di deploy
grep '^DEPLOY_BRANCH=' .env

# 4. Esegui un aggiornamento senza perdere dati
./deploy.sh
```

Reinstallazione completa da zero:

```bash
cd /opt/mindcalm/docker/production-notraefik
./deploy.sh --reset-data
```

Attenzione:

- di default lo script preserva database e storage locale
- `--reset-data` elimina completamente database, storage locale e volumi Docker
- `--yes` salta solo la conferma interattiva, non rende il deploy meno distruttivo
- se `.env` non esiste, viene creato automaticamente da `.env.example`
- lo script deploya il branch definito da `DEPLOY_BRANCH` nel `.env` oppure quello passato con `--branch`
- se il repository ha modifiche locali tracciate, lo script si ferma prima del deploy
- se il deploy fallisce, lo script mostra automaticamente `docker compose ps` e gli ultimi log di `api` e `postgres`

Modalita' disponibili:

```bash
# Aggiornamento conservativo: mantiene DB e storage
./deploy.sh

# Aggiornamento di un branch specifico
./deploy.sh --branch codex/fix-admin-login-route

# Aggiornamento conservativo senza prompt
./deploy.sh --yes

# Reinstallazione completa: distrugge dati, storage e volumi Docker
./deploy.sh --reset-data

# Reinstallazione completa senza prompt
./deploy.sh --reset-data --yes
```

Significato opzioni:

- `--keep-data`: alias esplicito del comportamento di default, mantiene `./data/postgres`, `./data/audio`, `./data/hls`, `./data/images`
- `--reset-data`: esegue `docker compose down --volumes --remove-orphans --rmi local` e rimuove `./data`
- `--yes`: accetta automaticamente il prompt di conferma
- `--branch`: forza il branch git da deployare per questa esecuzione
- nessuna opzione: aggiornamento conservativo con rebuild dello stack

Comportamento dello script:

- esegue `git fetch --prune origin`
- si posiziona sul branch target (`DEPLOY_BRANCH` o `--branch`)
- esegue `git pull --ff-only origin <branch-target>`
- crea `.env` da `.env.example` se manca
- in modalita' predefinita preserva `./data`
- con `--reset-data` esegue `docker compose down --volumes --remove-orphans --rmi local` e rimuove `./data`
- ricostruisce lo stack e verifica:
  - `http://127.0.0.1:3003/api/health`
  - `http://127.0.0.1:3003/`
  - `http://127.0.0.1:3003/admin/` -> `302`
  - `http://127.0.0.1:3003/admin/login` -> `200`
- se qualcosa va storto, stampa automaticamente stato container e log recenti

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
cd /opt/mindcalm/docker/production-notraefik
./deploy.sh
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
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Backup database
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backup.sql
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
