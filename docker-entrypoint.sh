#!/bin/sh
set -eu

# En Docker la contraseña puede tener caracteres especiales: construimos la URL
# con encodeURIComponent, igual que en XyonWork/Puchero.
if [ -z "${DATABASE_URL:-}" ]; then
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD es obligatorio}"
  ENCODED_PASSWORD=$(node -e "process.stdout.write(encodeURIComponent(process.env.POSTGRES_PASSWORD || ''))")
  export DATABASE_URL="postgresql://${POSTGRES_USER:-pulso}:${ENCODED_PASSWORD}@${POSTGRES_HOST:-db}:5432/${POSTGRES_DB:-pulso}?schema=public"
fi

echo "[pulso] Aplicando migraciones de Prisma…"
npx prisma migrate deploy

echo "[pulso] Arrancando API…"
exec node dist/server.js
