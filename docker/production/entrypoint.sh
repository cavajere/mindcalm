#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Setting up storage directory permissions..."

APP_UID=$(id -u appuser 2>/dev/null || echo 1001)
APP_GID=$(id -g appuser 2>/dev/null || echo 1001)

AUDIO_DIR="${AUDIO_STORAGE_PATH:-/app/backend/storage/audio}"
HLS_DIR="${HLS_STORAGE_PATH:-/app/backend/storage/hls}"
IMAGES_DIR="${IMAGES_STORAGE_PATH:-/app/backend/storage/images}"
BACKUP_DIR="${BACKUP_STORAGE_PATH:-/app/backend/storage/backups}"

for DIR in "$AUDIO_DIR" "$HLS_DIR" "$IMAGES_DIR" "$BACKUP_DIR"; do
  mkdir -p "$DIR"
  chown "$APP_UID:$APP_GID" "$DIR" 2>/dev/null || chmod 777 "$DIR" 2>/dev/null || true
done

echo "[entrypoint] Starting application as appuser..."

if command -v gosu >/dev/null 2>&1; then
    exec gosu appuser "$@"
else
    exec su -s /bin/sh -c "exec $*" appuser
fi
