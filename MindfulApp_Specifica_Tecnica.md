# MindfulApp — Specifica tecnica completa

## Panoramica progetto

MindfulApp è una Progressive Web App (PWA) per sessioni di mindfulness. L'app serve contenuti audio (meditazioni guidate, esercizi di respirazione, body scan) e contenuti testuali (articoli, guide). Include un pannello admin per la gestione dei contenuti.

L'app deve funzionare su Android e iOS senza passare dagli app store, sfruttando le capacità PWA (installabilità, funzionamento offline, riproduzione audio in background).

---

## Stack tecnologico

| Componente | Tecnologia | Note |
|---|---|---|
| Frontend PWA | Vue 3 + Vite + Tailwind CSS | SPA pubblica con vite-plugin-pwa |
| Frontend Admin | Vue 3 + Vite + Tailwind CSS | SPA separata o rotte protette nella stessa app |
| Backend API | Express.js (Node.js 20 LTS+) | API REST, serving audio, upload file |
| ORM | Prisma 5.x | Migrazioni, type-safety, query builder |
| Database | PostgreSQL 15+ | Persistenza dati |
| Autenticazione admin | JWT + bcrypt | Stateless, cost factor ≥ 12 |
| Storage file | Filesystem locale | Directory configurabile, naming UUID |
| Service Worker | vite-plugin-pwa (Workbox) | Caching, precaching, offline |
| Stato frontend | Pinia | Store globale per player, sessioni, download |
| Editor rich-text (admin) | Tiptap (ProseMirror) | Output HTML, integrazione Vue 3 |
| Reverse proxy | Traefik o Nginx | TLS termination (Let's Encrypt), routing |

---

## Struttura del progetto

```
mindfulapp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.ts                  # entry point Express
│   │   ├── config.ts                 # variabili d'ambiente
│   │   ├── middleware/
│   │   │   ├── auth.ts               # verifica JWT
│   │   │   ├── rateLimiter.ts        # rate limiting
│   │   │   ├── upload.ts             # multer config
│   │   │   └── errorHandler.ts       # gestione errori centralizzata
│   │   ├── routes/
│   │   │   ├── public/
│   │   │   │   ├── sessions.ts       # GET sessioni pubbliche
│   │   │   │   ├── articles.ts       # GET articoli pubblici
│   │   │   │   └── categories.ts     # GET categorie
│   │   │   └── admin/
│   │   │       ├── auth.ts           # login, me
│   │   │       ├── sessions.ts       # CRUD sessioni
│   │   │       ├── articles.ts       # CRUD articoli
│   │   │       └── categories.ts     # CRUD categorie
│   │   ├── services/
│   │   │   ├── audioService.ts       # estrazione durata, validazione
│   │   │   ├── fileService.ts        # salvataggio, eliminazione file
│   │   │   └── authService.ts        # hash password, generazione JWT
│   │   └── utils/
│   │       ├── validators.ts         # express-validator schemas
│   │       └── sanitize.ts           # sanitize-html config
│   ├── storage/
│   │   ├── audio/                    # file audio (UUID-named)
│   │   └── images/                   # immagini copertina
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/
│   │   │   └── index.ts
│   │   ├── stores/
│   │   │   ├── playerStore.ts        # stato player audio globale
│   │   │   ├── sessionStore.ts       # sessioni, filtri, paginazione
│   │   │   ├── downloadStore.ts      # gestione download offline
│   │   │   └── uiStore.ts            # tema, connettività
│   │   ├── views/
│   │   │   ├── HomeView.vue
│   │   │   ├── SessionsView.vue      # catalogo con filtri
│   │   │   ├── SessionDetailView.vue # dettaglio + player
│   │   │   ├── ArticlesView.vue
│   │   │   ├── ArticleDetailView.vue
│   │   │   └── DownloadsView.vue     # sessioni offline
│   │   ├── components/
│   │   │   ├── AudioPlayer.vue       # player globale persistente
│   │   │   ├── SessionCard.vue
│   │   │   ├── CategoryFilter.vue
│   │   │   ├── ArticleRenderer.vue
│   │   │   ├── DownloadButton.vue
│   │   │   ├── DownloadManager.vue
│   │   │   └── InstallPrompt.vue     # banner installazione PWA
│   │   ├── composables/
│   │   │   ├── useAudio.ts           # logica HTML5 Audio
│   │   │   ├── useOffline.ts         # stato connettività
│   │   │   └── useInstall.ts         # beforeinstallprompt
│   │   └── assets/
│   │       └── styles/
│   │           └── main.css          # @tailwind directives
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons/                    # icone PWA varie dimensioni
│   ├── index.html
│   ├── vite.config.ts                # include VitePWA plugin
│   ├── tailwind.config.js
│   └── package.json
├── admin/
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/
│   │   │   └── index.ts              # navigation guard per auth
│   │   ├── stores/
│   │   │   └── authStore.ts          # JWT, login/logout
│   │   ├── views/
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   ├── SessionsListView.vue
│   │   │   ├── SessionFormView.vue   # create/edit
│   │   │   ├── ArticlesListView.vue
│   │   │   ├── ArticleFormView.vue   # create/edit con Tiptap
│   │   │   └── CategoriesView.vue
│   │   └── components/
│   │       ├── TiptapEditor.vue
│   │       ├── FileUpload.vue
│   │       ├── DataTable.vue
│   │       └── StatusBadge.vue
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml                # opzionale
├── .env.example
└── README.md
```

---

## Schema database (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model AdminUser {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // bcrypt hash
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("admin_users")
}

