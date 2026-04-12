# Proposta concreta: codici invito self-service con verifica email

## Obiettivo

Introdurre un nuovo flusso di onboarding per utenti `STANDARD` in cui:

- l'admin genera un codice invito di 7 caratteri
- il codice definisce in anticipo la durata della licenza
- l'utente si registra autonomamente dal portale pubblico
- l'email deve essere verificata prima dell'attivazione finale
- la scadenza della licenza viene calcolata dalla data/ora di attivazione

Il flusso attuale "admin crea utente + invito con token" resta disponibile e separato.

## Principi di progetto

- Non riusare `User` come contenitore di registrazioni incomplete.
- Non riusare `inviteTokenHash` per i codici invito: il modello attuale rappresenta un invito verso un utente gia' esistente.
- Creare entita' dedicate per:
  - codice invito/licenza
  - registrazione in attesa di verifica email
- Consumare il codice solo dopo verifica email completata.
- Mantenere audit trail esplicito di tutti i passaggi sensibili.

## Regole funzionali

### Codice invito

- Formato: 7 caratteri, solo maiuscoli.
- Alfabeto consentito: `A-Z` esclusa `O`, cifre `1-9` escluse `0`.
- Esempio valido: `G6K39C2`.
- Codice monouso.
- Un codice definisce:
  - durata licenza
  - eventuale data di scadenza del codice stesso
  - stato (`ACTIVE`, `REDEEMED`, `EXPIRED`, `DISABLED`)
  - admin creatore

### Durata licenza

Consiglio pratico:

- salvare la durata in giorni (`licenseDurationDays`)

Motivo:

- evita ambiguita' tra "1 mese" e "30 giorni"
- semplifica backend, UI, test e audit
- consente comunque preset admin come `30`, `90`, `180`, `365`

Calcolo suggerito:

- `licenseStartsAt = momento di conferma email`
- `licenseExpiresAt = licenseStartsAt + licenseDurationDays`

Se si vuole una UX "fino a fine giornata", allora si puo' normalizzare la scadenza a `23:59:59.999` del giorno finale. Va deciso una volta e mantenuto coerente in tutta l'app.

### Registrazione utente

Campi minimi:

- nome
- cognome
- email
- telefono
- password
- codice invito

Campi opzionali:

- note: no, da tenere admin-only

### Verifica email

Flusso consigliato:

1. L'utente invia il form di registrazione con codice invito.
2. Il backend valida formato e disponibilita' del codice.
3. Il backend crea una registrazione pendente, non un utente definitivo.
4. Il backend invia email con link di verifica.
5. L'utente clicca il link.
6. In una transazione:
   - si ricontrolla che il token email sia valido
   - si ricontrolla che il codice invito sia ancora valido e non usato
   - si crea `User`
   - si calcola `licenseExpiresAt`
   - si marca il codice come `REDEEMED`
   - si marca la registrazione come `VERIFIED/COMPLETED`

## Modello dati proposto

### Nuova tabella `invite_codes`

Campi proposti:

- `id` UUID
- `code` string unique
- `licenseDurationDays` int
- `maxRedemptions` int default `1`
- `redemptionsCount` int default `0`
- `status` enum: `ACTIVE | REDEEMED | EXPIRED | DISABLED`
- `expiresAt` datetime nullable
- `redeemedAt` datetime nullable
- `redeemedByUserId` UUID nullable
- `createdByUserId` UUID nullable
- `notes` text nullable
- `createdAt`
- `updatedAt`

Note:

- anche se ora il codice e' monouso, `maxRedemptions` e `redemptionsCount` rendono il modello estendibile.
- `code` puo' essere salvato in chiaro per utilizzo operativo lato admin; se si vuole una postura piu' rigida si puo' aggiungere anche `codeHash`, ma per questo caso non e' indispensabile.

### Nuova tabella `pending_registrations`

Campi proposti:

- `id` UUID
- `inviteCodeId` UUID
- `email` string
- `passwordHash` string
- `firstName` string
- `lastName` string
- `phone` string
- `verificationTokenHash` string
- `verificationExpiresAt` datetime
- `verifiedAt` datetime nullable
- `status` enum: `PENDING | VERIFIED | CANCELLED | EXPIRED`
- `createdAt`
- `updatedAt`

Vincoli consigliati:

- indice su `email`
- indice su `verificationTokenHash`
- vincolo unico opzionale su `(email, status='PENDING')` gestito applicativamente

### Estensione `AuditAction`

Nuovi eventi consigliati:

- `INVITE_CODE_CREATED`
- `INVITE_CODE_DISABLED`
- `INVITE_CODE_REDEEMED`
- `REGISTRATION_STARTED`
- `REGISTRATION_VERIFICATION_SENT`
- `REGISTRATION_VERIFIED`
- `REGISTRATION_FAILED`

## Prisma: shape proposta

