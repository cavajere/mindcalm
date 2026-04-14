# Proposta di implementazione: Privacy informativa, consensi e campagne marketing (single-tenant)

## 1) Obiettivo e perimetro

Implementare in MindCalm un modulo completo per:

1. pubblicazione e versioning dell'informativa privacy,
2. raccolta consensi marketing granulari (yes/no esplicito),
3. subscribe pubblico con double opt-in opzionale,
4. unsubscribe granulare o totale,
5. campagne email basate su consensi attivi e versionati.

L'implementazione e' **single-tenant** (un solo brand applicativo), ma mantiene logiche enterprise di audit, compliance e storicizzazione.

---

## 2) Scelte architetturali per MindCalm

### 2.1 Moduli coinvolti

- **backend/**
  - nuove entita' Prisma + migrazioni SQL
  - nuovi route handler admin/public
  - nuovi service di dominio per versioning, subscribe, confirm, unsubscribe, campaigns
  - hardening sicurezza (token firmati, rate-limit, sanitizzazione)

- **admin/**
  - nuova area `Subscription Settings`
  - nuova area `Campaigns`

- **frontend/**
  - widget subscribe embeddabile
  - pagina privacy pubblica brandizzata
  - pagina unsubscribe preferences

### 2.2 Principi non negoziabili

- Versioning first: niente overwrite distruttivo del testo legale o delle formule.
- Coupling esplicito tra versione informativa e versioni formule.
- Re-consenso obbligatorio dopo publish di nuova versione.
- Consenso esplicito e granulare: ogni formula deve avere yes/no.
- Audit strutturato di tutte le operazioni sensibili.

---

## 3) Data model proposto (Prisma)

### 3.1 Nuove entita' principali

1. **SubscriptionPolicy** (singleton applicativo)
   - `id`, `status`, `currentVersionId`, `subscribeEnabled`, `subscribeConfirmEmail`

2. **SubscriptionPolicyVersion**
   - `id`, `subscriptionPolicyId`, `versionNumber`, `status(draft|published|archived)`, `publishedAt`, `previousVersionId`

3. **SubscriptionPolicyVersionTranslation**
   - `id`, `versionId`, `lang`, `title`, `html`, `plainTextSummary`
   - unique `(versionId, lang)`

4. **ConsentFormula**
   - `id`, `subscriptionPolicyId`, `code`, `required`, `status`, `currentVersionId`
   - unique `(subscriptionPolicyId, code)`

5. **ConsentFormulaVersion**
   - `id`, `consentFormulaId`, `subscriptionPolicyVersionId`, `versionNumber`, `status`, `publishedAt`, `previousVersionId`

6. **ConsentFormulaVersionTranslation**
   - `id`, `formulaVersionId`, `lang`, `title`, `text`
   - unique `(formulaVersionId, lang)`

7. **Contact**
   - `id`, `email(normalized)`, `status(active|suppressed)`, `suppressedAt`, `suppressionReason`

8. **Consent**
   - `id`, `contactId`, `consentFormulaId`, `consentFormulaVersionId`, `policyVersionId`
   - `value(YES|NO)`, `status(REGISTERED|CONFIRMED)`, `invalidatedAt`, `invalidationReason`
   - audit tecnico: `ipHash`, `userAgent`, `source(subscribe|unsubscribe|admin)`

9. **SubscriptionConfirmationToken**
   - token hash + expiry + consumedAt per double opt-in

10. **UnsubscribeToken**
    - token hash + expiry + consumedAt (one-time o multi-use configurabile)

11. **Campaign**
    - `id`, `name`, `subject`, `htmlBody`, `matchMode(ALL|ANY)`, `status`, `sentAt`, `createdByUserId`

12. **CampaignAudienceFilter**
    - per formula/versioni selezionate

13. **CampaignRecipient**
    - snapshot destinatari, stato invio, errore

14. **AuditLog esteso**
    - nuove action dedicate al dominio consensi/campagne

### 3.2 Indici chiave

- `Consent(contactId, consentFormulaId, invalidatedAt)`
- `Consent(consentFormulaVersionId, value, status, invalidatedAt)`
- `Contact(email)` unique case-insensitive
- `SubscriptionPolicyVersion(subscriptionPolicyId, versionNumber)` unique
- `ConsentFormulaVersion(consentFormulaId, versionNumber)` unique

---

## 4) Flussi di dominio critici

### 4.1 Publish nuova informativa

Transazione atomica:

1. validazione presenza draft policy version,
2. validazione traduzioni minime richieste,
3. publish `SubscriptionPolicyVersion` draft,
4. archive versione policy precedente,
5. publish tutte le `ConsentFormulaVersion` collegate alla draft policy version,
6. archive precedenti formula version correnti,
7. invalidazione consensi `YES` attivi precedenti (`superseded_by_new_version`),
8. aggiornamento puntatori `currentVersionId` su policy e formule,
9. audit event `CONSENT_POLICY_PUBLISHED`.

### 4.2 Subscribe pubblico

1. validazione policy pubblicata + subscribe abilitato,
2. validazione email,
3. validazione payload consensi (tutte le formule presenti, required=yes),
4. find-or-create `Contact`,
5. invalidazione consensi attivi precedenti per le formule coinvolte,
6. inserimento nuovi `Consent` su formula current version,
7. se double opt-in ON: status `REGISTERED` + token conferma,
8. se OFF: status `CONFIRMED` immediato,
9. audit event `SUBSCRIBE_SUBMITTED`.

### 4.3 Confirm subscription

1. validazione token,
2. transazione: `REGISTERED -> CONFIRMED`, consume token,
3. audit `SUBSCRIBE_CONFIRMED`.

### 4.4 Unsubscribe granulare/totale

1. validazione token,
2. carico consensi attivi,
3. per ogni revoca: invalidate `YES` attivo + crea nuovo `NO` confermato,
4. se revoke all: `Contact.status = SUPPRESSED` opzionale,
5. audit `UNSUBSCRIBE_UPDATED`.

---

## 5) API design proposta

## 5.1 Admin (autenticate)

- `GET /api/subscriptions/mine`
- `POST /api/subscriptions/:id/versions`
- `PUT /api/subscriptions/:id/versions/:versionId/translations`
- `POST /api/subscriptions/:id/versions/:versionId/publish`
- `POST /api/subscriptions/:id/versions/:versionId/archive`
- `DELETE /api/subscriptions/:id/versions/:versionId` (solo draft)
- `POST /api/subscriptions/:id/formulas`
- `PUT /api/subscriptions/:id/formulas/:formulaId`
- `DELETE /api/subscriptions/:id/formulas/:formulaId`
- `GET /api/campaigns/audience-options`
- `POST /api/campaigns/audience-preview`
- `POST /api/campaigns/send`

## 5.2 Public

- `GET /public-api/consent-formulas`
- `GET /public-api/privacy?lang=it`
- `POST /public-api/subscribe`
- `GET /public-api/confirm-subscription?token=...`
- `GET /public-api/unsubscribe?token=...`
- `POST /public-api/unsubscribe`

### 5.3 Errori dominio standard

- `CONSENT_POLICY_NOT_PUBLISHED`
- `CONSENT_PAYLOAD_INCOMPLETE`
- `REQUIRED_CONSENT_REJECTED`
- `CONFIRM_TOKEN_INVALID`
- `UNSUBSCRIBE_TOKEN_INVALID`
- `CAMPAIGN_AUDIENCE_EMPTY`
- `CAMPAIGN_POLICY_BLOCKED`

---

## 6) UI/UX proposta

## 6.1 Admin - Subscription Settings

- Tab: `Informativa`, `Consensi`, `Subscribe & Embed`
- Due colonne:
  - main editor (multilingua + preview)
  - sidebar (stato, versioni, timeline, azioni)
- CRUD formule con `required` toggle in sidebar
- Editor read-only quando manca draft
- Generatore snippet embed copy-to-clipboard

## 6.2 Admin - Campaigns

- Tab `Composer` / `History`
- Audience builder:
  - formule multi-select
  - versioni opzionali
  - match `ALL/ANY`
- Preview destinatari con selezione manuale
- Composer subject + html body + placeholder unsubscribe link

## 6.3 Frontend pubblico

- Widget subscribe: bottone -> modale
- Controllo binario esplicito Accept/Reject per ogni formula
- Link informativa sempre visibile
- A11y: focus trap, ESC close, restore focus
- Privacy page server-rendered brandizzata
- Unsubscribe page con keep/revoke e revoke-all

---

## 7) Sicurezza, compliance e audit

- Sanitizzazione HTML legale lato backend (whitelist tag/attributi).
- CSP strict con nonce per pagina privacy pubblica.
- Token firmati e con expiry per confirm/unsubscribe.
- Hash IP (`sha256(ip + pepper)`), mai salvataggio IP in chiaro.
- Rate-limit endpoint subscribe/confirm.
- Audit trail per publish, subscribe, confirm, unsubscribe, campaign send.

---

## 8) Piano implementativo incrementale (roadmap)

### Fase 1 - Fondazioni backend (3-4 gg)
- Prisma schema + migrazioni
- service dominio versioning
- endpoint admin base subscription

### Fase 2 - Public consent flows (3-4 gg)
- endpoint public subscribe/privacy/confirm/unsubscribe
- token service + rate limiting + audit
- test integrazione flussi core

### Fase 3 - Admin UI subscription (3-5 gg)
- pagine settings + i18n editor + formule
- publish/archive/delete draft actions

### Fase 4 - Campaign engine (4-6 gg)
- audience preview/sending
- policy checks + snapshot recipients
- history tab + status delivery

### Fase 5 - Public UX + hardening (2-4 gg)
- widget embed + unsubscribe page + privacy page
- A11y pass + CSP + security review

Durata totale indicativa: **15-23 giorni lavorativi**.

---

## 9) Strategia test minima

- Unit: validazioni consensi (required, completeness, schema)
- Integration: publish/versioning transaction
- Integration: subscribe with/without DOI
- Integration: confirm token lifecycle
- Integration: unsubscribe granular/revoke-all
- Integration: audience preview all/any con filtri versione
- E2E (admin + public) almeno happy-path principali

---

## 10) Gap e assunzioni

1. **Email provider**: assumo riuso dello stack SMTP gia' presente; valutare eventuale provider transazionale dedicato.
2. **Editor HTML legale**: assumo Tiptap gia' usato in admin; va limitata toolbar per minimizzare rischio XSS.
3. **Embed strategy**: assumo script hosted da `frontend` con endpoint `public-api` CORS-safe.
4. **Volume campagne**: se >50k destinatari/campagna, prevedere coda dedicata (BullMQ/SQS) e throttling.
5. **Compliance locale**: va validata con legale la tassonomia finale delle finalita' e i testi per lingua.

---

## 11) Prima vertical slice consigliata (MVP tecnico)

Per ridurre rischio, prima release con:

- 1 lingua (`it`) in produzione,
- publish/versioning completo,
- subscribe + double opt-in,
- unsubscribe totale (poi granulare nella release successiva),
- campagne solo match `ALL` con formule current version.

Questa slice consente di mettere in esercizio il nucleo compliance prima di estendere UX e segmentazione avanzata.