model Category {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  color       String?   // HEX es. "#4A90D9"
  icon        String?   // nome icona (es. "lotus", "wind", "brain")
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  sessions    Session[]

  @@map("categories")
}

model Session {
  id          String    @id @default(uuid())
  title       String
  description String
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  level       Level     @default(BEGINNER)
  durationSec Int       // calcolata automaticamente al caricamento
  audioFile   String    // path relativo es. "audio/abc-123.mp3"
  audioFormat String    // "mp3", "ogg", "wav"
  audioSize   Int       // byte
  coverImage  String?   // path relativo es. "images/abc-123.jpg"
  status      Status    @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([categoryId])
  @@index([status])
  @@index([level])
  @@map("sessions")
}

model Article {
  id          String    @id @default(uuid())
  title       String
  slug        String    @unique
  body        String    // HTML sanitizzato
  excerpt     String?   // anteprima breve (max 300 char)
  author      String
  coverImage  String?
  status      Status    @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status])
  @@index([slug])
  @@map("articles")
}

enum Level {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum Status {
  DRAFT
  PUBLISHED
}
```

---

## API REST — Specifica completa

Base URL: `/api/v1`  
Content-Type: `application/json` (tranne upload: `multipart/form-data`)  
Autenticazione admin: header `Authorization: Bearer <token>`  
Paginazione: query params `page` (default 1) e `limit` (default 20)  
Errori: `{ "error": "messaggio", "details": {} }`

### Endpoint pubblici (nessuna autenticazione)

#### GET /api/v1/sessions
Elenco sessioni pubblicate.

Query params:
- `category` (string, uuid) — filtra per categoria
- `level` (string: BEGINNER|INTERMEDIATE|ADVANCED) — filtra per livello
- `duration` (string: short|medium|long) — short < 600s, medium 600-1200s, long > 1200s
- `search` (string) — ricerca su titolo e descrizione (ILIKE)
- `page`, `limit` — paginazione

Risposta:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Meditazione del respiro",
      "description": "Una sessione guidata...",
      "category": { "id": "uuid", "name": "Respirazione", "color": "#4A90D9" },
      "level": "BEGINNER",
      "durationSec": 600,
      "coverImage": "/api/v1/files/images/abc-123.jpg",
      "publishedAt": "2026-04-01T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

#### GET /api/v1/sessions/:id
Dettaglio sessione. Include URL per lo stream audio.

Risposta:
```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "category": { "id": "uuid", "name": "...", "color": "..." },
  "level": "BEGINNER",
  "durationSec": 600,
  "audioUrl": "/api/v1/sessions/uuid/audio",
  "audioFormat": "mp3",
  "audioSize": 9500000,
  "coverImage": "/api/v1/files/images/abc-123.jpg",
  "publishedAt": "2026-04-01T10:00:00Z"
}
```

#### GET /api/v1/sessions/:id/audio
Stream del file audio. DEVE supportare range requests (HTTP 206 Partial Content) per consentire seeking nel player senza scaricare l'intero file.

Headers risposta:
- `Content-Type: audio/mpeg` (o ogg, wav)
- `Accept-Ranges: bytes`
- `Content-Length` / `Content-Range` per range requests

#### GET /api/v1/categories
Elenco categorie ordinate per sortOrder.

#### GET /api/v1/articles
Elenco articoli pubblicati (paginato). Restituisce: id, title, slug, excerpt, author, coverImage, publishedAt.

#### GET /api/v1/articles/:slug
Dettaglio articolo per slug. Restituisce tutti i campi incluso body HTML.

### Endpoint admin (richiedono JWT)

#### POST /api/v1/auth/login
Body: `{ "email": "...", "password": "..." }`  
Risposta: `{ "token": "jwt...", "user": { "id", "email", "name" } }`

#### GET /api/v1/auth/me
Restituisce profilo dell'admin autenticato.

#### CRUD sessioni admin

| Metodo | Endpoint | Content-Type | Descrizione |
|---|---|---|---|
| GET | /api/v1/admin/sessions | — | Elenco sessioni (tutte, incluse DRAFT), con filtri e paginazione |
| POST | /api/v1/admin/sessions | multipart/form-data | Crea sessione: fields (title, description, categoryId, level) + file audio + file coverImage opzionale |
| PUT | /api/v1/admin/sessions/:id | multipart/form-data | Aggiorna metadati e/o sostituisce file |
| DELETE | /api/v1/admin/sessions/:id | — | Elimina sessione e file associati dal filesystem |
| PATCH | /api/v1/admin/sessions/:id/status | application/json | Body: `{ "status": "PUBLISHED" }` — cambia stato pubblicazione; se PUBLISHED, imposta publishedAt a now() |

Logica POST sessione:
1. Validare i campi obbligatori (title, description, categoryId, file audio)
2. Validare MIME type audio (whitelist: audio/mpeg, audio/ogg, audio/wav)
3. Validare dimensione file (max 100 MB)
4. Generare UUID come nome file
5. Salvare file su disco
6. Estrarre durata audio con `music-metadata` o `ffprobe`
7. Creare record nel database
8. Restituire la sessione creata

#### CRUD articoli admin

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | /api/v1/admin/articles | Elenco articoli (tutti, incluse bozze) |
| POST | /api/v1/admin/articles | Crea articolo: title, body (HTML), author, excerpt, coverImage. Lo slug è generato automaticamente dal titolo. |
| PUT | /api/v1/admin/articles/:id | Aggiorna articolo |
| DELETE | /api/v1/admin/articles/:id | Elimina articolo |
| PATCH | /api/v1/admin/articles/:id/status | Cambia stato pubblicazione |

Il body HTML deve essere sanitizzato con `sanitize-html` prima del salvataggio. Tag consentiti: p, h2, h3, h4, strong, em, ul, ol, li, a (con href), img (con src e alt), blockquote, br.

#### CRUD categorie admin

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | /api/v1/admin/categories | Elenco categorie |
| POST | /api/v1/admin/categories | Crea categoria (name, description, color, icon) |
| PUT | /api/v1/admin/categories/:id | Aggiorna categoria |
| DELETE | /api/v1/admin/categories/:id | Elimina categoria (solo se non ha sessioni associate) |
| PATCH | /api/v1/admin/categories/order | Riordina categorie. Body: `{ "ids": ["uuid1", "uuid2", ...] }` |

---

## Frontend PWA — Specifiche

### Viste e routing

```typescript
// router/index.ts
const routes = [
  { path: '/', component: HomeView },
  { path: '/sessions', component: SessionsView },
  { path: '/sessions/:id', component: SessionDetailView },
  { path: '/articles', component: ArticlesView },
  { path: '/articles/:slug', component: ArticleDetailView },
  { path: '/downloads', component: DownloadsView },
]
```

### HomeView
- Hero section con sessione del giorno o casuale tra le pubblicate
- Griglia categorie (icona + nome, cliccabili → filtro catalogo)
- Ultimi 3 articoli pubblicati (card con titolo, excerpt, data)
- Call-to-action per installazione PWA (se non installata)

### SessionsView
- Griglia o lista di SessionCard
- Filtri: dropdown categoria, chip livello (BEGINNER/INTERMEDIATE/ADVANCED), slider o chip durata (breve/media/lunga)
- Barra di ricerca testuale
- Paginazione o infinite scroll
- Indicatore visivo per sessioni già scaricate offline

### SessionDetailView
- Titolo, descrizione completa, categoria (badge colorato), livello, durata formattata (mm:ss)
- Immagine di copertina (se presente)
- Pulsante play che avvia il player globale
- Pulsante download per ascolto offline
- Sezione "sessioni correlate" (stessa categoria)

### AudioPlayer (componente globale)
Persistente nel layout (barra fissa in basso). Sempre visibile quando una sessione è in riproduzione.

Funzionalità:
- Play / pausa
- Barra di progresso interattiva (seeking con touch/click)
- Tempo trascorso / tempo totale
- Titolo sessione in riproduzione
- Tap sul titolo → navigazione al dettaglio sessione
- Chiudi player (stop riproduzione)

Implementazione:
- Usa HTML5 Audio API nativa (`new Audio()`)
- Stato gestito in playerStore (Pinia)
- Il composable `useAudio` incapsula la logica di riproduzione
- La riproduzione in background (schermo spento) funziona nativamente con HTML5 Audio

```typescript
// stores/playerStore.ts
interface PlayerState {
  currentSession: Session | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isLoading: boolean
}
```

### DownloadsView
- Elenco sessioni scaricate con dimensione occupata
- Pulsante eliminazione per singola sessione
- Indicatore spazio totale usato
- Messaggio se nessuna sessione scaricata

### Gestione download offline

```typescript
// stores/downloadStore.ts
// Usa Cache API per salvare i file audio
// La chiave della cache è l'URL audio della sessione
// I metadati della sessione sono salvati in localStorage

