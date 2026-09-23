# Развёртывание

Один сервер, три контейнера: PostgreSQL, приложение, Caddy (HTTPS).

| | |
|---|---|
| Сервер | Ubuntu 24.04, 1 vCPU, 1 ГБ ОЗУ, доступ `root` по SSH-ключу |
| Адрес | `https://<IP через дефисы>.sslip.io` — без покупки домена, сертификат Let's Encrypt |
| Каталог на сервере | `/opt/waterdrinkers`: `compose.yml`, `Caddyfile`, `backup.sh`, `.env` |
| Копии базы | `/var/backups/waterdrinkers`, ежедневно в 03:30, хранятся 14 дней |

**Образ собирается на машине разработчика, не на сервере.** На 1 ГБ памяти
`next build` не проходит. `ship.sh` собирает образ под `linux/amd64`
(сама сборка идёт нативно, см. комментарий в `Dockerfile`) и везёт его по SSH,
около 65 МБ в сжатом виде.

**База наружу не открыта.** Она слушает `127.0.0.1` сервера. Миграции, выдача
пароля и перенос дампа идут с машины разработчика через SSH-туннель:
`with-prod-db.sh` подставляет боевые `DATABASE_URL`, `SESSION_SECRET` и `APP_URL`
в окружение одной команды.

Ниже `HOST=root@<IP>`.

## Первый запуск

```bash
# 1. Подготовка сервера: подкачка 2 ГБ, Docker, ротация логов, cron копий.
scp deploy/server-setup.sh $HOST:/tmp/ && ssh $HOST bash /tmp/server-setup.sh

# 2. Окружение. Секреты генерируются на сервере и больше нигде не живут.
ssh $HOST
  cd /opt/waterdrinkers
  cat > .env <<EOF
SITE_HOST=$(curl -s -4 ifconfig.me | tr . -).sslip.io
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_TELEGRAM_URL=https://t.me/<ник>
EOF
  chmod 600 .env
  exit

# 3. Выкладка: сборка, перенос, миграции, запуск, проверка снаружи.
deploy/ship.sh $HOST
```

Дальше нужен первый администратор, и тут два пути:

- **Чистый старт:** `deploy/with-prod-db.sh $HOST npm run db:seed`, затем
  `deploy/with-prod-db.sh $HOST npm run credentials -- e.kondobarov`.
- **Перенос заранее заполненной базы:** раздел ниже. Сид в этом случае не нужен,
  администратор приезжает вместе с базой.

## Выкладка новой версии

```bash
git switch main && git pull
deploy/ship.sh $HOST
```

Скрипт откажется работать с незакоммиченными правками: тег образа берётся
от коммита. Перед миграциями он снимает копию базы.

**Откат приложения** (миграции назад не откатываются, только код):

```bash
ssh $HOST 'cd /opt/waterdrinkers && docker tag waterdrinkers:previous waterdrinkers:latest && docker compose up -d app'
```

## Заполнить базу у себя и перенести на сервер

Прошлые заказы, взносы и участников удобнее завести локально: ошибку в черновой
базе можно выбросить вместе с базой, а в боевом журнале операций она осталась бы
навсегда (CLAUDE.md, правило 4). Черновая база — **отдельная**, рядом с базой
разработки, которую трогать не нужно.

```bash
# Черновая база в том же контейнере, что и база разработки (порт 5433).
docker exec waterdrinkers-db createdb -U waterdrinkers waterdrinkers_fill
export DATABASE_URL=postgresql://waterdrinkers:waterdrinkers@localhost:5433/waterdrinkers_fill
npx prisma migrate deploy
npm run db:seed
npm run credentials -- e.kondobarov
npm run dev          # в этом же терминале: переменная из окружения важнее .env
```

Заполнять в таком порядке: участники с датой прихода → отсутствия → заказы
(каждому нужен файл чека) → взносы. Взнос, внесённый администратором, идёт в
фонд сразу, без очереди подтверждений (ADR-0005).
Порядок на итог не влияет, доли пересчитываются по дням присутствия, но так
удобнее сверяться. Перед переносом проверьте на `/fund` и на главной, что
остаток фонда и балансы совпадают с вашими записями.

Перенос:

```bash
docker exec waterdrinkers-db pg_dump -U waterdrinkers -d waterdrinkers_fill --format=custom > fill.dump
scp fill.dump $HOST:/tmp/fill.dump
ssh $HOST 'set -e; cd /opt/waterdrinkers
  ./backup.sh
  docker compose stop app
  docker compose exec -T db sh -c "dropdb -U waterdrinkers --force waterdrinkers && createdb -U waterdrinkers waterdrinkers"
  docker compose exec -T db pg_restore -U waterdrinkers -d waterdrinkers --no-owner --exit-on-error < /tmp/fill.dump
  docker compose start app
  rm /tmp/fill.dump'
```

После переноса:

- **Пароли, выданные локально, работают:** они хешируются без секрета сервера.
- **Магические ссылки, выданные локально, не работают:** они подписаны локальным
  `SESSION_SECRET` и ведут на `localhost`. Ссылки выпускаются заново уже на
  сервере, в админ-панели или командой `with-prod-db.sh … npm run credentials`.
- Сессии, открытые локально, на сервере недействительны по той же причине.

## Резервные копии

Копии лежат на том же сервере и спасают от ошибки, но не от гибели машины.
Время от времени забирайте их к себе:

```bash
scp "$HOST:/var/backups/waterdrinkers/*.dump" ~/Backups/waterdrinkers/
```

Восстановление — те же команды, что при переносе, только с файлом копии.

## Если что-то не так

```bash
ssh $HOST 'cd /opt/waterdrinkers && docker compose ps && docker compose logs --tail=100 app caddy'
ssh $HOST free -h
```

- Caddy не получил сертификат: порты 80 и 443 должны быть открыты снаружи.
  Первым делом проверить, не закрывает ли их ViPNet или панель хостинга.
- На сервере работают и другие сервисы: ViPNet, x-ui/xray, hysteria (он
  занимает UDP 443, поэтому HTTP/3 у Caddy выключен), zabbix. `server-setup.sh`
  их не трогает. Файрвол `ufw` был включён до нас, скрипт только добавляет в него
  80 и 443/tcp.
