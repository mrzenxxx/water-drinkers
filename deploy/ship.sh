#!/usr/bin/env bash
# Выкладка текущего коммита на сервер. Запускается с машины разработчика
# из корня репозитория:
#
#   deploy/ship.sh root@IP
#
# Шаги: сборка образа под linux/amd64 → копия базы → перенос образа и
# конфигов → миграции → перезапуск приложения → проверка снаружи.
# Предыдущий образ остаётся под тегом `previous` для отката (README).

set -euo pipefail

host=${1:?укажите сервер: root@IP}
APP_DIR=/opt/waterdrinkers
here=$(cd "$(dirname "$0")" && pwd)

cd "$here/.."

if [ -n "$(git status --porcelain)" ]; then
  # Сборка берёт файлы с диска, а тег образа — от коммита: с правками
  # в дереве тег врал бы о том, что на самом деле выложено.
  echo 'В рабочем дереве есть незакоммиченные изменения. Закоммитьте их или уберите.' >&2
  exit 1
fi
tag=$(git rev-parse --short HEAD)
echo "==> Выкладываю $(git log --oneline -1)"

echo '==> Сборка образа'
docker buildx build --platform linux/amd64 -t "waterdrinkers:$tag" --load .

echo '==> Конфигурация на сервер'
ssh "$host" "test -f $APP_DIR/.env" \
  || { echo "на сервере нет $APP_DIR/.env — см. README, «Первый запуск»" >&2; exit 1; }
scp -q "$here/compose.yml" "$here/Caddyfile" "$here/backup.sh" "$host:$APP_DIR/"
ssh "$host" "chmod +x $APP_DIR/backup.sh"

echo '==> Копия базы перед выкладкой'
ssh "$host" "cd $APP_DIR && docker compose up -d --wait db && ./backup.sh"

echo '==> Перенос образа (сжатый, по SSH)'
docker save "waterdrinkers:$tag" | gzip | ssh "$host" 'gunzip | docker load'

echo '==> Миграции'
"$here/with-prod-db.sh" "$host" npx prisma migrate deploy

echo '==> Перезапуск'
ssh "$host" "set -e
  cd $APP_DIR
  if docker image inspect waterdrinkers:latest >/dev/null 2>&1; then
    docker tag waterdrinkers:latest waterdrinkers:previous
  fi
  docker tag waterdrinkers:$tag waterdrinkers:latest
  docker compose up -d --wait
  # Образы прошлых выкладок: остаются только latest и previous.
  docker images waterdrinkers --format '{{.Tag}}' | grep -vxE 'latest|previous' \\
    | xargs -r -I{} docker rmi waterdrinkers:{} >/dev/null
  docker image prune -f >/dev/null"

site=$(ssh "$host" "grep -E '^SITE_HOST=' $APP_DIR/.env | cut -d= -f2-")
echo "==> Проверка https://$site/login"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$site/login")
if [ "$code" = 200 ]; then
  echo "Готово: https://$site ($tag)"
else
  echo "Страница входа ответила $code — смотрите: ssh $host 'cd $APP_DIR && docker compose logs --tail=100 app caddy'" >&2
  exit 1
fi