interface DownloadState {
  downloads: Map<string, DownloadedSession> // sessionId → metadata
  activeDownloads: Map<string, number>       // sessionId → progress %
}

interface DownloadedSession {
  sessionId: string
  title: string
  durationSec: number
  categoryName: string
  audioSize: number
  downloadedAt: string
}
```

Logica download:
1. Fetch dell'intero file audio
2. Salvataggio in una cache dedicata (`mindfulapp-audio`)
3. Salvataggio metadati in localStorage
4. In modalità offline, il player carica l'audio dalla cache invece che dal server

### Configurazione PWA (vite.config.ts)

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MindfulApp',
        short_name: 'Mindful',
        description: 'Sessioni di mindfulness guidate',
        theme_color: '#4A90D9',
        background_color: '#F8FAFE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/sessions(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'sessions-api', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/articles(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'articles-api', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/categories$/,
            handler: 'CacheFirst',
            options: { cacheName: 'categories-api', expiration: { maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/files\/images\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
    }),
  ],
})
```

### Strategia caching riepilogo

| Risorsa | Strategia | Cache name | Scadenza |
|---|---|---|---|
| Shell app (HTML, CSS, JS) | Precache (automatico) | workbox-precache | Aggiornamento automatico |
| API sessioni e articoli (elenchi) | StaleWhileRevalidate | sessions-api / articles-api | 1 ora |
| API categorie | CacheFirst | categories-api | 24 ore |
| Immagini copertina | CacheFirst | cover-images | 7 giorni, max 100 |
| File audio (download utente) | Cache API manuale | mindfulapp-audio | Nessuna scadenza, gestione manuale |

