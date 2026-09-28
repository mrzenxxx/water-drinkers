#!/usr/bin/env bash
# Заполнить демо или тест демонстрационными данными (prisma/seed-mock.ts).
#
#   deploy/seed-mock.sh root@IP demo
#   deploy/seed-mock.sh root@IP test
#
# Сид стирает взносы, заказы, отсутствия и журнал операций и наполняет их
# заново — поэтому прод здесь запрещён наглухо, без флагов «я уверен».
# Администратор e.kondobarov при этом остаётся без пароля: его выдаёт
# credentials.sh.

set -euo pipefail
. "$(dirname "$0")/lib.sh"

host=${1:?укажите сервер: root@IP}
contour=${2:?укажите контур: demo или test}
if [ "$contour" = prod ]; then
  echo 'моковые данные на прод не льются: сид стирает журнал операций' >&2
  exit 2
fi
contour_vars "$contour"

src=$(checkout_ref "$C_REF")
trap 'rm -rf "$src"' EXIT

cd "$src"
"$DEPLOY_DIR/with-db.sh" "$host" "$contour" sh -c 'npx tsx prisma/seed.ts && npx tsx prisma/seed-mock.ts'
