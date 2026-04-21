# MindCalm — Migrazione architetturale verso SSR (Nuxt)

## Obiettivo
Portare la parte pubblica di MindCalm da SPA a un modello SEO-first SSR, mantenendo un rollback rapido verso SPA.

---

## Architettura finale adottata

### 1) Frontend pubblico SSR separato
- Nuovo workspace `frontend-ssr` basato su **Nuxt 3**.
- Rendering server-side delle pagine pubbliche.
- Endpoint SEO applicativi inclusi nel runtime Nuxt:
  - `/healthz`
  - `/robots.txt`
  - `/sitemap.xml`

### 2) Backend API come gateway applicativo
- Il backend Express mantiene API/admin e file statici amministrativi.
- In produzione, per il pubblico:
  - `FRONTEND_RENDER_MODE=ssr` → proxy verso runtime Nuxt (`FRONTEND_SSR_ORIGIN`)
  - `FRONTEND_RENDER_MODE=spa` → fallback al frontend statico legacy
- Il proxy inoltra solo richieste pubbliche `GET/HEAD` ed esclude prefissi API/admin.

### 3) Deployment containerizzato con servizio SSR dedicato
- Aggiunto un container `frontend-ssr` dedicato nel compose produzione (notraefik).
- L'API dipende dallo stato healthy di `frontend-ssr`.
- Healthcheck container SSR basato su `/healthz`.

### 4) Strategia di cutover e rollback
- **Cutover**: impostare `FRONTEND_RENDER_MODE=ssr` e deployare stack.
- **Rollback**: impostare `FRONTEND_RENDER_MODE=spa` e redeploy.
- Nessun cambio schema DB necessario per il passaggio di rendering.

---

## Flusso richieste (runtime)

### Modalità SSR
1. Client richiede `GET /posts/...` (o altra route pubblica).
2. API riceve la richiesta.
3. API proxy-forward verso `frontend-ssr`.
4. Nuxt SSR renderizza HTML e risponde.
5. API ritorna la risposta al client.

### Modalità SPA (fallback)
1. Client richiede route pubblica.
2. API serve `index.html` del frontend legacy.
3. Hydration e routing client-side come prima.

---

## Controlli operativi aggiunti

### Deploy script hardening
- Validazione config frontend (`FRONTEND_RENDER_MODE` ammesso: `ssr|spa`).
- In SSR richiede `PUBLIC_SITE_URL`.
- Diagnostica estesa su errori (`api`, `frontend-ssr`, `postgres`).
- Verifiche post deploy in SSR:
  - `/api/health`
  - `/`
  - `/robots.txt`
  - `/sitemap.xml`
  - reachability interna API → `frontend-ssr:3000/healthz`

### Smoke test ripetibile
- Script `docker/production-notraefik/smoke-check.sh`.
- Usa `.env` locale e testa endpoint base in base alla modalità (`ssr` vs `spa`).

---

## Impatto architetturale

### Vantaggi
- SEO migliorata (HTML SSR + sitemap/robots nativi).
- Separazione netta tra runtime pubblico SSR e backend API.
- Rollback veloce senza refactor del dominio backend.
- Osservabilità e verifiche deploy più robuste.

### Trade-off
- Un servizio/container in più da gestire.
- Deploy leggermente più articolato (coordinamento API + frontend-ssr).

---

## Hardening SEO post-migrazione

Layer aggiuntivi implementati sopra il baseline SSR iniziale:

- `<html lang="it">` via `app.head.htmlAttrs`.
- `titleTemplate` intelligente in `app.vue` per evitare titoli duplicati ("MindCalm · MindCalm").
- Composable `useSeoDefaults` che imposta canonical, `og:url`, `og:image`, `og:site_name`, `twitter:card` in modo uniforme. Le pagine di dettaglio usano la cover del contenuto come OG image, le altre cadono sul favicon.
- Sitemap paginata sull'intero catalogo (`/api/posts`, `/api/audio`, `/api/events`) con `<lastmod>` e cache header.
- `robots.txt` e meta `robots` condizionati dal flag `NUXT_PUBLIC_ALLOW_INDEXING` (impostare a `false` in staging/preview).
- HTML dei contenuti (`body` di post ed eventi, privacy, termini) passa da `sanitize-html` prima di essere iniettato via `v-html`.
- Backend: `publicRateLimiter` accetta un token interno (`SSR_INTERNAL_TOKEN`) che il container Nuxt inietta come `x-internal-ssr-token` sulle chiamate server-to-server; evita il falso-positivo di rate limit quando tutto il traffico SSR arriva dall'IP del container frontend.
- `deploy.sh`: oltre a verificare lo status, effettua un check di contenuto sul body di `/`, `/robots.txt` e `/sitemap.xml` per intercettare shell vuote che rispondono 200.

## Deliberatamente non adottato: moduli `@nuxtjs/sitemap` / `@nuxtjs/robots`

I moduli ufficiali offrono funzionalità utili (multi-sitemap index, image/news sitemap, hreflang, generatori dinamici). Per lo stato attuale di MindCalm (sito monolingua italiano, catalogo sotto i 10k URL, niente `hreflang` né sitemap immagini per ora) l'implementazione a mano sotto `server/routes/` è più semplice e più esplicita. Il passaggio ai moduli ufficiali resta una opzione raccomandata quando si verificherà almeno una delle seguenti condizioni:

- introduzione di multilingua con `hreflang`;
- superamento dei 10k URL indicizzati (split in sitemap index);
- necessità di image sitemap dedicate per le cover;
- esigenza di route discovery automatica basata sul filesystem Nuxt.

## Stato
Migrazione architetturale SSR **implementata** per:
- runtime applicativo,
- toggle SSR/SPA,
- deploy notraefik,
- healthcheck e smoke checks (status + content),
- hardening SEO (canonical, OG, sitemap paginata, robots env-driven, sanitize HTML),
- rate limit bypass per traffico interno SSR,
- documentazione operativa.