---

## Pannello admin — Specifiche

### Routing e autenticazione

```typescript
// router/index.ts
const routes = [
  { path: '/admin/login', component: LoginView },
  { path: '/admin', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/admin/sessions', component: SessionsListView, meta: { requiresAuth: true } },
  { path: '/admin/sessions/new', component: SessionFormView, meta: { requiresAuth: true } },
  { path: '/admin/sessions/:id/edit', component: SessionFormView, meta: { requiresAuth: true } },
  { path: '/admin/articles', component: ArticlesListView, meta: { requiresAuth: true } },
  { path: '/admin/articles/new', component: ArticleFormView, meta: { requiresAuth: true } },
  { path: '/admin/articles/:id/edit', component: ArticleFormView, meta: { requiresAuth: true } },
  { path: '/admin/categories', component: CategoriesView, meta: { requiresAuth: true } },
]

// Navigation guard
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/admin/login'
  }
})
```

### DashboardView
- Conteggio sessioni (pubblicate / bozze)
- Conteggio articoli (pubblicati / bozze)
- Conteggio categorie
- Ultime 5 sessioni caricate
- Ultimi 5 articoli modificati

### SessionFormView
Form con:
- `title` (text input, obbligatorio)
- `description` (textarea, obbligatorio)
- `categoryId` (select dropdown, obbligatorio)
- `level` (radio: Principiante / Intermedio / Avanzato)
- `audioFile` (file input, accetta audio/mpeg,audio/ogg,audio/wav — obbligatorio in creazione)
- `coverImage` (file input, accetta image/jpeg,image/png,image/webp — opzionale)
- `status` (toggle: Bozza / Pubblicato)

