# MindCalm — AI Guidelines

## Project overview

MindCalm is a Progressive Web App (PWA) for mindfulness sessions. Serves audio content (guided meditations, breathing exercises, body scan) and text content (articles, guides). Includes an admin panel for content management.

## Architecture

- **Monorepo**: npm workspaces with 3 packages: `backend`, `frontend`, `admin`
- **Backend**: Express.js + TypeScript + Prisma ORM + PostgreSQL 15
- **Frontend PWA**: Vue 3 + Vite + Tailwind CSS + Pinia + vite-plugin-pwa
- **Admin**: Vue 3 + Vite + Tailwind CSS + Tiptap editor
- **Auth**: JWT (stateless, 1h expiry) for admin only. Public API has no auth.
- **Storage**: Local filesystem with UUID naming for audio/images
- **Deployment**: Docker on Synology NAS behind traefik-gateway at mindcalm.datagestio.com (port 3003)

## Key patterns

- Public API: `/api/v1/sessions`, `/api/v1/articles`, `/api/v1/categories` — no auth
- Admin API: `/api/v1/admin/*` — JWT required (Bearer token)
- Auth: `/api/v1/auth/login`, `/api/v1/auth/me`
- Audio streaming: `/api/v1/sessions/:id/audio` with range request support
- File serving: `/api/v1/files/images/:filename`
- In production, Express serves frontend at `/` and admin at `/admin/`
- Prisma migrations: `cd backend && npx prisma migrate dev`

## Conventions

- Backend in TypeScript (compiled with tsc, dev with tsx)
- Frontend/Admin in TypeScript with Vue 3 Composition API + `<script setup>`
- API response format: `{ data: [...], pagination: { page, limit, total, totalPages } }`
- Error format: `{ error: "message", details: {} }`
- Italian as primary UI language
- Colors: primary #4A90D9, secondary #50B860, accent #E8A040

## Development

```
cd docker/development && docker compose up -d
cd ../..
npm install
cp .env.example .env
cd backend && npx prisma migrate dev && npx tsx prisma/seed.ts && cd ..
npm run dev:start
```

- Frontend: http://localhost:5473
- Admin: http://localhost:5474/admin/
- API: http://localhost:3300
- PostgreSQL: localhost:5435
- Admin login: admin@mindcalm.com / admin123!

### Port allocation (no conflicts with other projects)

| Service | Datagestio | Altavolo | Localo | MindCalm |
|---|---|---|---|---|
| API | 3000 | 3100 | 3200 | **3300** |
| Frontend | 5173 | 5273 | 5373 | **5473** |
| Admin | 5174 | 5274 | 5374 | **5474** |
| PostgreSQL | 5432 | 5433 | 5434 | **5435** |

## Important files

- `backend/prisma/schema.prisma` — Database models
- `backend/src/index.ts` — Express server entry point
- `backend/src/config.ts` — Environment variables
- `backend/src/routes/` — API routes (public/ and admin/)
- `frontend/src/stores/playerStore.ts` — Audio player state
- `frontend/src/composables/useAudio.ts` — HTML5 Audio logic
- `frontend/vite.config.ts` — PWA configuration
- `docker/production/Dockerfile` — Multi-stage production build
- `docker/production-synology/docker-compose.yml` — Production deployment
