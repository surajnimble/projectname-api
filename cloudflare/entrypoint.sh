#!/bin/sh
set -eu

echo "[entrypoint] applying database migrations"
attempt=1
until ./node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 5 ]; then
    echo "[entrypoint] migrations failed after $attempt attempts" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  echo "[entrypoint] migration attempt failed; retrying in 5s" >&2
  sleep 5
done

echo "[entrypoint] seeding an empty database"
./node_modules/.bin/tsx scripts/seed-if-empty.ts

echo "[entrypoint] starting the API"
exec node dist/server.js