In modalità edit, i campi sono precompilati. Se non si carica un nuovo file audio, si mantiene quello esistente.

Il form mostra preview dell'immagine caricata e il nome del file audio con durata (dopo caricamento).

### ArticleFormView
Form con:
- `title` (text input, obbligatorio)
- `author` (text input, obbligatorio)
- `excerpt` (textarea, max 300 caratteri, opzionale)
- `body` (editor Tiptap, obbligatorio)
- `coverImage` (file upload, opzionale)
- `status` (toggle: Bozza / Pubblicato)

Configurazione Tiptap:
- Estensioni: StarterKit, Link, Image, Placeholder
- Toolbar: Bold, Italic, H2, H3, BulletList, OrderedList, Blockquote, Link, Image, Undo, Redo
- Output: HTML

### CategoriesView
- Tabella con: nome, colore (pallino colorato), numero sessioni associate, azioni (modifica, elimina)
- Drag-and-drop per riordinamento (libreria: vuedraggable o SortableJS)
- Modal per creazione/modifica (name, description, color picker, icon select)
- Blocco eliminazione se la categoria ha sessioni associate (mostrare errore)

---

## Sicurezza

### Middleware auth (backend)

```typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token mancante' })

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    req.adminUser = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token non valido o scaduto' })
  }
}
```

### Checklist sicurezza

- Password hash con bcrypt, cost factor ≥ 12
- JWT access token con scadenza 1h
- HTTPS obbligatorio (TLS via Traefik/Nginx)
- express-validator su tutti gli input
- sanitize-html sul body degli articoli (whitelist tag: p, h2, h3, h4, strong, em, ul, ol, li, a, img, blockquote, br)
- express-rate-limit: 100 req/min API pubbliche, 30 req/min login
- CORS whitelist (solo domini frontend)
- helmet per security headers
- Validazione MIME type su upload (whitelist)
- Limite dimensione: 100 MB audio, 5 MB immagini
- Naming file con UUID (nessun nome utente esposto)
- Nessun path traversal: servire file solo dalla directory di storage configurata

---

## Variabili d'ambiente

```env
# Database
DATABASE_URL=postgresql://mindfulapp:password@localhost:5432/mindfulapp

# Server
PORT=3000
NODE_ENV=production

# Auth
JWT_SECRET=una-stringa-casuale-di-almeno-32-caratteri
JWT_EXPIRES_IN=1h

# Storage
AUDIO_STORAGE_PATH=./storage/audio
IMAGES_STORAGE_PATH=./storage/images
MAX_AUDIO_SIZE_MB=100
MAX_IMAGE_SIZE_MB=5

# CORS
CORS_ORIGIN=https://mindfulapp.example.com

# Rate limiting
RATE_LIMIT_PUBLIC=100
RATE_LIMIT_LOGIN=30
```