Schema indicativo:

```prisma
model InviteCode {
  id                 String           @id @default(uuid())
  code               String           @unique
  licenseDurationDays Int
  maxRedemptions     Int              @default(1)
  redemptionsCount   Int              @default(0)
  status             InviteCodeStatus @default(ACTIVE)
  expiresAt          DateTime?
  redeemedAt         DateTime?
  redeemedByUserId   String?
  redeemedByUser     User?            @relation("InviteCodeRedeemer", fields: [redeemedByUserId], references: [id], onDelete: SetNull)
  createdByUserId    String?
  createdByUser      User?            @relation("InviteCodeCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  notes              String?
  pendingRegistrations PendingRegistration[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([status, createdAt])
  @@index([expiresAt])
  @@map("invite_codes")
}

model PendingRegistration {
  id                    String                    @id @default(uuid())
  inviteCodeId          String
  inviteCode            InviteCode                @relation(fields: [inviteCodeId], references: [id], onDelete: Restrict)
  email                 String
  passwordHash          String
  firstName             String
  lastName              String
  phone                 String
  verificationTokenHash String                    @unique
  verificationExpiresAt DateTime
  verifiedAt            DateTime?
  status                PendingRegistrationStatus @default(PENDING)
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  @@index([email, status])
  @@index([verificationExpiresAt])
  @@map("pending_registrations")
}

enum InviteCodeStatus {
  ACTIVE
  REDEEMED
  EXPIRED
  DISABLED
}

enum PendingRegistrationStatus {
  PENDING
  VERIFIED
  CANCELLED
  EXPIRED
}
```

Nota:

- `User` andra' esteso con le relazioni inverse solo se utili per Prisma. Il ruolo resta `STANDARD` per questo flusso.

## API backend proposta

### Admin

#### `GET /api/v1/admin/invite-codes`

Lista con filtri:

- `status`
- `search`
- `page`
- `limit`

Ritorna:

- codice
- durata
- stato
- scadenza codice
- creatore
- data creazione
- utente che l'ha riscattato

#### `POST /api/v1/admin/invite-codes`

Body:

```json
{
  "licenseDurationDays": 365,
  "expiresAt": "2026-06-30T23:59:59.999Z",
  "notes": "Campagna primavera"
}
```

Comportamento:

- genera il codice lato backend
- salva il record
- restituisce il codice in chiaro una sola volta nella response

Response:

```json
{
  "id": "uuid",
  "code": "G6K39C2",
  "licenseDurationDays": 365,
  "status": "ACTIVE",
  "expiresAt": "2026-06-30T23:59:59.999Z"
}
```

#### `POST /api/v1/admin/invite-codes/:id/disable`

Disabilita un codice non ancora usato.

#### `GET /api/v1/admin/invite-codes/:id`

Dettaglio singolo codice con dati di utilizzo.

### Pubblico

#### `POST /api/v1/auth/validate-invite-code`

Body:

```json
{
  "code": "G6K39C2"
}
```

Ritorna solo metadati non sensibili:

```json
{
  "valid": true,
  "licenseDurationDays": 365
}
```

Serve per UX del form, ma non sostituisce la validazione finale.

#### `POST /api/v1/auth/register-with-invite-code`

Body:

```json
{
  "code": "G6K39C2",
  "email": "utente@example.com",
  "firstName": "Mario",
  "lastName": "Rossi",
  "phone": "+39 333 1234567",
  "password": "Password123!"
}
```

Comportamento:

- valida campi
- verifica che l'email non esista gia' in `User`
- verifica che il codice sia attivo
- invalida eventuale registrazione pendente precedente per la stessa email
- crea `PendingRegistration`
- invia email di verifica
- non consuma ancora il codice

Response:

```json
{
  "message": "Controlla la tua email per completare la registrazione"
}
```

#### `GET /api/v1/auth/registration-verification-details?token=...`

Opzionale ma utile per la view di conferma. Ritorna:

- email mascherata o completa
- stato token
- scadenza

#### `POST /api/v1/auth/verify-registration`

Body:

```json
{
  "token": "..."
}
```

Comportamento:

