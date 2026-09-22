-- Вход по логину и паролю, выданным администратором (ADR-0004).
--
-- Почта перестаёт быть способом входа и становится необязательной;
-- у каждого участника появляется логин. Код на почту уходит вместе
-- с таблицей login_codes.

CREATE TABLE "departments" (
  "id"         UUID PRIMARY KEY,
  "name"       CITEXT UNIQUE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users"
  ADD COLUMN "middle_name"           TEXT,
  ADD COLUMN "login"                 CITEXT,
  ADD COLUMN "password_hash"         TEXT,
  ADD COLUMN "magic_link_hash"       TEXT,
  ADD COLUMN "magic_link_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "department_id"         UUID,
  -- NONE | MUTED | BANNED
  ADD COLUMN "restriction"           TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "sessions_valid_after"  TIMESTAMPTZ(6),
  ADD COLUMN "failed_logins"         SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until"          TIMESTAMPTZ(6);

-- Уже заведённым участникам логин — локальная часть рабочей почты:
-- e.kondobarov@sspk.spb.ru → e.kondobarov. Пароля у них нет, пока
-- администратор его не выдаст.
UPDATE "users" SET "login" = lower(split_part("email", '@', 1)) WHERE "login" IS NULL;

ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_login_key" UNIQUE ("login");
ALTER TABLE "users" ADD CONSTRAINT "users_magic_link_hash_key" UNIQUE ("magic_link_hash");
ALTER TABLE "users" ADD CONSTRAINT "users_restriction_check"
  CHECK ("restriction" IN ('NONE', 'MUTED', 'BANNED'));
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Лимит записей участника считается по журналу аудита (§6.13).
CREATE INDEX "audit_log_actor_id_action_created_at_idx"
  ON "audit_log" ("actor_id", "action", "created_at");

DROP TABLE "login_codes";
