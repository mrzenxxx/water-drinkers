-- Объявления администратора (§6.12): инструкции и сообщения всем участникам.
--
-- Отдельной миграцией, а не правкой начальной. `PROGRESS.md` разрешал править
-- `00000000000000_init` напрямую, пока схемы нет нигде, — но локальная база
-- разработки уже живёт с данными, и пересоздавать её ради двух таблиц дороже,
-- чем завести миграцию. С этого дня правило «правим init» не действует.
--
-- Ничего из добавленного здесь не касается денег: ни строки в
-- `fund_transactions`, ни участия в расчёте балансов. Инвариант §5 не затронут.

-- Момент последнего захода в раздел объявлений. Непрочитанное выводится
-- сравнением с published_at: отдельная таблица «кто что прочитал» для полутора
-- десятков человек стоила бы дороже пользы.
ALTER TABLE "users" ADD COLUMN "announcements_seen_at" TIMESTAMPTZ;

-- published_at IS NULL — черновик, archived_at IS NOT NULL — снято с глаз.
-- Пустой заголовок или пустое тело — это не объявление, а промах по кнопке.
CREATE TABLE "announcements" (
  "id"           UUID PRIMARY KEY,
  "title"        TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "pinned"       BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ,
  "archived_at"  TIMESTAMPTZ,
  "created_by"   UUID NOT NULL REFERENCES "users"("id"),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Приложенная картинка: здесь её описание, байты — в announcement_images.
  -- Тип определяется по сигнатуре файла, а не по тому, чем он назвался.
  "image_media_type" TEXT,
  "image_alt"        TEXT,
  "image_width"      INTEGER,
  "image_height"     INTEGER,
  CHECK (btrim("title") <> ''),
  CHECK (btrim("body") <> ''),
  -- Картинка описана целиком или её нет вовсе. Подпись обязательна: без неё
  -- картинка молчит для тех, кто её не видит (§12).
  CHECK (
    ("image_media_type" IS NULL AND "image_alt" IS NULL
       AND "image_width" IS NULL AND "image_height" IS NULL)
    OR ("image_media_type" IS NOT NULL AND btrim("image_alt") <> ''
       AND "image_width" > 0 AND "image_height" > 0)
  )
);

-- Список участника — это выборка опубликованных в порядке публикации.
CREATE INDEX "announcements_published_at_idx" ON "announcements" ("published_at");

-- Байты картинки — отдельной таблицей, а не колонкой в announcements: Prisma
-- выбирает все колонки, если не попросить иначе, и список объявлений на каждом
-- экране вычитывал бы мегабайты, которые ему не нужны. Сюда ходит ровно один
-- обработчик — /api/notices/[id]/image.
CREATE TABLE "announcement_images" (
  "announcement_id" UUID PRIMARY KEY REFERENCES "announcements"("id"),
  "bytes"           BYTEA NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
