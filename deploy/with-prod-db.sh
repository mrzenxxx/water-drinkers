#!/usr/bin/env bash
# Выполнить команду на своей машине так, будто она работает с боевой базой.
#
#   deploy/with-prod-db.sh root@IP npx prisma migrate deploy
#   deploy/with-prod-db.sh root@IP npm run credentials -- e.kondobarov
#   deploy/with-prod-db.sh root@IP sh -c 'pg_restore -d "$DATABASE_URL" ...'
#
# База наружу не открыта, поэтому скрипт поднимает SSH-туннель к её порту на
# localhost сервера и подставляет в окружение команды боевые DATABASE_URL,
# SESSION_SECRET и APP_URL из /opt/waterdrinkers/.env. Секреты живут только
# в окружении этого процесса и на диск машины разработчика не пишутся.
# Локальный .env команде не мешает: dotenv не перезаписывает уже заданные
# переменные.

set -euo pipefail

host=${1:?укажите сервер: root@IP}
shift
[ $# -gt 0 ] || { echo 'укажите команду' >&2; exit 2; }

LOCAL_PORT=${LOCAL_PORT:-15432}
sock=$(mktemp -u "${TMPDIR:-/tmp}/wd-tunnel.XXXXXX")

remote_env() {
  ssh "$host" "grep -E '^$1=' /opt/waterdrinkers/.env | head -1 | cut -d= -f2-"
}

pg_password=$(remote_env POSTGRES_PASSWORD)
session_secret=$(remote_env SESSION_SECRET)
site_host=$(remote_env SITE_HOST)
[ -n "$pg_password" ] && [ -n "$session_secret" ] && [ -n "$site_host" ] \
  || { echo "в /opt/waterdrinkers/.env на $host не хватает переменных" >&2; exit 1; }

ssh -M -S "$sock" -fN -o ExitOnForwardFailure=yes -L "$LOCAL_PORT:127.0.0.1:5432" "$host"
trap 'ssh -S "$sock" -O exit "$host" 2>/dev/null || true' EXIT

DATABASE_URL="postgresql://waterdrinkers:$pg_password@127.0.0.1:$LOCAL_PORT/waterdrinkers" \
SESSION_SECRET="$session_secret" \
APP_URL="https://$site_host" \
  "$@"