---

## Docker Compose (opzionale)

```yaml
version: "3.8"

services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: mindfulapp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mindfulapp
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: ./backend
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://mindfulapp:${DB_PASSWORD}@db:5432/mindfulapp
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: 3000
      AUDIO_STORAGE_PATH: /data/audio
      IMAGES_STORAGE_PATH: /data/images
      CORS_ORIGIN: https://mindfulapp.example.com
    volumes:
      - audio-storage:/data/audio
      - image-storage:/data/images
    ports:
      - "3000:3000"

  web:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      - api
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./admin/dist:/usr/share/nginx/html/admin:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "8080:80"

volumes:
  pgdata:
  audio-storage:
  image-storage:
```

---

## Seed database

```typescript
// prisma/seed.ts
import { PrismaClient, Level, Status } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12)
  await prisma.adminUser.upsert({
    where: { email: 'admin@mindfulapp.com' },
    update: {},
    create: {
      email: 'admin@mindfulapp.com',
      password: hashedPassword,
      name: 'Admin',
    },
  })

  // Categorie
  const categories = [
    { name: 'Meditazione guidata', description: 'Sessioni con guida vocale', color: '#4A90D9', icon: 'lotus', sortOrder: 1 },
    { name: 'Respirazione', description: 'Esercizi di respirazione consapevole', color: '#50B860', icon: 'wind', sortOrder: 2 },
    { name: 'Body scan', description: 'Scansione corporea guidata', color: '#E8A040', icon: 'body', sortOrder: 3 },
    { name: 'Rilassamento', description: 'Tecniche di rilassamento profondo', color: '#9B6DC6', icon: 'moon', sortOrder: 4 },
    { name: 'Mindfulness quotidiana', description: 'Pratiche brevi per ogni giorno', color: '#E06060', icon: 'sun', sortOrder: 5 },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }

  console.log('Seed completato')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## Note di design (UX/UI)

### Palette colori suggerita
- Primary: #4A90D9 (blu sereno)
- Secondary: #50B860 (verde naturale)
- Background: #F8FAFE (bianco leggermente azzurrato)
- Surface: #FFFFFF
- Text primary: #1A2B3C
- Text secondary: #6B7C8D
- Accent: #E8A040 (giallo caldo, per elementi di attenzione)

### Principi di design
- Minimalismo: interfaccia pulita, molto spazio bianco, nessun elemento superfluo
- Tipografia grande e leggibile: corpo testo ≥ 16px, titoli proporzionati
- Transizioni morbide: animazioni delicate (fade, slide) coerenti con il tema mindfulness
- Feedback tattile sottile: stato dei pulsanti, loading states con skeleton screen
- Dark mode: prevedere supporto via `prefers-color-scheme` e toggle manuale
- Accessibilità: contrasto WCAG AA, focus visibili, ruoli ARIA sul player audio

### Attenzioni iOS
- Riproduzione audio: richiede interazione utente per partire (nessun autoplay)
- PWA install: su Safari tramite "Aggiungi alla schermata Home" dal menu condivisione (non c'è prompt automatico)
- Storage offline: iOS può svuotare il cache delle PWA dopo periodi di inattività — segnalare all'utente nella sezione download

---

## Checklist pre-sviluppo

- [ ] Inizializzare repository Git
- [ ] Setup backend: `npm init`, installare express, prisma, @prisma/client, bcrypt, jsonwebtoken, multer, express-validator, sanitize-html, express-rate-limit, helmet, cors, music-metadata
- [ ] Setup Prisma: `npx prisma init`, copiare schema, `npx prisma migrate dev`
- [ ] Setup frontend: `npm create vite@latest frontend -- --template vue-ts`, installare pinia, vue-router, vite-plugin-pwa, tailwindcss
- [ ] Setup admin: stesso template Vue, installare @tiptap/vue-3, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-image
- [ ] Configurare .env con variabili database, JWT, storage
- [ ] Eseguire seed database
- [ ] Configurare Traefik/Nginx per TLS e routing
- [ ] Creare icone PWA (192x192 e 512x512, versione maskable)
