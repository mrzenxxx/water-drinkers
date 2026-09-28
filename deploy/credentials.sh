#!/usr/bin/env bash
# Новый пароль и магическая ссылка участнику на выбранном контуре.
#
#   deploy/credentials.sh root@IP prod e.kondobarov
#   deploy/credentials.sh root@IP demo e.kondobarov
#
# Ссылка строится от поддомена контура и подписана его секретом: ссылка с
# демо на проде не откроется, и наоборот. Прежние входы участника на этом
# контуре отзываются (scripts/set-credentials.ts). Остальным участникам
# учётные данные выдаёт администратор в панели — этот скрипт нужен, чтобы
# войти первым.

set -euo pipefail
. "$(dirname "$0")/lib.sh"

host=${1:?укажите сервер: root@IP}
contour=${2:?укажите контур: prod, demo или test}
login=${3:?укажите логин участника}
contour_vars "$contour"

src=$(checkout_ref "$C_REF")
trap 'rm -rf "$src"' EXIT

cd "$src"
"$DEPLOY_DIR/with-db.sh" "$host" "$contour" npx tsx scripts/set-credentials.ts "$login"