- usa transazione DB
- crea utente `STANDARD`
- imposta `isActive = true`
- calcola `licenseExpiresAt`
- marca codice come usato
- invalida altre registrazioni pendenti compatibili
- emette cookie/sessione utente app

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "utente@example.com",
    "name": "Mario Rossi",
    "role": "STANDARD"
  }
}
```

## UI admin proposta

### Nuova vista `Codici invito`

Elementi:

- tabella con codice, durata, stato, scadenza codice, creato il, riscattato da
- pulsante `Nuovo codice`
- badge stato
- azione `Disabilita`
- azione `Copia codice`

### Form creazione codice

Campi:

- durata licenza in giorni
- scadenza codice opzionale
- note interne opzionali

Preset rapidi:

- `30 giorni`
- `90 giorni`
- `180 giorni`
- `365 giorni`

Dopo la creazione:

- mostra il codice in evidenza
- pulsante `Copia`
- testo breve per l'admin: "Condividi questo codice con l'utente. L'utente dovra' verificare la propria email."

### Convivenza con la UI utenti esistente

Nella gestione utenti attuale:

- mantenere il flusso "crea utente + invia invito"
- aggiungere link di navigazione alla nuova sezione "Codici invito"
- evitare di mischiare i due concetti nello stesso form utente

## UI frontend proposta

### Nuova route pubblica

- `/register`

Form:

- nome
- cognome
- email
- telefono
- password
- conferma password
- codice invito

Comportamenti:

- validazione immediata
- opzionalmente verifica asincrona del codice
- submit con messaggio neutro di controllo email

### Nuova route pubblica

- `/verify-registration`

View con tre stati:

- token valido: pulsante `Conferma registrazione`
- token gia' usato/scaduto: messaggio chiaro
- successo: login automatico e redirect alla home

## Sicurezza

### Generazione codice

Funzione dedicata, esempio:

- alfabeto: `ABCDEFGHIJKLMNPQRSTUVWXYZ123456789`
- lunghezza: `7`
- generazione con `crypto.randomInt`

### Collisioni

Gestione:

- genera
- tenta insert su vincolo unique
- se collide, rigenera

Con 34 simboli e 7 caratteri ci sono `34^7 = 52.523.350.144` combinazioni, quindi il rischio pratico di collisione e' basso.

### Rate limiting

Aggiungere rate limiter dedicati per:

- `POST /api/v1/auth/validate-invite-code`
- `POST /api/v1/auth/register-with-invite-code`
- `POST /api/v1/auth/verify-registration`

Suggerimento:

- piu' stretti del `publicRateLimiter` generico

### Messaggi di errore

Per il form pubblico:

- evitare enumerazione eccessiva su email esistente
- mantenere messaggi chiari ma non troppo rivelatori

Esempio:

- bene: `Registrazione non disponibile con i dati forniti`
- meglio per UX controllata: distinguere `email gia' registrata` solo dopo aver valutato il rischio

### Consistenza transazionale

La verifica finale deve essere in transazione per evitare:

- doppio riscatto dello stesso codice
- doppia creazione utente
- codice marcato usato senza creazione utente

## Compatibilita' con il codice attuale

Resta invariato:

- login app esistente
- controllo licenza esistente
- reset password
- inviti verso utenti gia' creati

Da estendere:

- `config` per scadenza token verifica registrazione
- `validators` per nuovi endpoint
- `auditLogService` per nuove azioni
- router frontend pubblico
- admin navigation

## Config proposta

In `backend/src/config.ts` aggiungere:

```ts
registration: {
  verificationExpiresInHours: parseInt(process.env.REGISTRATION_VERIFICATION_EXPIRES_IN_HOURS || '24', 10),
}
```

E in `.env.example`:

```env
REGISTRATION_VERIFICATION_EXPIRES_IN_HOURS=24
```

## Piano di implementazione consigliato

### Fase 1

- migration Prisma
- nuovi enum
- nuovi model
- generator codice
- servizi backend per codici e pending registration

### Fase 2

- endpoint admin per creare/listare/disabilitare codici
- audit trail
- test unit/integration backend

### Fase 3

- endpoint pubblici di registrazione e verifica email
- template email verifica
- rate limiting dedicato

### Fase 4

- UI admin `Codici invito`
- UI frontend `Register` e `Verify registration`

### Fase 5

- rifiniture UX
- documentazione
- eventuale pulizia automatica di `pending_registrations` scadute

## Test da prevedere

Backend:

- genera codice conforme al charset richiesto
- collision retry su codice duplicato
- non consuma codice in fase di submit registrazione
- consuma codice solo in fase di verifica email
- non permette doppio riscatto
- blocca codice scaduto/disabilitato
- blocca email gia' esistente
- calcola `licenseExpiresAt` correttamente
- audit log emesso nei punti chiave

Frontend:

- form registrazione con errori client
- stato "email inviata"
- verifica token valido/scaduto
- redirect dopo successo

## Decisioni consigliate

Per evitare ambiguita' in sviluppo, propongo di fissare da subito queste scelte:

1. Codice monouso.
2. Durata licenza espressa in giorni.
3. Codice consumato solo dopo verifica email.
4. Flusso nuovo separato dal flusso invito esistente.
5. Nuova sezione admin dedicata ai codici invito.

## Note finali

Questa soluzione e' pulita perche':

- non forza utenti "mezzi creati" dentro `admin_users`
- mantiene semplice la logica licenze esistente
- non rompe il flusso di invito gia' in produzione
- apre spazio a evoluzioni future come codici multiuso, campagne, partner, batch di codici
