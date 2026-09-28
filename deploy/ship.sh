#!/usr/bin/env bash
# Выкладка контура. Запускается с машины разработчика из любого места
# репозитория:
#
#   deploy/ship.sh root@IP prod    # main → прод и демо (демо крутит боевой код)
#   deploy/ship.sh root@IP test    # dev  → тест
#
# Код берётся из ветки контура через `git archive`, а не из рабочей копии:
# незакоммиченные правки и текущая ветка на выкладку не влияют, а миграции
# выполняются из той же ревизии, что и собранный образ.
#
# Шаги: сборка образа под linux/amd64 → конфиги и базы контуров → копия
# боевой базы → перенос образа → миграции → перезапуск → проверка снаружи.
# Предыдущий образ контура остаётся под тегом для отката (README).

set -euo pipefail
. "$(dirname "$0")/lib.sh"

host=${1:?укажите сервер: root@IP}
target=${2:?укажите контур: prod или test}

case "$target" in
  prod) ref=main; image=latest; previous=previous;      contours='prod demo'; services='app app-demo' ;;
  test) ref=dev;  image=test;   previous=test-previous; contours='test';      services='app-test' ;;
  *) echo "выкладываются prod (вместе с демо) или test, а не «$target»" >&2; exit 2 ;;
esac

src=$(checkout_ref "$ref")
trap 'rm -rf "$src"' EXIT
sha=$(git -C "$REPO_DIR" rev-parse --short "$ref")
echo "==> $target: $(git -C "$REPO_DIR" log --oneline -1 "$ref")"

echo '==> Сборка образа'
docker buildx build --platform linux/amd64 -t "waterdrinkers:$sha" --load "$src"

echo '==> Конфигурация и базы контуров'
ssh "$host" "test -f $APP_DIR/.env" \
  || { echo "на сервере нет $APP_DIR/.env — см. README, «Первый запуск»" >&2; exit 1; }
scp -q "$DEPLOY_DIR/compose.yml" "$DEPLOY_DIR/Caddyfile" "$DEPLOY_DIR/backup.sh" \
  "$DEPLOY_DIR/init-contours.sh" "$host:$APP_DIR/"
ssh "$host" "chmod +x $APP_DIR/backup.sh $APP_DIR/init-contours.sh && $APP_DIR/init-contours.sh"

if [ "$target" = prod ]; then
  echo '==> Копия боевой базы перед выкладкой'
  ssh "$host" "$APP_DIR/backup.sh"
fi

echo '==> Перенос образа (сжатый, по SSH)'
docker save "waterdrinkers:$sha" | gzip | ssh "$host" 'gunzip | docker load'

for contour in $contours; do
  echo "==> Миграции: $contour"
  (cd "$src" && "$DEPLOY_DIR/with-db.sh" "$host" "$contour" npx prisma migrate deploy)
done

echo '==> Перезапуск'
ssh "$host" "set -e
  cd $APP_DIR
  if docker image inspect waterdrinkers:$image >/dev/null 2>&1; then
    docker tag waterdrinkers:$image waterdrinkers:$previous
  fi
  docker tag waterdrinkers:$sha waterdrinkers:$image
  docker compose up -d --wait $services
  # Caddy перечитывает Caddyfile только при пересоздании или reload.
  docker compose up -d --wait caddy
  # Адрес явно: без него reload стучится на [::1], а Caddy слушает 127.0.0.1.
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --address 127.0.0.1:2019 2>/dev/null
  # Образы прошлых выкладок: остаются только рабочие и предыдущие.
  docker images waterdrinkers --format '{{.Tag}}' | grep -vxE 'latest|previous|test|test-previous' \\
    | xargs -r -I{} docker rmi waterdrinkers:{} >/dev/null
  docker image prune -f >/dev/null"

base=$(remote_env "$host" BASE_HOST)
failed=0
for contour in $contours; do
  contour_vars "$contour"
  url="https://$C_SUB.$base/login"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$url")
  echo "==> $url — $code"
  [ "$code" = 200 ] || failed=1
done
if [ "$failed" = 1 ]; then
  echo "смотрите: ssh $host 'cd $APP_DIR && docker compose logs --tail=100 $services caddy'" >&2
  exit 1
fi
echo "Готово: $target ($sha)"
