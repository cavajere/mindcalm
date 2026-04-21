# =============================================================================
# MindCalm — Multi-stage Dockerfile per produzione
# =============================================================================

# Stage 1: deps — installa tutte le dipendenze
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
COPY packages/design-tokens/ ./packages/design-tokens/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY admin/package*.json ./admin/
COPY frontend-ssr/package*.json ./frontend-ssr/
COPY backend/prisma/schema.prisma ./backend/prisma/

RUN npm ci

# Stage 2: builder — build frontend + admin
FROM deps AS builder
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY admin/ ./admin/

# Genera Prisma client
RUN npx prisma generate --schema=./backend/prisma/schema.prisma

# Build frontend PWA
RUN npm run build --workspace=frontend

# Build admin panel
RUN npm run build --workspace=admin

# Compila backend TypeScript
RUN npm run build --workspace=backend

# Stage 3: prod — immagine di produzione minimale
FROM node:20-slim AS prod
LABEL org.opencontainers.image.title="MindCalm"
LABEL org.opencontainers.image.description="Mindfulness PWA Platform"

RUN apt-get update && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

WORKDIR /app

# Copia package.json per installazione produzione
COPY package.json package-lock.json ./
COPY packages/design-tokens/ ./packages/design-tokens/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY admin/package.json ./admin/
COPY frontend-ssr/package.json ./frontend-ssr/
COPY backend/prisma/schema.prisma ./backend/prisma/

# Installa solo dipendenze di produzione del backend
RUN npm ci --omit=dev --workspace=backend --include-workspace-root=false && npm cache clean --force

# Copia backend compilato
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copia frontend build nel backend public
COPY --from=builder /app/frontend/dist ./backend/dist/public
COPY --from=builder /app/admin/dist ./backend/dist/public/admin

# Genera Prisma client per produzione
WORKDIR /app/backend
RUN npx prisma generate --schema=./prisma/schema.prisma

# Crea directory storage (default + /data per bind mounts)
RUN mkdir -p /app/backend/storage/audio /app/backend/storage/hls /app/backend/storage/images \
             /data/audio /data/hls /data/images /data/backups && \
    chown -R appuser:appgroup /app /data

COPY docker/production/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
