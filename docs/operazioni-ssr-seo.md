# MindCalm — Note operative SSR & SEO

Runbook per il setup, il deploy e la verifica dell'architettura SSR (Nuxt) e degli hardening SEO introdotti nei commit `3a91423` e `4405bac` sul branch `claude/review-nuxt-ssr-seo-GN2pZ`.

Riferimenti correlati:
- `docs/architettura-migrazione-ssr.md` — architettura e decisioni
- `docker/production-notraefik/deploy.sh` — script di deploy
- `docker/production-notraefik/smoke-check.sh` — smoke test ripetibile

---

## 1. Variabili d'ambiente richieste

### Tabella riassuntiva

| Variabile | Dove | Valore prod | Valore staging/preview | Default se omessa |
|---|---|---|---|---|
| `FRONTEND_RENDER_MODE` | backend | `ssr` | `ssr` o `spa` | `spa` |
| `FRONTEND_SSR_ORIGIN` | backend | `http://frontend-ssr:3000` | idem | `http://localhost:5573` |
| `PUBLIC_SITE_URL` | deploy env | `https://mindcalm.datagestio.com` | URL staging | obbligatorio in SSR |
| `NUXT_PUBLIC_API_BASE` | frontend-ssr | `http://api:3000` | idem | `http://localhost:3300` |
| `NUXT_PUBLIC_SITE_URL` | frontend-ssr | = `PUBLIC_SITE_URL` | idem | `http://localhost:5573` |
| `NUXT_PUBLIC_ALLOW_INDEXING` | frontend-ssr | `true` | **`false`** | `true` |
| `SSR_INTERNAL_TOKEN` | backend + frontend-ssr | stringa random 32 byte | idem | vuoto (skip rate limit disattivata) |

### Generazione `SSR_INTERNAL_TOKEN`

Il token deve essere **identico** sui due servizi (`api` e `frontend-ssr`). Lasciarlo vuoto non rompe il deploy ma disabilita il bypass del rate limiter: in SSR è raccomandato impostarlo.

```bash
openssl rand -base64 32
```

Incollare il valore in `docker/production-notraefik/.env` sotto `SSR_INTERNAL_TOKEN=`. Il compose lo propaga ad entrambi i container.

### Indicizzazione motori di ricerca

- **Produzione**: `NUXT_PUBLIC_ALLOW_INDEXING=true` (default).
  - `robots.txt` emette `Allow: /` + link alla sitemap.
  - Nessun meta `robots` restrittivo.
- **Staging / preview**: `NUXT_PUBLIC_ALLOW_INDEXING=false`.
  - `robots.txt` emette `Disallow: /`.
  - Ogni pagina ha `<meta name="robots" content="noindex, nofollow">`.

---

## 2. Messa in produzione (primo deploy SSR)

Prerequisito: VM con Docker + Compose v2 e accesso al repo Git.

### 2.1 Preparazione env

```bash
cd docker/production-notraefik
cp .env.example .env
```

Modificare `.env` con valori reali (minimo):

- `POSTGRES_PASSWORD` — password DB forte
- `JWT_SECRET` — `openssl rand -base64 32`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenziali bootstrap admin
- `CORS_ORIGIN` — dominio pubblico servito dal gateway esterno
- `PUBLIC_SITE_URL` — stesso dominio, con schema https
- `FRONTEND_RENDER_MODE=ssr`
- `SSR_INTERNAL_TOKEN` — `openssl rand -base64 32`
- `NUXT_PUBLIC_ALLOW_INDEXING=true` (in produzione) o `false` (staging)

### 2.2 Dipendenze node aggiornate

Se stai aggiornando un checkout esistente e non stai usando `deploy.sh --reset-data`, rigenera le dipendenze (`sanitize-html` è una dep nuova di `frontend-ssr`):

```bash
# In locale, prima di committare o con repo già aggiornato sulla VM
npm install
```

Durante il `docker compose build` questa fase avviene automaticamente nel Dockerfile.

### 2.3 Deploy

Da `docker/production-notraefik`:

```bash
./deploy.sh --yes
```

Lo script:

1. Valida la config (fallisce se `FRONTEND_RENDER_MODE=ssr` senza `PUBLIC_SITE_URL`).
2. Fa `git fetch` + checkout sul branch indicato (`DEPLOY_BRANCH` in `.env` o `--branch`).
3. Builda e avvia lo stack (`postgres`, `frontend-ssr`, `api`).
4. Aspetta che i container siano healthy.
5. Verifica endpoint pubblici (status + contenuto body):
   - `/api/health` → 200
   - `/` → 200, body contiene `MindCalm`
   - `/robots.txt` → 200, body contiene `User-agent:`
   - `/sitemap.xml` → 200, body contiene `<urlset`
   - `/admin/` → 200 o 302
   - `/admin/login` → 200
   - reachability interna API → `frontend-ssr:3000/healthz`
