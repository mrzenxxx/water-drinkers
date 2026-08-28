-- WaterDrinkers — начальная миграция.
--
-- Написана вручную, а не через `prisma migrate dev`, потому что три вещи из
-- docs/SPEC.md §11 язык схемы Prisma не выражает и потому потерялись бы:
--   1. расширения citext и btree_gist;
--   2. CHECK-ограничения (amount > 0, id = 1, ends_on >= starts_on);
--   3. EXCLUDE USING gist на absences — запрет пересекающихся отсутствий
--      одного участника (§11: правило стоит в базе, чтобы его нельзя было
--      обойти прямой записью).
-- Порядок колонок и типы совпадают с §11 дословно.

CREATE EXTENSION IF NOT EXISTS citext;
-- btree_gist нужен, чтобы в EXCLUDE можно было сравнивать user_id оператором =
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "users" (
  "id"              UUID PRIMARY KEY,
  "email"           CITEXT UNIQUE NOT NULL,
  "first_name"      TEXT,
  "last_name"       TEXT,
  "role"            TEXT NOT NULL DEFAULT 'PARTICIPANT',
  "joined_at"       DATE NOT NULL,
  "left_at"         DATE,
  "opening_balance" BIGINT NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "identities" (
  "id"          UUID PRIMARY KEY,
  "user_id"     UUID NOT NULL REFERENCES "users"("id"),
  "provider"    TEXT NOT NULL,          -- 'email' | 'telegram'
  "provider_id" TEXT NOT NULL,
  UNIQUE ("provider", "provider_id")
);

CREATE TABLE "fund_settings" (
  "id"                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  "opening_balance"      BIGINT NOT NULL DEFAULT 0,
  "start_date"           DATE,
  "default_contribution" BIGINT NOT NULL DEFAULT 50000   -- 500 ₽
);

CREATE TABLE "receipts" (
  "id"          UUID PRIMARY KEY,
  "storage_key" TEXT NOT NULL,
  "media_type"  TEXT NOT NULL,
  "extraction"  JSONB,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "contributions" (
  "id"             UUID PRIMARY KEY,
  "user_id"        UUID NOT NULL REFERENCES "users"("id"),
  "amount"         BIGINT NOT NULL CHECK ("amount" > 0),
  "paid_at"        DATE NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "receipt_id"     UUID REFERENCES "receipts"("id"),
  "submitted_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewed_by"    UUID REFERENCES "users"("id"),
  "reviewed_at"    TIMESTAMPTZ,
  "review_comment" TEXT,
  "historical"     BOOLEAN NOT NULL DEFAULT false,
  -- Внесено администратором за участника (§6.7). Отдельно от "historical":
  -- тот про перенесённую историю, этот про то, чьими руками создана запись.
  -- Взнос, внесённый администратором, всё равно проходит подтверждение.
  "entered_by_admin" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "water_orders" (
  "id"            UUID PRIMARY KEY,
  "amount"        BIGINT NOT NULL CHECK ("amount" > 0),
  "ordered_at"    DATE NOT NULL,
  "bottles_count" INT,
  "supplier"      TEXT,
  "note"          TEXT,
  "receipt_id"    UUID REFERENCES "receipts"("id"),
  "created_by"    UUID NOT NULL REFERENCES "users"("id"),
  "historical"    BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "absences" (
  "id"        UUID PRIMARY KEY,
  "user_id"   UUID NOT NULL REFERENCES "users"("id"),
  "type"      TEXT NOT NULL,          -- VACATION | SICK_LEAVE
  "starts_on" DATE NOT NULL,
  "ends_on"   DATE NOT NULL,
  "note"      TEXT,
  -- Внесено администратором за участника (§6.7).
  "entered_by_admin" BOOLEAN NOT NULL DEFAULT false,
  CHECK ("ends_on" >= "starts_on"),
  -- Непересечение отсутствий одного участника. Тип намеренно не учитывается:
  -- одновременный отпуск и больничный вычли бы день дважды и сломали инвариант.
  EXCLUDE USING gist (
    "user_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  )
);

CREATE TABLE "fund_transactions" (
  "id"         UUID PRIMARY KEY,
  "type"       TEXT NOT NULL,          -- OPENING | CONTRIBUTION | ORDER | SETTLEMENT | ADJUSTMENT
  "amount"     BIGINT NOT NULL,        -- со знаком
  "user_id"    UUID REFERENCES "users"("id"),
  "ref_id"     UUID,                   -- ссылка на contribution / water_order
  "comment"    TEXT,
  "created_by" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "audit_log" (
  "id"         BIGSERIAL PRIMARY KEY,
  "actor_id"   UUID REFERENCES "users"("id"),
  "action"     TEXT NOT NULL,
  "entity"     TEXT NOT NULL,
  "entity_id"  UUID,
  "before"     JSONB,
  "after"      JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Отклонение от §11: добавлен суррогатный "id". В спецификации у таблицы нет
-- первичного ключа, но Prisma требует уникальный идентификатор у каждой модели.
-- В §11 первичного ключа не было, но Prisma требует уникальный идентификатор
-- у каждой модели — добавлен суррогатный BIGSERIAL.
-- created_at нужен для лимита «не больше 3 запросов кода на адрес в час» (§7):
-- выводить его из expires_at можно, но тогда лимит молча поедет при смене TTL.
CREATE TABLE "login_codes" (
  "id"         BIGSERIAL PRIMARY KEY,
  "email"      CITEXT NOT NULL,
  "code_hash"  TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "attempts"   SMALLINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Оба запроса по кодам идут по адресу: поиск живого кода и подсчёт запросов за час.
CREATE INDEX "login_codes_email_created_at_idx" ON "login_codes" ("email", "created_at");

CREATE TABLE "assistant_messages" (
  "id"         UUID PRIMARY KEY,
  "user_id"    UUID NOT NULL REFERENCES "users"("id"),
  "role"       TEXT NOT NULL,           -- user | assistant
  "content"    TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
