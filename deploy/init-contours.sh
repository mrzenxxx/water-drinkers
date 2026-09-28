#!/usr/bin/env bash
# Базы и роли демо и теста. Запускается на сервере из /opt/waterdrinkers;
# ship.sh зовёт его при каждой выкладке — повторный запуск ничего не ломает.
#
# 1. Дописывает в .env недостающие секреты демо и теста (прод не трогает:
#    смена его SESSION_SECRET разлогинила бы всех и убила выданные ссылки).
# 2. Заводит роли wd_demo и wd_test, каждой — свою базу во владение.
#    Расширения citext и btree_gist доверенные: владелец базы ставит их сам,
#    миграции суперпользователь не нужен.
# 3. Закрывает CONNECT к каждой базе для всех, кроме владельца. Без этого
#    любая роль по умолчанию может подключиться к любой базе, и тестовый
#    код из dev дотянулся бы до боевых данных.

set -euo pipefail
cd /opt/waterdrinkers
umask 077

# Переход с одноконтурного .env: адрес назывался SITE_HOST.
if grep -q '^SITE_HOST=' .env && ! grep -q '^BASE_HOST=' .env; then
  sed -i 's/^SITE_HOST=/BASE_HOST=/' .env
fi

add_secret() {
  grep -q "^$1=" .env || echo "$1=$2" >> .env
}
add_secret DEMO_DB_PASSWORD "$(openssl rand -hex 24)"
add_secret DEMO_SESSION_SECRET "$(openssl rand -base64 48 | tr -d '\n')"
add_secret TEST_DB_PASSWORD "$(openssl rand -hex 24)"
add_secret TEST_SESSION_SECRET "$(openssl rand -base64 48 | tr -d '\n')"

env_value() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }

docker compose up -d --wait db >/dev/null

sql() {
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U waterdrinkers -d waterdrinkers "$@"
}

for contour in demo test; do
  role=wd_$contour
  db=waterdrinkers_$contour
  # Пароль — hex из add_secret: кавычки в SQL ему не страшны.
  password=$(env_value "$(echo "$contour" | tr a-z A-Z)_DB_PASSWORD")

  sql -c "DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$role') THEN
      CREATE ROLE $role LOGIN PASSWORD '$password';
    ELSE
      ALTER ROLE $role PASSWORD '$password';
    END IF;
  END \$\$;"

  if [ -z "$(sql -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")" ]; then
    sql -c "CREATE DATABASE $db OWNER $role"
  fi
  sql -c "REVOKE CONNECT ON DATABASE $db FROM PUBLIC"
done

sql -c "REVOKE CONNECT ON DATABASE waterdrinkers FROM PUBLIC"
echo 'контуры: базы и роли на месте'