6. Esegue `smoke-check.sh`.

Se una di queste verifiche fallisce, lo script dumpa `docker inspect`, i log recenti e termina con codice non-zero.

### 2.4 Primo accesso admin

Alla prima login via `/admin/login` con `ADMIN_EMAIL` / `ADMIN_PASSWORD` il backend redirige a `/admin/setup` per creare l'admin reale. Dopo la creazione, le credenziali bootstrap smettono di essere valide finché l'admin reale esiste.

---

## 3. Aggiornamento produzione (stack già in esecuzione)

### 3.1 Update conservativo (dati preservati)

```bash
cd docker/production-notraefik
./deploy.sh --yes
```

Rebuild immagini, restart rolling, DB/storage intatti. Default sicuro.

### 3.2 Reset completo

Solo se il DB è corrotto o in setup iniziale. Distrugge **tutto**: DB, audio, immagini, HLS, backup.

```bash
./deploy.sh --reset-data --yes
```

### 3.3 Cambio ramo di deploy

```bash
./deploy.sh --branch main --yes
```

---

## 4. Cutover SSR ↔ SPA

Il toggle è binario e non richiede modifiche al DB.

### 4.1 Da SPA a SSR

```bash
# In .env
FRONTEND_RENDER_MODE=ssr
PUBLIC_SITE_URL=https://mindcalm.datagestio.com
NUXT_PUBLIC_ALLOW_INDEXING=true
SSR_INTERNAL_TOKEN=<token>
```

```bash
./deploy.sh --yes
```

### 4.2 Rollback da SSR a SPA

```bash
# In .env
FRONTEND_RENDER_MODE=spa
```

```bash
./deploy.sh --yes
```

Il container `frontend-ssr` resta avviato (healthy) ma non viene più usato: il backend Express serve direttamente il bundle SPA statico dalla build.

---

## 5. Verifiche post-deploy

### 5.1 Automatica

```bash
cd docker/production-notraefik
./smoke-check.sh
```

Controlla i minimi endpoint in base a `FRONTEND_RENDER_MODE`.

### 5.2 Manuale

Dal dominio pubblico:

```bash
curl -sI https://mindcalm.datagestio.com/ | head -5
curl -s  https://mindcalm.datagestio.com/robots.txt
curl -s  https://mindcalm.datagestio.com/sitemap.xml | head -20
```

Attesi in produzione (`ALLOW_INDEXING=true`):

- `/robots.txt` → `User-agent: *\nAllow: /\n...\nSitemap: https://.../sitemap.xml`
- `/sitemap.xml` → XML con `<urlset>` che contiene URL statici + tutti i post/audio/eventi pubblicati con `<lastmod>`

### 5.3 Verifica SEO on page

```bash
curl -s https://mindcalm.datagestio.com/ | grep -E '<html|<title|canonical|og:'
```

Attesi:

- `<html lang="it">`
- `<title>Mindfulness guidata ... · MindCalm</title>`
- `<link rel="canonical" href="https://mindcalm.datagestio.com/">`
- `<meta property="og:url" content="https://mindcalm.datagestio.com/">`
- `<meta property="og:site_name" content="MindCalm">`
- `<meta name="twitter:card" content="summary_large_image">`

Per la pagina di un articolo:

```bash
curl -s https://mindcalm.datagestio.com/posts/<slug> | grep -E 'application/ld\+json' -A 10
```

Attesi: blocco JSON-LD `{"@type":"Article", ... "datePublished": ...}`.

---

## 6. Indicizzazione in staging / preview

Per ambienti non-produttivi che vogliamo mantenere fuori dall'indicizzazione Google:

```bash
# In .env dello staging
NUXT_PUBLIC_ALLOW_INDEXING=false
```

Dopo redeploy:

```bash
curl -s https://staging.mindcalm.datagestio.com/robots.txt
# User-agent: *
# Disallow: /

curl -s https://staging.mindcalm.datagestio.com/ | grep 'name="robots"'
# <meta name="robots" content="noindex, nofollow">
```

**Nota**: `Disallow: /` suggerisce ai crawler conformi (Google, Bing) di non indicizzare, ma non blocca l'accesso. Se il dominio di staging deve essere completamente chiuso, aggiungere una basic-auth sul reverse proxy esterno.

---

## 7. Troubleshooting

### 7.1 Deploy fallisce su "Frontend SSR body"

