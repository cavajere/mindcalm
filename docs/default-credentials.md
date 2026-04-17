# Credenziali di default

## Bootstrap admin (prima installazione)

Credenziali temporanee lette da `.env` (variabili `ADMIN_EMAIL` / `ADMIN_PASSWORD`) e usate dal meccanismo di bootstrap admin (`backend/src/services/bootstrapAdminService.ts`).

| Campo    | Valore              |
|----------|---------------------|
| Email    | `admin@admin.com`   |
| Password | `admin`             |

### Quando valgono

Solo finché **non esiste alcun utente con `role=ADMIN` e `isActive=true`** nel database. Appena viene creato il primo admin reale (tramite `POST /api/auth/bootstrap/setup`), queste credenziali smettono automaticamente di funzionare e il token JWT bootstrap viene rifiutato dal middleware.

### Note

- Nessun record viene scritto in DB: l'identità bootstrap è virtuale (`id='bootstrap-admin'`).
- Il confronto email/password è `timingSafeEqual`.
- In produzione vanno sostituite con valori forti in `docker/production-notraefik/.env`.

## Utente STANDARD seedato

Creato/aggiornato dallo script di seed produzione (`docker/production-notraefik/seed.sh --admin`) insieme all'admin reale.

| Campo    | Valore                      |
|----------|-----------------------------|
| Email    | `enrico.lanni@gmail.com`    |
| Password | `Alt53255!`                 |
| Ruolo    | `STANDARD`                  |

## Admin login locale (dev)

In ambiente di sviluppo, dopo `npx tsx prisma/seed.ts` il seed crea un admin reale con le credenziali sopra — al login viene usato quello, non il bootstrap.

- URL admin dev: http://localhost:5474/admin/
