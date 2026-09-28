# Развёртывание

Один сервер, три контура:

| Контур | Адрес | Код | Данные |
|---|---|---|---|
| прод | `https://puzyrik.<BASE_HOST>` | ветка `main` | боевая база `waterdrinkers` |
| демо | `https://demo-puzyrik.<BASE_HOST>` | тот же образ, что у прода | моковая база `waterdrinkers_demo` |
| тест | `https://test-puzyrik.<BASE_HOST>` | ветка `dev` | моковая база `waterdrinkers_test` |

Голый `https://<BASE_HOST>` перенаправляет на прод с сохранением пути.
`BASE_HOST` — `<IP через дефисы>.sslip.io`: имя и любые его поддомены указывают
на IP сервера без покупки домена, Caddy получает на каждое имя сертификат
Let's Encrypt.

| | |
|---|---|
| Сервер | Ubuntu 24.04, 1 vCPU, 1 ГБ ОЗУ, доступ `root` по SSH-ключу |
| Каталог на сервере | `/opt/waterdrinkers`: `compose.yml`, `Caddyfile`, `backup.sh`, `init-contours.sh`, `.env` |
| Копии боевой базы | `/var/backups/waterdrinkers`, ежедневно в 03:30, хранятся 14 дней |

**Контуры изолированы.** Postgres один (на три экземпляра не хватит памяти), но
демо и тест ходят в свои базы под своими ролями, а подключение к чужой базе
закрыто (`init-contours.sh`): код из `dev` до боевых данных не дотянется.
У каждого контура свой `SESSION_SECRET` и свой `APP_URL`, поэтому ссылки
входа строятся от своего поддомена и на чужом не открываются, а cookie
сессии живёт только на своём поддомене.

**Образ собирается на машине разработчика, не на сервере.** На 1 ГБ памяти
`next build` не проходит. `ship.sh` собирает образ под `linux/amd64` из ветки
контура (`git archive`: рабочая копия и текущая ветка не важны) и везёт его
по SSH.

**База наружу не открыта.** Она слушает `127.0.0.1` сервера. Миграции, сиды и
выдача паролей идут с машины разработчика через SSH-туннель: `with-db.sh`
подставляет в окружение одной команды `DATABASE_URL`, `SESSION_SECRET` и
`APP_URL` нужного контура.

Ниже `HOST=root@<IP>`.

## Выкладка

```bash
deploy/ship.sh $HOST prod    # main → прод и демо
deploy/ship.sh $HOST test    # dev  → тест
```

Выкладка прода снимает копию боевой базы перед миграциями. Каждая выкладка
заодно доводит до нужного вида конфиги, базы и роли контуров, так что первый
запуск нового контура — это обычная выкладка.

**Откат** (миграции назад не откатываются, только код):

```bash
ssh $HOST 'cd /opt/waterdrinkers && docker tag waterdrinkers:previous waterdrinkers:latest && docker compose up -d app app-demo'
ssh $HOST 'cd /opt/waterdrinkers && docker tag waterdrinkers:test-previous waterdrinkers:test && docker compose up -d app-test'
```

## Учётные данные и моковые данные

```bash
deploy/credentials.sh $HOST prod e.kondobarov   # пароль и ссылка на прод
deploy/credentials.sh $HOST demo e.kondobarov   # … на демо
deploy/credentials.sh $HOST test e.kondobarov   # … на тест

deploy/seed-mock.sh $HOST demo                  # заполнить демо заново
deploy/seed-mock.sh $HOST test                  # заполнить тест заново
```

`seed-mock.sh` стирает взносы, заказы, отсутствия и журнал операций контура и
наполняет их заново. Прод им не заполнить: скрипт отказывает.

## Первый запуск на новом сервере

```bash
# 1. Подготовка сервера: подкачка 2 ГБ, Docker, ротация логов, cron копий.
scp deploy/server-setup.sh $HOST:/tmp/ && ssh $HOST bash /tmp/server-setup.sh

# 2. Окружение прода. Секреты демо и теста init-contours.sh допишет сам.
ssh $HOST
  cd /opt/waterdrinkers
  cat > .env <<EOF
BASE_HOST=$(curl -s -4 ifconfig.me | tr . -).sslip.io
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_TELEGRAM_URL=https://t.me/<ник>
EOF
  chmod 600 .env
  exit

# 3. Выкладка всех контуров и первый администратор.
deploy/ship.sh $HOST prod
deploy/ship.sh $HOST test
deploy/seed-mock.sh $HOST demo && deploy/seed-mock.sh $HOST test
deploy/with-db.sh $HOST prod npx tsx prisma/seed.ts
deploy/credentials.sh $HOST prod e.kondobarov
```

Вместо сида прода можно перенести заранее заполненную базу — следующий раздел.

## Заполнить базу у себя и перенести на прод

Прошлые заказы, взносы и участников удобнее завести локально: ошибку в черновой
базе можно выбросить вместе с базой, а в боевом журнале операций она осталась бы
навсегда (CLAUDE.md, правило 4). Черновая база — **отдельная**, рядом с базой
разработки, которую трогать не нужно.

```bash
# Черновая база в том же контейнере, что и база разработки (порт 5433).
docker exec waterdrinkers-db createdb -U waterdrinkers waterdrinkers_final
export DATABASE_URL=postgresql://waterdrinkers:waterdrinkers@localhost:5433/waterdrinkers_final
npx prisma migrate deploy
npm run db:seed
npm run credentials -- e.kondobarov
npm run dev          # в этом же терминале: переменная из окружения важнее .env
```

Заполнять в таком порядке: участники с датой прихода → отсутствия → заказы
(каждому нужен файл чека) → взносы. Взнос, внесённый администратором, идёт в
фонд сразу, без очереди подтверждений (ADR-0005). Порядок на итог не влияет,
доли пересчитываются по дням присутствия, но так удобнее сверяться. Перед
переносом проверьте на `/fund` и на главной, что остаток фонда и балансы
совпадают с вашими записями.

Перенос:

```bash
mkdir -p dumps
docker exec waterdrinkers-db pg_dump -U waterdrinkers -d waterdrinkers_final --format=custom > dumps/final.dump
scp dumps/final.dump $HOST:/tmp/final.dump
ssh $HOST 'set -e; cd /opt/waterdrinkers
  ./backup.sh
  docker compose stop app
  docker compose exec -T db sh -c "dropdb -U waterdrinkers --force waterdrinkers && createdb -U waterdrinkers waterdrinkers"
  docker compose exec -T db psql -U waterdrinkers -c "REVOKE CONNECT ON DATABASE waterdrinkers FROM PUBLIC"
  docker compose exec -T db pg_restore -U waterdrinkers -d waterdrinkers --no-owner --exit-on-error < /tmp/final.dump
  docker compose start app
  rm /tmp/final.dump'
```

После переноса:

- **Пароли, выданные локально, работают:** они хешируются без секрета сервера.
- **Магические ссылки, выданные локально, не работают:** они подписаны локальным
  `SESSION_SECRET` и ведут на `localhost`. Новые выдаются уже на сервере —
  в админ-панели или `credentials.sh`.

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