`deploy.sh` accede a `/` e non trova `MindCalm` nel body. Cause tipiche:

- `frontend-ssr` container è healthy ma serve una shell vuota (bug di build o routing rotto).
  - `compose logs --tail=200 frontend-ssr`
  - `docker exec -it mindcalm_notraefik_frontend_ssr sh` → `wget -qO- http://127.0.0.1:3000/` per vedere il body
- API chiama `frontend-ssr` con path errato.
  - `docker exec mindcalm_notraefik_api wget -qO- http://frontend-ssr:3000/` deve rispondere HTML.

### 7.2 Rate limit 429 dal frontend SSR

Sintomo: pagine rendono vuote o con fallback, log API mostra `RATE_LIMITED` con IP del container `frontend-ssr`.

Fix:

```bash
# Verifica che entrambi i servizi abbiano lo stesso SSR_INTERNAL_TOKEN
docker exec mindcalm_notraefik_api printenv SSR_INTERNAL_TOKEN
docker exec mindcalm_notraefik_frontend_ssr printenv SSR_INTERNAL_TOKEN
```

Se uno dei due è vuoto o diverso, allineare `.env` e rifare `./deploy.sh --yes`.

In alternativa, alzare `RATE_LIMIT_PUBLIC` in `.env` (ma lasciarlo con il token è la soluzione corretta).

### 7.3 Sitemap con pochi URL

Se `/sitemap.xml` contiene solo URL statici o molti meno di quelli attesi:

- Verificare che gli articoli/audio/eventi siano in stato `PUBLISHED` nel DB.
- Controllare i log di `frontend-ssr`: l'implementazione logga `[sitemap] fetch ... failed` se l'API è non raggiungibile.
- La paginazione è capata a `MAX_PAGES=50` × `PAGE_SIZE=200` = 10.000 URL per tipo. Se il catalogo supera questa soglia, serve alzare `MAX_PAGES` in `frontend-ssr/server/routes/sitemap.xml.ts` o migrare a `@nuxtjs/sitemap` con sitemap-index.

### 7.4 OG image non appare nelle anteprime social

- Verificare che la cover esista e sia pubblica: `curl -I <siteUrl>/api/files/images/<filename>` deve rispondere 200 al public. Se richiede auth, è un bug lato backend (`/api/files/images` è protetto con `authMiddleware`, serve usare `/public-api/images`).
- Per i tool di debug: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), [X Card Validator](https://cards-dev.twitter.com/validator).
- Per le pagine senza cover (home, liste, legali) il fallback è `/favicon.svg`: molti crawler supportano SVG, alcuni no. Se serve un'anteprima raster, aggiungere un PNG `frontend-ssr/public/og-default.png` 1200×630 e riferirlo nel fallback di `composables/useSeoDefaults.ts`.

### 7.5 Contenuto HTML sparito dopo sanitize

Sintomo: un post con tag HTML personalizzati non mostra più certi elementi. Il sanitize in `frontend-ssr/utils/sanitizeContent.ts` ha una whitelist stretta. Per aggiungere un tag (es. `video`, `iframe`):

```ts
// frontend-ssr/utils/sanitizeContent.ts
allowedTags: [
  ...sanitizeHtml.defaults.allowedTags,
  'h1', 'h2', 'img', 'figure', 'figcaption',
  'iframe',  // <-- nuovo
],
allowedAttributes: {
  ...sanitizeHtml.defaults.allowedAttributes,
  iframe: ['src', 'width', 'height', 'allow', 'frameborder', 'allowfullscreen'],
},
```

Valutare con attenzione i rischi XSS per ogni tag aperto (particolarmente `iframe` e `script`).

---

## 8. Checklist rapida messa in produzione

- [ ] `.env` popolato con tutti i segreti (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_*`, `SSR_INTERNAL_TOKEN`)
- [ ] `PUBLIC_SITE_URL` coincide con il dominio servito dal gateway esterno
- [ ] `FRONTEND_RENDER_MODE=ssr`
- [ ] `NUXT_PUBLIC_ALLOW_INDEXING=true` (solo produzione)
- [ ] `CORS_ORIGIN` coincide col dominio pubblico
- [ ] Traefik Gateway inoltra il dominio a `VM:API_PORT` (default 3003)
- [ ] `./deploy.sh --yes` termina senza errori
- [ ] `/robots.txt`, `/sitemap.xml`, `/` rispondono 200 con contenuto valido
- [ ] Admin bootstrap effettuato (primo login → `/admin/setup`)
- [ ] Registrato il dominio su Google Search Console, inviata la sitemap
- [ ] Testato un post e un evento con Facebook Debugger e Twitter Card Validator
