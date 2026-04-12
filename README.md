# MindCalm

Progressive Web App per sessioni di mindfulness. Serve contenuti audio (meditazioni guidate, esercizi di respirazione, body scan) e contenuti testuali (articoli, guide). Include un pannello admin per la gestione dei contenuti.

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend PWA | Vue 3 + Vite + Tailwind CSS + Pinia |
| Admin Panel | Vue 3 + Vite + Tailwind CSS + Tiptap |
| Backend API | Express.js + TypeScript + Prisma ORM |
| Database | PostgreSQL 18 |
| Deployment | Docker + Traefik Gateway (Synology NAS) |

## Struttura progetto

```
mindcalm/
├── backend/                          # API Express + TypeScript
│   ├── prisma/
│   │   ├── schema.prisma             # Modelli database
│   │   └── seed.ts                   # Seed admin + categorie
│   ├── src/
│   │   ├── index.ts                  # Entry point Express
│   │   ├── config.ts                 # Variabili d'ambiente
│   │   ├── middleware/               # auth, upload, rateLimiter, errorHandler
│   │   ├── routes/
│   │   │   ├── public/               # GET sessioni, articoli, categorie
│   │   │   └── admin/                # Auth + CRUD sessioni, articoli, categorie
│   │   ├── services/                 # authService, fileService, audioService
│   │   └── utils/                    # validators, sanitize
│   └── storage/                      # File audio e immagini (UUID)
├── frontend/                         # PWA pubblica
│   ├── src/
│   │   ├── views/                    # Home, Sessions, Articles, Downloads
│   │   ├── components/               # AudioPlayer, SessionCard, CategoryFilter
│   │   ├── stores/                   # playerStore, sessionStore, downloadStore
│   │   └── composables/              # useAudio, useOffline, useInstall
│   └── vite.config.ts                # Config PWA + Workbox
├── admin/                            # Pannello admin
│   ├── src/
│   │   ├── views/                    # Dashboard, CRUD sessioni/articoli/categorie
│   │   └── components/               # TiptapEditor, StatusBadge, DataTable
│   └── vite.config.ts
├── docker/
│   ├── development/                  # docker-compose solo PostgreSQL
│   ├── production/                   # Dockerfile multi-stage + entrypoint
│   └── production-notraefik/         # docker-compose per deploy VM dietro gateway esterno
├── .env.example
├── CLAUDE.md
└── package.json                      # Workspace root
```

---

## Sviluppo locale

### Prerequisiti

- Node.js 20 LTS
- Docker e Docker Compose

### 1. Avvia il database

```bash
cd docker/development
docker compose up -d
cd ../..
```

PostgreSQL sara' disponibile su `localhost:5435` (utente: `mindcalm`, password: `mindcalm`, database: `mindcalm`).

Se stai aggiornando un'istanza esistente da PostgreSQL 15/16/17 a PostgreSQL 18, non riutilizzare direttamente il data directory della versione precedente: esegui prima dump/restore o una procedura di upgrade dedicata.

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

I valori di default nel `.env.example` sono gia' configurati per lo sviluppo locale. Verifica solo che `DATABASE_URL` punti a `localhost:5435`.

### 4. Inizializza il database

```bash
cd backend
npx prisma migrate dev
npx tsx prisma/seed.ts
cd ..
```

Il seed crea:
- Un utente admin: `admin@mindcalm.com` / `admin123!`
- 5 categorie: Meditazione guidata, Respirazione, Body scan, Rilassamento, Mindfulness quotidiana

### 5. Avvia l'applicazione

```bash
npm run dev:start
```

Lo script `scripts/dev/start.js` avvia tutti i servizi contemporaneamente (come in Localo), gestisce la pulizia di processi orfani e mostra un banner con gli URL:

| Servizio | URL | Porta |
|---|---|---|
| Backend API | http://localhost:3300 | 3300 |
| Frontend PWA | http://localhost:5473 | 5473 |
| Admin Panel | http://localhost:5474/admin/ | 5474 |

I frontend in sviluppo fanno proxy delle chiamate `/api` verso `localhost:3300`.

### Porte assegnate

Le porte sono scelte per non andare in conflitto con nessun altro progetto nella cartella `dev/`:

| Servizio | Datagestio | Altavolo | Localo | MindCalm |
|---|---|---|---|---|
| API | 3000 | 3100 | 3200 | **3300** |
| Frontend | 5173 | 5273 | 5373 | **5473** |
| Admin | 5174 | 5274 | 5374 | **5474** |
| PostgreSQL | 5432 | 5433 | 5434 | **5435** |

### Comandi utili

```bash
# Avvia tutto (consigliato)
npm run dev:start

# Avvia i singoli servizi separatamente
npm run dev:backend
npm run dev:frontend
npm run dev:admin

# Avvia tutti con concurrently (alternativa senza gestione PID)
npm run dev

# Nuova migrazione Prisma
cd backend && npx prisma migrate dev --name nome_migrazione

# Reset database
cd backend && npx prisma migrate reset

# Prisma Studio (GUI database)
cd backend && npx prisma studio
```

---

## API

Base URL: `/api/v1`

