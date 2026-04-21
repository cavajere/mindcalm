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

## Stato
Migrazione architetturale SSR **implementata** per:
- runtime applicativo,
- toggle SSR/SPA,
- deploy notraefik,
- healthcheck e smoke checks,
- documentazione operativa.

