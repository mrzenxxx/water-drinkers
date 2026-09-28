#!/usr/bin/env bash
# Выполнить команду на своей машине так, будто она работает с базой контура.
#
#   deploy/with-db.sh root@IP prod npx prisma migrate status
#   deploy/with-db.sh root@IP demo sh -c 'psql "$DATABASE_URL"'
#
# База наружу не открыта, поэтому скрипт поднимает SSH-туннель к её порту на
# localhost сервера и подставляет в окружение команды DATABASE_URL (под ролью
# контура), SESSION_SECRET и APP_URL этого контура из /opt/waterdrinkers/.env.
# Секреты живут только в окружении этого процесса и на диск не пишутся.
# Локальный .env команде не мешает: dotenv не перезаписывает уже заданные
# переменные.
#
# Команда выполняется в текущей папке. Чтобы её выполнил код ветки контура,
# а не рабочей копии, её запускают из checkout_ref (так делают ship.sh,
# credentials.sh и seed-mock.sh).

set -euo pipefail
. "$(dirname "$0")/lib.sh"

host=${1:?укажите сервер: root@IP}
contour=${2:?укажите контур: prod, demo или test}
shift 2
[ $# -gt 0 ] || { echo 'укажите команду' >&2; exit 2; }
contour_vars "$contour"

LOCAL_PORT=${LOCAL_PORT:-15432}
sock=$(mktemp -u "${TMPDIR:-/tmp}/wd-tunnel.XXXXXX")

password=$(remote_env "$host" "$C_PASSWORD_VAR")
secret=$(remote_env "$host" "$C_SECRET_VAR")
base=$(remote_env "$host" BASE_HOST)
[ -n "$password" ] && [ -n "$secret" ] && [ -n "$base" ] \
  || { echo "в $APP_DIR/.env на $host не хватает переменных контура $contour" >&2; exit 1; }

ssh -M -S "$sock" -fN -o ExitOnForwardFailure=yes -L "$LOCAL_PORT:127.0.0.1:5432" "$host"
trap 'ssh -S "$sock" -O exit "$host" 2>/dev/null || true' EXIT

DATABASE_URL="postgresql://$C_ROLE:$password@127.0.0.1:$LOCAL_PORT/$C_DB" \
SESSION_SECRET="$secret" \
APP_URL="https://$C_SUB.$base" \
  "$@"