### Endpoint pubblici

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/v1/sessions` | Elenco sessioni pubblicate (filtri: category, level, duration, search) |
| GET | `/api/v1/sessions/:id` | Dettaglio sessione |
| GET | `/api/v1/sessions/:id/audio` | Stream audio (supporta range requests) |
| GET | `/api/v1/articles` | Elenco articoli pubblicati |
| GET | `/api/v1/articles/:slug` | Dettaglio articolo per slug |
| GET | `/api/v1/categories` | Elenco categorie |
| GET | `/api/v1/files/images/:filename` | Immagini copertina |

### Endpoint admin (richiedono `Authorization: Bearer <token>`)

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/v1/auth/login` | Login admin |
| GET | `/api/v1/auth/me` | Profilo admin |
| GET/POST | `/api/v1/admin/sessions` | Lista / Crea sessione (multipart) |
| PUT/DELETE | `/api/v1/admin/sessions/:id` | Aggiorna / Elimina sessione |
| PATCH | `/api/v1/admin/sessions/:id/status` | Cambia stato (DRAFT/PUBLISHED) |
| GET/POST | `/api/v1/admin/articles` | Lista / Crea articolo |
| PUT/DELETE | `/api/v1/admin/articles/:id` | Aggiorna / Elimina articolo |
| PATCH | `/api/v1/admin/articles/:id/status` | Cambia stato |
| GET/POST | `/api/v1/admin/categories` | Lista / Crea categoria |
| PUT/DELETE | `/api/v1/admin/categories/:id` | Aggiorna / Elimina categoria |
| PATCH | `/api/v1/admin/categories/order` | Riordina categorie |

### Formato risposte

```json
// Lista con paginazione
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}

// Errore
{ "error": "Messaggio di errore", "details": {} }
```

---

## Deploy in produzione (VM Proxmox / Ubuntu Server)

Il deploy segue lo stesso approccio di Localo: container Docker sulla VM Proxmox (192.168.0.123), routing via Traefik Gateway sul NAS.

### Architettura di rete

```
Internet (porta 80/443)
    │
Router (port forward)
    │
NAS Synology (:8880/:8443)
    └── Traefik Gateway
            │
        VM Proxmox (192.168.0.123)
            ├── Datagestio (:3000)
            ├── Localo     (:3001)
            ├── AlTavolo   (:3002)
            └── MindCalm   (:3003)  ← NUOVO
```

### 1. Configura il record DNS

Aggiungi un record A o CNAME per `mindcalm.datagestio.com` che punta all'IP pubblico del router.

### 2. Aggiungi la rotta al Traefik Gateway

Modifica `traefik-gateway/traefik-dynamic.yml`:

```yaml
http:
  routers:
    # ... router esistenti ...

    # -----------------------------------------------------------------
    # MindCalm - mindcalm.datagestio.com
    # -----------------------------------------------------------------
    mindcalm:
      rule: "Host(`mindcalm.datagestio.com`)"
      entryPoints:
        - websecure
      service: mindcalm
      middlewares:
        - error-pages
      tls:
        certResolver: letsencrypt

  services:
    # ... service esistenti ...

    # -----------------------------------------------------------------
    # MindCalm - VM Proxmox, porta 3003
    # -----------------------------------------------------------------
    mindcalm:
      loadBalancer:
        servers:
          - url: "http://192.168.0.123:3003"
```

Traefik ricarica automaticamente il file (watch: true). Il certificato SSL viene generato automaticamente da Let's Encrypt.

### 3. Configura e avvia lo stack Docker

Sulla VM Proxmox, dalla directory del progetto:

```bash
cd docker/production-notraefik
cp .env.example .env
```

Modifica `.env` e imposta tutti i valori `<cambia>`:

```
POSTGRES_PASSWORD=una-password-sicura
JWT_SECRET=stringa-casuale-di-almeno-32-caratteri
ADMIN_PASSWORD=password-admin-sicura
```

### 4. Build e avvio

```bash
docker compose up -d --build
```

Al primo avvio:
- PostgreSQL viene inizializzato
- L'entrypoint esegue `prisma migrate deploy` (applica le migrazioni)
- L'app si avvia su porta 3000 interna, esposta come 3003 sulla VM

### 5. Seed iniziale

Al primo deploy, esegui il seed per creare l'utente admin e le categorie:

```bash
docker compose exec api npx tsx prisma/seed.ts
```

### Aggiornamento

```bash
cd docker/production-notraefik
docker compose build --pull
docker compose up -d
```

### Log e debug

```bash
# Log di tutti i servizi
docker compose logs -f

# Solo API
docker compose logs -f api

# Accesso shell al container
docker compose exec api sh

# Stato dei servizi
docker compose ps
```

---

## Funzionalita' principali

### Frontend PWA
- Catalogo sessioni con filtri (categoria, livello, durata) e ricerca
- Player audio globale persistente con seeking e riproduzione in background
- Download sessioni per ascolto offline (Cache API)
- Articoli e guide con rendering HTML
- Installabile come app (PWA) su Android e iOS
- Dark mode con toggle
- Indicatore connettivita' offline

### Admin Panel
- Dashboard con statistiche
- CRUD sessioni con upload audio e immagine copertina
- CRUD articoli con editor rich-text Tiptap
- Gestione categorie con color picker
- Toggle rapido stato bozza/pubblicato

### Backend
- REST API con validazione input (express-validator)
- Streaming audio con range requests (HTTP 206)
- Upload file con validazione MIME type e limiti dimensione
- Sanitizzazione HTML articoli (whitelist tag)
- Rate limiting (100 req/min pubbliche, 30 req/min login)
- Security headers (helmet)
- CORS configurabile
