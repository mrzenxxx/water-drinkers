#!/usr/bin/env bash
# Копия базы. Запускается cron'ом на сервере (server-setup.sh) и вручную
# перед любым рискованным шагом: перед переносом дампа, перед миграцией.
#
# Журнал операций неизменяем (CLAUDE.md, правило 4) — исправить ошибку в
# нём можно, а восстановить потерянную базу нельзя ничем, кроме копии.
# Копии лежат на том же сервере: от ошибки спасают, от гибели машины — нет.
# Время от времени их стоит забирать к себе (README, «Резервные копии»).

set -euo pipefail

APP_DIR=/opt/waterdrinkers
BACKUP_DIR=/var/backups/waterdrinkers
KEEP_DAYS=14

stamp=$(date +%Y-%m-%d_%H%M)
out="$BACKUP_DIR/waterdrinkers_$stamp.dump"

cd "$APP_DIR"
if [ -z "$(docker compose ps --status running -q db)" ]; then
  echo "$(date -Is) база не запущена — копия не снята" >&2
  exit 1
fi

# Недописанный файл не должен выглядеть копией: он удаляется при любой ошибке.
trap 'rm -f "$out.partial"' EXIT
docker compose exec -T db pg_dump -U waterdrinkers -d waterdrinkers --format=custom > "$out.partial"
mv "$out.partial" "$out"
chmod 600 "$out"

find "$BACKUP_DIR" -name 'waterdrinkers_*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) $out $(du -h "$out" | cut -f1)"
