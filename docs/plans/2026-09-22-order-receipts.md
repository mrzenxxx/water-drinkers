# Чек к поставке воды — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** администратор отмечает поставку воды формой на странице «Заказы», обязательно прикладывая чек (PDF или картинку), а любой участник открывает этот чек из интерфейса — с предпросмотром и в форме, и в списке.

**Архитектура:** байты чека лежат в PostgreSQL отдельной таблицей `receipt_files` (ADR-0003); выдача идёт маршрутом приложения `/api/receipts/:id` за входом; загрузка — формой в Server Action, который зовёт резолверы `uploadReceipt` и `createWaterOrder` в процессе (ADR-0002), без клиентского `fetch`. Разбор файла и правило видимости — чистые функции в `src/lib/receipts/`, поэтому проверяются модульными тестами без базы и браузера.

**Стек:** Next.js 16 (App Router), React 19, TypeScript, Prisma 7 + PostgreSQL, GraphQL Yoga, Tailwind 4 + shadcn/ui (Radix), Vitest.

**Спецификация:** [`docs/SPEC.md`](../SPEC.md) §6.5, §8.4, §10.2, §11 и [`docs/decisions/0003-receipt-files-live-in-the-database.md`](../decisions/0003-receipt-files-live-in-the-database.md). План спорит со спекой, а не заменяет её: читать оба.

## Global Constraints

- **Деньги — целые копейки** (`BIGINT` в базе, `number` в коде). Плавающая точка в денежных расчётах запрещена (CLAUDE.md, правило 2). Размер файла — не деньги, там дробное допустимо.
- **Журнал `fund_transactions` неизменяем** (правило 4). Заказ пишет в него ровно одну строку со знаком минус — этот код уже есть и не трогается.
- **`src/lib/calc/` не затрагивается вовсе.** Чек не двигает деньги; генеративные тесты инварианта менять не нужно.
- **Ядро без побочных эффектов:** в `src/lib/receipts/file.ts` и `access.ts` нет обращений к базе, сети и глобальному состоянию.
- **Server Action не ходит в Prisma напрямую** и не делает HTTP к собственному `/api/graphql` — зовёт резолвер (ADR-0002).
- **`'use client'` — исключение:** только там, где нужны обработчики, состояние или браузерные API.
- **React 19:** `<form action={…}>` + `useActionState`, ожидание — `useFormStatus` внутри `SubmitButton`. Никаких `onSubmit`, `preventDefault`, ручных флагов занятости.
- **Схема базы меняется новой миграцией.** `prisma/migrations/00000000000000_init` не трогать, `prisma migrate reset` не предлагать и не выполнять: в базе разработки лежат живые данные владельца.
- **Язык:** код, имена файлов и коммиты — английские; комментарии, тексты интерфейса и сообщения об ошибках — русские.
- **Предел размера чека — 5 МБ.** Форматы: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- **Тип файла определяется по сигнатуре**, объявленный лишь сверяется; расхождение — отказ (§8.4).
- **Команды проверки:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run codegen`, `npm run smoke` (нужна поднятая база), `npm run check:contrast`.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/lib/images.ts` (правка) | Разбор картинки. Выделяются `readImageInfo` (без проверки размера) и `normalizeMediaType`, чтобы чеки не копировали чтение сигнатур. |
| `src/lib/receipts/file.ts` (создать) | Чистый разбор файла чека: тип по сигнатуре, размер, предел, отказы с человеческими формулировками. |
| `src/lib/receipts/access.ts` (создать) | Чистое правило «кому виден этот чек». |
| `prisma/schema.prisma` (правка) | Модель `ReceiptFile`, поле `Receipt.byteSize`. |
| `prisma/migrations/20260922120000_receipt_files/migration.sql` (создать) | Новая таблица и колонка. |
| `src/graphql/schema.graphql` (правка) | `Receipt.mediaType`, `Receipt.byteSize`, `ReceiptFileInput`, `uploadReceipt`, обязательный `WaterOrderInput.receiptFileId`. |
| `src/graphql/resolvers/mutation/receipt.ts` (создать) | `uploadReceipt`: проверка байтов, запись чека и файла в одной транзакции, аудит. |
| `src/graphql/resolvers/mutation/index.ts` (правка) | Регистрация набора мутаций чеков. |
| `src/graphql/resolvers/mutation/order.ts` (правка) | `receiptFileId` стал обязательным — проверка существования остаётся, ветка «не прислали» уходит. |
| `src/app/api/receipts/[id]/route.ts` (создать) | Выдача файла: вход, правило видимости, ETag, заголовки безопасности, `?download=1`. |
| `src/lib/data/queries.ts` (правка) | `OrderRow` получает метаданные чека для подписи кнопки. |
| `src/lib/format/labels.ts` + `index.ts` (правка) | `formatFileSize`. |
| `src/lib/actions/orders.ts` (создать) | Server Action формы поставки. |
| `src/components/receipt-preview.tsx` (создать) | Клиентский диалог предпросмотра: картинка или PDF, ссылка на новую вкладку. |
| `src/components/receipt-field.tsx` (создать) | Клиентское поле выбора файла с предпросмотром до отправки. |
| `src/components/order-form.tsx` (создать) | Серверный компонент формы «Отметить поставку». |
| `src/app/(app)/orders/page.tsx` (правка) | Карточка формы администратору, кнопка чека у каждого заказа. |
| `tests/support/office.ts` (правка) | Готовый чек в подставной базе: заказ без него больше не создать. |
| `tests/support/fake-prisma.ts` (правка) | Таблица `receipt_files`. |
| `prisma/seed-mock.ts` (правка) | Демо-чеки у части заказов, чтобы экран было на чём смотреть. |
| `scripts/smoke.ts` (правка) | Дымовая проверка выдачи чека. |

---

### Task 1: Разбор файла чека

**Files:**
- Modify: `src/lib/images.ts`
- Create: `src/lib/receipts/file.ts`
- Test: `tests/receipts/file.test.ts`

**Interfaces:**
- Consumes: ничего (первая задача).
- Produces:
  - `readImageInfo(bytes: Uint8Array): ImageInfo | null` и `normalizeMediaType(value: string): string` из `@/lib/images`;
  - `MAX_RECEIPT_BYTES: number`, `RECEIPT_ACCEPT: string`, `SUPPORTED_RECEIPT_TYPES: ReceiptMediaType[]`, `type ReceiptMediaType = ImageMediaType | 'application/pdf'`, `type ReceiptFileInfo = { mediaType: ReceiptMediaType; byteSize: number }`, `class ReceiptFileError extends Error`, `inspectReceiptFile(bytes: Uint8Array, declaredType?: string | null): ReceiptFileInfo` из `@/lib/receipts/file`.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/receipts/file.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { MAX_RECEIPT_BYTES, ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

/**
 * Разбор чека по его собственным байтам (§8.4).
 *
 * Настоящие файлы не нужны: решают сигнатуры, и они собираются здесь руками.
 * Заодно видно, что именно функция читает, а что игнорирует.
 */

function bytes(...parts: (number | number[] | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') flat.push(...[...part].map((char) => char.charCodeAt(0)));
    else if (Array.isArray(part)) flat.push(...part);
    else flat.push(part);
  }
  return Uint8Array.from(flat);
}

/** Настоящий PNG 4×2: размеры лежат в заголовке IHDR, больше ничего не нужно. */
const PNG = bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  [0x00, 0x00, 0x00, 0x0d],
  'IHDR',
  [0x00, 0x00, 0x00, 0x04],
  [0x00, 0x00, 0x00, 0x02],
  [0x08, 0x06, 0x00, 0x00, 0x00],
);

const PDF = bytes('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

describe('разбор файла чека', () => {
  it('узнаёт PDF по сигнатуре и считает размер', () => {
    expect(inspectReceiptFile(PDF)).toEqual({
      mediaType: 'application/pdf',
      byteSize: PDF.byteLength,
    });
  });

  it('узнаёт картинку', () => {
    expect(inspectReceiptFile(PNG).mediaType).toBe('image/png');
  });

  it('принимает совпадающий объявленный тип', () => {
    expect(inspectReceiptFile(PDF, 'application/pdf').mediaType).toBe('application/pdf');
    expect(inspectReceiptFile(PNG, 'image/png').mediaType).toBe('image/png');
  });

  it('отказывает, когда объявленный тип расходится с настоящим', () => {
    expect(() => inspectReceiptFile(PDF, 'image/png')).toThrow(ReceiptFileError);
  });

  it('отказывает файлу неизвестного формата', () => {
    // HTML, названный чеком: ровно тот случай, ради которого тип берётся
    // из сигнатуры, а не из формы.
    expect(() => inspectReceiptFile(bytes('<!doctype html><script>'), 'application/pdf')).toThrow(
      ReceiptFileError,
    );
  });

  it('отказывает пустому файлу', () => {
    expect(() => inspectReceiptFile(new Uint8Array(0))).toThrow(ReceiptFileError);
  });

  it('отказывает файлу больше предела', () => {
    const huge = new Uint8Array(MAX_RECEIPT_BYTES + 1);
    huge.set(PDF, 0);
    expect(() => inspectReceiptFile(huge)).toThrow(/5 МБ/);
  });

  it('сообщения написаны для человека, а не для лога', () => {
    expect(() => inspectReceiptFile(new Uint8Array(0))).toThrow('Файл пустой.');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `npx vitest run tests/receipts/file.test.ts`
Ожидается: FAIL — модуля `@/lib/receipts/file` не существует.

- [ ] **Step 3: Выделить в `src/lib/images.ts` переиспользуемые части**

Заменить тело проверки формата в `inspectImage` и экспортировать две функции. В `src/lib/images.ts`:

```ts
/**
 * Тип и размеры картинки по сигнатуре — или `null`, если это не картинка.
 *
 * Без ограничения размера: предел у объявления и у чека (§8.4) разный,
 * и решает его вызывающая сторона.
 */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return readPng(bytes) ?? readGif(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);
}

/** `image/jpg` пишут в половине форм, хотя правильный тип — `image/jpeg`. */
export function normalizeMediaType(value: string): string {
  const type = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'image/jpg' ? 'image/jpeg' : type;
}
```

В самой `inspectImage` строку `const info = readPng(bytes) ?? readGif(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);` заменить на `const info = readImageInfo(bytes);`, а вызов `normalizeType(declaredType)` — на `normalizeMediaType(declaredType)`; старую приватную `normalizeType` удалить.

- [ ] **Step 4: Написать `src/lib/receipts/file.ts`**

```ts
/**
 * Разбор файла чека по его собственным байтам (§8.4).
 *
 * Чистая функция: на входе содержимое файла, на выходе тип и размер или
 * внятная причина отказа. Ни базы, ни сети, ни `next/*` — поэтому проверяется
 * на нескольких байтах, без браузера и без настоящих файлов.
 *
 * Тип **не берётся** из того, что прислал браузер: файл, названный
 * `application/pdf`, может оказаться страницей HTML, и, отданный обратно с
 * этим заголовком, он выполнится в чужом браузере. Решает сигнатура,
 * объявленный тип лишь сверяется.
 */

import { type ImageMediaType, normalizeMediaType, readImageInfo } from '@/lib/images';

/**
 * Предел размера файла.
 *
 * Пять мегабайт — это снимок экрана банковского перевода или PDF-квитанция
 * с запасом. Файлы лежат в базе (ADR-0003), и снимать ограничение здесь
 * означало бы складывать в неё сканы в полный рост.
 */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptMediaType = ImageMediaType | 'application/pdf';

export type ReceiptFileInfo = {
  mediaType: ReceiptMediaType;
  byteSize: number;
};

/** Отказ с причиной, написанной для человека, а не для лога. */
export class ReceiptFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptFileError';
  }
}

const TYPE_LABEL: Record<ReceiptMediaType, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
};

export const SUPPORTED_RECEIPT_TYPES = Object.keys(TYPE_LABEL) as ReceiptMediaType[];

/** Значение `accept` у поля выбора файла. */
export const RECEIPT_ACCEPT = SUPPORTED_RECEIPT_TYPES.join(',');

/** `%PDF-` — первые пять байтов любого PDF. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function inspectReceiptFile(
  bytes: Uint8Array,
  declaredType?: string | null,
): ReceiptFileInfo {
  if (bytes.byteLength === 0) {
    throw new ReceiptFileError('Файл пустой.');
  }
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new ReceiptFileError(
      `Файл больше ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Уменьшите его и попробуйте снова.`,
    );
  }

  const mediaType: ReceiptMediaType | null = isPdf(bytes)
    ? 'application/pdf'
    : (readImageInfo(bytes)?.mediaType ?? null);

  if (mediaType === null) {
    throw new ReceiptFileError(
      `Это не файл одного из поддерживаемых форматов: ${Object.values(TYPE_LABEL).join(', ')}.`,
    );
  }

  // Расхождение с объявленным типом — не мелочь: либо файл переименовали,
  // либо его подменили по дороге. И то и другое стоит показать вслух.
  if (
    declaredType !== undefined &&
    declaredType !== null &&
    declaredType !== '' &&
    normalizeMediaType(declaredType) !== mediaType
  ) {
    throw new ReceiptFileError(
      `Файл назван «${declaredType}», а внутри ${TYPE_LABEL[mediaType]}. Пересохраните его и попробуйте снова.`,
    );
  }

  return { mediaType, byteSize: bytes.byteLength };
}
```

- [ ] **Step 5: Прогнать тесты**

Запустить: `npx vitest run tests/receipts/file.test.ts tests/images.test.ts`
Ожидается: PASS — новые тесты зелёные, разбор картинок не сломан.

- [ ] **Step 6: Проверить типы и линтер**

Запустить: `npm run typecheck && npm run lint`
Ожидается: чисто.

- [ ] **Step 7: Коммит**

```bash
git add src/lib/images.ts src/lib/receipts/file.ts tests/receipts/file.test.ts
git commit -m "feat(receipts): inspect a receipt file by its own bytes (SPEC 8.4)"
```

---

### Task 2: Правило видимости чека

**Files:**
- Create: `src/lib/receipts/access.ts`
- Test: `tests/receipts/access.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `type ReceiptLinks = { orderIds: readonly string[]; contributionUserIds: readonly string[] }`, `type ReceiptViewer = { id: string; role: string }`, `canViewReceipt(links: ReceiptLinks, viewer: ReceiptViewer): boolean` из `@/lib/receipts/access`.

Правило живёт отдельной чистой функцией, а не внутри маршрута: маршрут тянет `next/headers` и Prisma, и модульным тестом его не взять, а ошибиться в правах — самое дорогое, что здесь можно сделать.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/receipts/access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { canViewReceipt } from '@/lib/receipts/access';

/** Кому виден чек (§8.4). Чистое правило: ни базы, ни запроса. */

const ADMIN = { id: 'u-admin', role: 'ADMIN' };
const AUTHOR = { id: 'u-1', role: 'PARTICIPANT' };
const STRANGER = { id: 'u-2', role: 'PARTICIPANT' };

const NOTHING = { orderIds: [], contributionUserIds: [] };

describe('видимость чека', () => {
  it('чек заказа открыт любому участнику: деньги ушли из общего фонда', () => {
    const links = { orderIds: ['o-1'], contributionUserIds: [] };
    expect(canViewReceipt(links, STRANGER)).toBe(true);
    expect(canViewReceipt(links, ADMIN)).toBe(true);
  });

  it('чек взноса виден его автору', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, AUTHOR)).toBe(true);
  });

  it('чужой чек взноса участнику не виден', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, STRANGER)).toBe(false);
  });

  it('чужой чек взноса виден администратору: он его и проверяет', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, ADMIN)).toBe(true);
  });

  it('ни к чему не привязанный чек не виден никому, включая администратора', () => {
    // Это мусор незавершённой отправки, а не документ.
    expect(canViewReceipt(NOTHING, ADMIN)).toBe(false);
    expect(canViewReceipt(NOTHING, AUTHOR)).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `npx vitest run tests/receipts/access.test.ts`
Ожидается: FAIL — модуля `@/lib/receipts/access` не существует.

- [ ] **Step 3: Написать `src/lib/receipts/access.ts`**

```ts
/**
 * Кому виден чек (§8.4).
 *
 * Правило вынесено из маршрута отдельной чистой функцией: маршрут тянет
 * `next/headers` и Prisma, модульным тестом его не взять, а ошибка в правах
 * — самое дорогое, что здесь можно сделать. На входе только связи чека и
 * тот, кто спрашивает.
 */

export type ReceiptLinks = {
  /** Заказы, к которым приложен чек. */
  orderIds: readonly string[];
  /** Авторы взносов, к которым приложен чек. */
  contributionUserIds: readonly string[];
};

export type ReceiptViewer = {
  id: string;
  /** `ADMIN` | `PARTICIPANT` — роль хранится строкой (§11). */
  role: string;
};

export function canViewReceipt(links: ReceiptLinks, viewer: ReceiptViewer): boolean {
  // Заказ оплачен из общего фонда: его подтверждение — общее знание (§6.5).
  if (links.orderIds.length > 0) return true;

  // Свой взнос человек видит всегда.
  if (links.contributionUserIds.includes(viewer.id)) return true;

  // Чужой — только администратор, и ровно потому, что он его проверяет (§6.7).
  if (links.contributionUserIds.length > 0 && viewer.role === 'ADMIN') return true;

  // Чек, не привязанный ни к чему, — мусор незавершённой отправки.
  return false;
}
```

- [ ] **Step 4: Прогнать тесты**

Запустить: `npx vitest run tests/receipts/access.test.ts`
Ожидается: PASS, пять тестов.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/receipts/access.ts tests/receipts/access.test.ts
git commit -m "feat(receipts): who may open a receipt (SPEC 8.4)"
```

---

### Task 3: Схема базы

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260922120000_receipt_files/migration.sql`
- Modify: `tests/support/fake-prisma.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: модель `ReceiptFile` (`receiptId`, `bytes`, `createdAt`), поле `Receipt.byteSize: Int`, связь `Receipt.file: ReceiptFile?`; таблица `receiptFile` в подставной базе (`db.tables.receiptFile`).

**Начальную миграцию не трогать.** Контрольная сумма применённой миграции записана в `_prisma_migrations`, и правка её файла ломает `prisma migrate deploy`. `prisma migrate reset` не выполнять: в базе разработки лежат данные владельца.

- [ ] **Step 1: Добавить модель в `prisma/schema.prisma`**

В модель `Receipt` добавить поле и связь:

```prisma
model Receipt {
  id         String   @id @default(uuid()) @db.Uuid
  storageKey String   @map("storage_key")
  mediaType  String   @map("media_type")
  /// Размер файла в байтах: подпись кнопки не должна вычитывать сам файл.
  byteSize   Int      @default(0) @map("byte_size")
  extraction Json?
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  file          ReceiptFile?
  contributions Contribution[]
  waterOrders   WaterOrder[]

  @@map("receipts")
}

/// Байты чека отдельной таблицей: Prisma выбирает все колонки, и BYTEA внутри
/// receipts означал бы, что каждый список взносов и заказов вычитывает
/// мегабайты, которые ему не нужны (ADR-0003).
model ReceiptFile {
  receiptId String   @id @map("receipt_id") @db.Uuid
  bytes     Bytes
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  receipt Receipt @relation(fields: [receiptId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@map("receipt_files")
}
```

- [ ] **Step 2: Написать миграцию**

Создать `prisma/migrations/20260922120000_receipt_files/migration.sql`:

```sql
-- Чеки: размер файла и сами байты (SPEC §8.4, §11, ADR-0003).

ALTER TABLE "receipts" ADD COLUMN "byte_size" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "receipt_files" (
  "receipt_id" UUID PRIMARY KEY,
  "bytes"      BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "receipt_files_receipt_id_fkey"
    FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
```

- [ ] **Step 3: Проверить схему и перегенерировать клиент**

Запустить: `npx prisma validate && npm run db:generate`
Ожидается: «The schema at prisma/schema.prisma is valid» и успешная генерация в `src/generated/prisma`.

Базу не трогать: миграция применится командой `npx prisma migrate deploy` там, где база поднята. Если Postgres доступен локально, применить можно ею же — но не `migrate reset`.

- [ ] **Step 4: Добавить таблицу в подставную базу**

В `tests/support/fake-prisma.ts`, в объекте таблиц — сразу после `receipt` — добавить:

```ts
    // Ключ здесь — идентификатор чека, а не собственный: файл у чека один,
    // и своего id у него нет (§11).
    receiptFile: new FakeTable(
      'receipt_files',
      () => undefined,
      () => ({ createdAt: now() }),
    ),
```

И в описании таблицы `receipt` дополнить умолчания, чтобы строка была полной:

```ts
    receipt: new FakeTable('receipts', fakeUuid, () => ({
      extraction: null,
      mediaType: 'image/jpeg',
      byteSize: 0,
      createdAt: now(),
    })),
```

- [ ] **Step 5: Прогнать тесты и типы**

Запустить: `npm test && npm run typecheck`
Ожидается: всё зелёное — поведение пока не менялось.

- [ ] **Step 6: Коммит**

```bash
git add prisma/schema.prisma prisma/migrations/20260922120000_receipt_files tests/support/fake-prisma.ts
git commit -m "feat(db): receipt_files table and receipts.byte_size (SPEC 11)"
```

---

### Task 4: Мутация `uploadReceipt`

**Files:**
- Modify: `src/graphql/schema.graphql`
- Create: `src/graphql/resolvers/mutation/receipt.ts`
- Modify: `src/graphql/resolvers/mutation/index.ts`
- Test: `tests/graphql/receipts.test.ts`

**Interfaces:**
- Consumes: `inspectReceiptFile`, `ReceiptFileError`, `MAX_RECEIPT_BYTES` (Task 1); таблица `receiptFile` (Task 3).
- Produces: мутация `uploadReceipt(file: ReceiptFileInput!): Receipt!`, набор `receiptMutations`, поля `Receipt.mediaType` и `Receipt.byteSize` в GraphQL.

- [ ] **Step 1: Поправить схему GraphQL**

В `src/graphql/schema.graphql`: в типе `Receipt` добавить два поля, рядом с `AnnouncementImageInput` — новый `input`, в `Mutation` — мутацию.

```graphql
type Receipt {
  id: ID!
  "/api/receipts/:id — ссылка на приложение, а не на хранилище (§8.4)"
  url: String!
  mediaType: String!
  "Размер файла в байтах: для подписи кнопки «PDF · 1,2 МБ»"
  byteSize: Int!
  extraction: ReceiptExtraction
}

input ReceiptFileInput {
  "У GraphQL нет своего способа передать файл"
  base64: String!
  "Только сверяется: решает сигнатура файла (§8.4)"
  mediaType: String
}
```

В блок `type Mutation` добавить перед взносами:

```graphql
  # Чеки (§8.4)
  uploadReceipt(file: ReceiptFileInput!): Receipt!
```

- [ ] **Step 2: Перегенерировать типы**

Запустить: `npm run codegen`
Ожидается: в `src/graphql/generated/graphql.ts` появились `MutationUploadReceiptArgs` и `ReceiptFileInput`.

- [ ] **Step 3: Написать падающий тест**

Создать `tests/graphql/receipts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

const UPLOAD = `
  mutation ($file: ReceiptFileInput!) {
    uploadReceipt(file: $file) {
      id
      url
      mediaType
      byteSize
    }
  }
`;

/** Настоящий PDF: разбору хватает сигнатуры `%PDF-`. */
const PDF_BASE64 = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n').toString('base64');

describe('загрузка чека', () => {
  it('требует входа', async () => {
    const db = seedOffice();
    const result = await run(UPLOAD, {
      db: db.client,
      variables: { file: { base64: PDF_BASE64, mediaType: 'application/pdf' } },
    });
    expect(errorCode(result)).toBe('UNAUTHENTICATED');
  });

  it('доступна участнику: чек взноса прикладывает он сам (§6.2)', async () => {
    const db = seedOffice();
    const data = await runOk(UPLOAD, {
      db: db.client,
      userId: 'u-0',
      variables: { file: { base64: PDF_BASE64, mediaType: 'application/pdf' } },
    });

    const receipt = data.uploadReceipt as { id: string; url: string; mediaType: string; byteSize: number };
    expect(receipt.url).toBe(`/api/receipts/${receipt.id}`);
    expect(receipt.mediaType).toBe('application/pdf');
    expect(receipt.byteSize).toBe(Buffer.from(PDF_BASE64, 'base64').byteLength);
  });

  it('кладёт байты отдельной таблицей и помечает место хранения', async () => {
    const db = seedOffice();
    const data = await runOk(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { file: { base64: PDF_BASE64 } },
    });

    const { id } = data.uploadReceipt as { id: string };
    expect(db.tables.receiptFile.rows).toHaveLength(1);
    expect(db.tables.receipt.rows[0]).toMatchObject({ id, storageKey: `db:${id}` });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toContain('receipt.upload');
  });

  it('отказывает файлу, который не является чеком', async () => {
    const db = seedOffice();
    const result = await run(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        file: {
          base64: Buffer.from('<!doctype html><script>alert(1)</script>').toString('base64'),
          mediaType: 'application/pdf',
        },
      },
    });

    expect(errorCode(result)).toBe('BAD_INPUT');
    // Отказ не оставляет за собой ни чека, ни файла.
    expect(db.tables.receipt.rows).toHaveLength(0);
    expect(db.tables.receiptFile.rows).toHaveLength(0);
  });

  it('отказывает, когда объявленный тип расходится с настоящим', async () => {
    const db = seedOffice();
    const result = await run(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { file: { base64: PDF_BASE64, mediaType: 'image/png' } },
    });
    expect(errorCode(result)).toBe('BAD_INPUT');
  });
});
```

- [ ] **Step 4: Убедиться, что тест падает**

Запустить: `npx vitest run tests/graphql/receipts.test.ts`
Ожидается: FAIL — резолвера `uploadReceipt` нет, схема требует его реализации.

- [ ] **Step 5: Написать резолвер**

Создать `src/graphql/resolvers/mutation/receipt.ts`:

```ts
import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import { badInput } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { writeAudit } from '@/lib/data';
import { MAX_RECEIPT_BYTES, ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

/**
 * Загрузка файла чека (§8.4).
 *
 * Доступна любому вошедшему: чек заказа прикладывает администратор (§6.5),
 * чек взноса — сам участник (§6.2). Правá на **запись**, к которой чек
 * прикрепится, проверяет та мутация, а не эта: сам по себе загруженный файл
 * ни к чему не привязан и никому не виден (правило видимости в §8.4).
 *
 * Метаданные и байты пишутся одной транзакцией: чек без файла означал бы
 * ссылку в заказе, ведущую в пустоту.
 */
export const receiptMutations: Pick<MutationResolvers<GraphQLContext>, 'uploadReceipt'> = {
  uploadReceipt: async (_parent, { file }, ctx) => {
    const user = await requireUser(ctx);

    // База64 раздувает данные на треть. Предел проверяется до декодирования:
    // разворачивать в память заведомо слишком большую строку незачем.
    if (file.base64.length > Math.ceil((MAX_RECEIPT_BYTES * 4) / 3) + 1024) {
      throw badInput(
        `Файл больше ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Уменьшите его и попробуйте снова.`,
        { field: 'file' },
      );
    }

    const bytes = Buffer.from(file.base64, 'base64');

    let info;
    try {
      info = inspectReceiptFile(new Uint8Array(bytes), file.mediaType);
    } catch (cause) {
      if (cause instanceof ReceiptFileError) {
        throw badInput(cause.message, { field: 'file' });
      }
      throw cause;
    }

    return ctx.db.$transaction(async (tx) => {
      const row = await tx.receipt.create({
        data: {
          // Место хранения известно только после того, как выдан id (ADR-0003).
          storageKey: '',
          mediaType: info.mediaType,
          byteSize: info.byteSize,
        },
      });

      const stored = await tx.receipt.update({
        where: { id: row.id },
        data: { storageKey: `db:${row.id}` },
      });

      await tx.receiptFile.create({ data: { receiptId: row.id, bytes } });

      await writeAudit(tx, {
        actorId: user.id,
        action: 'receipt.upload',
        entity: 'receipt',
        entityId: row.id,
        after: { mediaType: info.mediaType, byteSize: info.byteSize },
      });

      return stored;
    });
  },
};
```

- [ ] **Step 6: Зарегистрировать мутацию**

В `src/graphql/resolvers/mutation/index.ts` добавить импорт `import { receiptMutations } from './receipt';` и раскрыть набор в объекте `Mutation` строкой `...receiptMutations,` после `...authMutations,`.

- [ ] **Step 7: Прогнать тесты**

Запустить: `npx vitest run tests/graphql/receipts.test.ts`
Ожидается: PASS, пять тестов.

- [ ] **Step 8: Проверить типы и линтер**

Запустить: `npm run typecheck && npm run lint`
Ожидается: чисто.

- [ ] **Step 9: Коммит**

```bash
git add src/graphql/schema.graphql src/graphql/generated src/graphql/resolvers/mutation/receipt.ts src/graphql/resolvers/mutation/index.ts tests/graphql/receipts.test.ts
git commit -m "feat(graphql): uploadReceipt mutation stores the file in the database"
```

---

### Task 5: Чек обязателен у заказа

**Files:**
- Modify: `src/graphql/schema.graphql`
- Modify: `src/graphql/resolvers/mutation/order.ts:33-38`
- Modify: `tests/support/office.ts`
- Modify: `tests/graphql/orders.test.ts`, `tests/graphql/invariant.test.ts:39`, `tests/graphql/absences.test.ts:104-113`

**Interfaces:**
- Consumes: таблица `receipt` подставной базы (Task 3).
- Produces: `RECEIPT_ID: string` из `tests/support/office`; `WaterOrderInput.receiptFileId: ID!`.

- [ ] **Step 1: Дать подставному офису готовый чек**

В `tests/support/office.ts` добавить экспорт и посев — заказ без чека больше не создать, и каждому тесту заводить его руками незачем:

```ts
/** Чек, лежащий в подставной базе с самого начала: заказ без него не создать (§6.5). */
export const RECEIPT_ID = 'r-1';
```

Внутри `seedOffice`, сразу после посева `fundSettings`:

```ts
  db.tables.receipt.seed([
    {
      id: RECEIPT_ID,
      storageKey: `db:${RECEIPT_ID}`,
      mediaType: 'application/pdf',
      byteSize: 2048,
      extraction: null,
    },
  ]);
```

- [ ] **Step 2: Написать падающий тест**

В `tests/graphql/orders.test.ts` добавить `receiptFileId` в общий ввод и новый тест. Заменить константу:

```ts
const ORDER_INPUT = {
  amount: 300_000,
  orderedAt: '2026-06-05',
  bottlesCount: 10,
  supplier: 'Аквафор Доставка',
  receiptFileId: RECEIPT_ID,
};
```

Импорт в шапке файла заменить на `import { ADMIN_ID, RECEIPT_ID, seedOffice } from '../support/office';`, и добавить в `describe('внесение заказа', …)` два теста:

```ts
  it('без чека не проходит: поставка отмечается только с подтверждением (§6.5)', async () => {
    const db = seedOffice();
    const { receiptFileId: _dropped, ...withoutReceipt } = ORDER_INPUT;

    const result = await run(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: withoutReceipt },
    });

    // Обязательность держится схемой, а не разметкой формы.
    expect(result.errors?.[0]?.message ?? '').toContain('receiptFileId');
    expect(db.tables.waterOrder.rows).toHaveLength(0);
  });

  it('с несуществующим чеком не проходит', async () => {
    const db = seedOffice();
    const result = await run(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...ORDER_INPUT, receiptFileId: '00000000-0000-0000-0000-000000000000' } },
    });

    expect(errorCode(result)).toBe('NOT_FOUND');
    expect(db.tables.waterOrder.rows).toHaveLength(0);
  });
```

- [ ] **Step 3: Убедиться, что тест падает**

Запустить: `npx vitest run tests/graphql/orders.test.ts`
Ожидается: FAIL — сейчас заказ без чека создаётся, и первый из новых тестов красный.

- [ ] **Step 4: Сделать поле обязательным в схеме**

В `src/graphql/schema.graphql`, в `input WaterOrderInput`, заменить `receiptFileId: ID` на:

```graphql
  """
  Обязателен: поставка без подтверждения оплаты не отмечается (§6.5).
  Колонка в базе остаётся NULL-разрешающей ради заказов, заведённых раньше.
  """
  receiptFileId: ID!
```

Запустить: `npm run codegen`

- [ ] **Step 5: Упростить резолвер**

В `src/graphql/resolvers/mutation/order.ts` заменить условную проверку

```ts
    if (input.receiptFileId != null) {
      const receipt = await ctx.loaders.receiptById.load(input.receiptFileId);
      if (receipt === null) {
        throw notFound('Чек не найден. Загрузите файл заново.', { receiptFileId: input.receiptFileId });
      }
    }
```

на безусловную:

```ts
    // Чек обязателен (§6.5): проверяем, что он действительно есть в базе, —
    // иначе заказ сослался бы на файл, которого нет.
    const receipt = await ctx.loaders.receiptById.load(input.receiptFileId);
    if (receipt === null) {
      throw notFound('Чек не найден. Загрузите файл заново.', { receiptFileId: input.receiptFileId });
    }
```

и в `data` заказа заменить `receiptId: input.receiptFileId ?? null` на `receiptId: input.receiptFileId`.

- [ ] **Step 6: Починить остальные тесты, создающие заказы**

В `tests/graphql/invariant.test.ts` заменить строку 39 на:

```ts
const ORDER = `mutation ($amount: Money!, $orderedAt: Date!, $receiptFileId: ID!) { createWaterOrder(input: { amount: $amount, orderedAt: $orderedAt, receiptFileId: $receiptFileId }) { id } }`;
```

и в вызов на строке ~104 добавить `receiptFileId: RECEIPT_ID` в объект `variables`, дополнив импорт из `../support/office` именем `RECEIPT_ID`.

В `tests/graphql/absences.test.ts` заменить ввод заказа на:

```ts
        variables: { input: { amount: 200_000, orderedAt: '2026-06-01', receiptFileId: RECEIPT_ID } },
```

и так же дополнить импорт.

- [ ] **Step 7: Прогнать все тесты**

Запустить: `npm test`
Ожидается: PASS — все тесты, включая генеративные тесты инварианта.

- [ ] **Step 8: Проверить типы**

Запустить: `npm run typecheck`
Ожидается: чисто.

- [ ] **Step 9: Коммит**

```bash
git add src/graphql/schema.graphql src/graphql/generated src/graphql/resolvers/mutation/order.ts tests
git commit -m "feat(orders): a delivery cannot be recorded without a receipt (SPEC 6.5)"
```

---

### Task 6: Выдача чека по адресу приложения

**Files:**
- Create: `src/app/api/receipts/[id]/route.ts`
- Modify: `prisma/seed-mock.ts:174-180,238-250`
- Modify: `scripts/smoke.ts`

**Interfaces:**
- Consumes: `canViewReceipt` (Task 2), модель `ReceiptFile` (Task 3).
- Produces: адрес `GET /api/receipts/:id` (и `?download=1`), на который уже ссылается `Receipt.url`.

- [ ] **Step 1: Написать маршрут**

Создать `src/app/api/receipts/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';
import { canViewReceipt } from '@/lib/receipts/access';

/**
 * Выдача файла чека (§8.4).
 *
 * Адрес ведёт на приложение, а не на хранилище (`Receipt.url`): байты сегодня
 * лежат в базе, завтра могут переехать (ADR-0003), и это не должно означать
 * правку схемы и клиента. Тем же устроена картинка объявления (§6.12).
 *
 * Чек не публичен. Касса — внутреннее приложение, и квитанция с фамилией и
 * суммой не должна открываться по ссылке кому угодно: кто именно её видит,
 * решает чистое правило `canViewReceipt`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Расширение для имени файла при сохранении. */
const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (user === null) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Требуется вход.' } },
      { status: 401 },
    );
  }

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      mediaType: true,
      createdAt: true,
      file: { select: { bytes: true } },
      waterOrders: { select: { id: true } },
      contributions: { select: { userId: true } },
    },
  });

  // Тот же ответ и у несуществующего, и у чужого: «есть, но не для тебя» —
  // лишнее знание о чужих взносах.
  const missing = NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Чек не найден.' } },
    { status: 404 },
  );

  const bytes = receipt?.file?.bytes;
  if (receipt == null || bytes == null) return missing;

  const visible = canViewReceipt(
    {
      orderIds: receipt.waterOrders.map((order) => order.id),
      contributionUserIds: receipt.contributions.map((contribution) => contribution.userId),
    },
    user,
  );
  if (!visible) return missing;

  // Файл чека неизменяем: метка версии — момент его создания.
  const etag = `"${receipt.createdAt.getTime().toString(36)}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const download = new URL(request.url).searchParams.get('download') === '1';
  const name = `receipt-${receipt.createdAt.toISOString().slice(0, 10)}.${EXTENSION[receipt.mediaType] ?? 'bin'}`;

  const headers: Record<string, string> = {
    'Content-Type': receipt.mediaType,
    'Content-Length': String(bytes.byteLength),
    ETag: etag,
    // `private` — чек принадлежит вошедшему, общим кешам его не отдаём.
    'Cache-Control': 'private, max-age=0, must-revalidate',
    // Тип определён по сигнатуре при загрузке; запрещаем браузеру угадывать
    // его заново и наткнуться на что-то исполняемое.
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': download ? `attachment; filename="${name}"` : 'inline',
  };

  // Встроенный просмотрщик PDF умеет исполнять JavaScript из документа,
  // а документ отдаётся со своего домена — поэтому песочница (§8.4).
  if (receipt.mediaType === 'application/pdf') {
    headers['Content-Security-Policy'] = 'sandbox';
  }

  return new Response(new Uint8Array(bytes), { headers });
}
```

- [ ] **Step 2: Проверить типы и линтер**

Запустить: `npm run typecheck && npm run lint`
Ожидается: чисто.

- [ ] **Step 3: Завести демо-чеки**

В `prisma/seed-mock.ts` дополнить очистку (порядок важен: сначала то, что ссылается) — после `await prisma.waterOrder.deleteMany();` добавить:

```ts
  await prisma.receiptFile.deleteMany();
  await prisma.receipt.deleteMany();
```

Рядом с остальными константами файла добавить генератор:

```ts
/**
 * Демонстрационный чек: настоящий однопиксельный PNG.
 *
 * Байты зашиты нарочно — демо-данные обязаны быть детерминированными, иначе
 * скриншоты и отладка разъезжаются от запуска к запуску (§14а).
 */
const DEMO_RECEIPT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function createDemoReceipt(): Promise<string> {
  const receipt = await prisma.receipt.create({
    data: { storageKey: '', mediaType: 'image/png', byteSize: DEMO_RECEIPT.byteLength },
  });
  await prisma.receipt.update({
    where: { id: receipt.id },
    data: { storageKey: `db:${receipt.id}` },
  });
  await prisma.receiptFile.create({ data: { receiptId: receipt.id, bytes: DEMO_RECEIPT } });
  return receipt.id;
}
```

В цикле создания заказов (`for (const order of ORDERS)`) заменить создание строки на:

```ts
    // Чек есть не у каждого: часть истории заведена до того, как он стал
    // обязательным, и экран обязан показывать оба случая честно (§6.5).
    const receiptId = order.day % 2 === 0 ? await createDemoReceipt() : null;

    const created = await prisma.waterOrder.create({
      data: {
        amount: BigInt(amount),
        orderedAt: dayFromStart(order.day),
        bottlesCount: order.bottles,
        supplier: 'Аквафор Доставка',
        createdBy: admin.id,
        receiptId,
      },
    });
```

- [ ] **Step 4: Добавить дымовую проверку**

В `scripts/smoke.ts`, в `main()` — после блока «Права» и до блока «Страницы»:

```ts
  // ─── Чеки (§8.4) ──────────────────────────────────────────────────────
  const withReceipt = await prisma.waterOrder.findFirst({
    where: { receiptId: { not: null } },
    select: { receiptId: true },
  });

  if (withReceipt?.receiptId == null) {
    report(false, 'в базе нет заказа с чеком', 'выполните db:seed:mock');
  } else {
    const path = `/api/receipts/${withReceipt.receiptId}`;

    const guestReceipt = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    report(guestReceipt.status === 401, 'чек не отдаётся без входа', `статус ${guestReceipt.status}`);

    const memberReceipt = await fetch(`${BASE}${path}`, { headers: { cookie: cookies.member } });
    const type = memberReceipt.headers.get('content-type') ?? '';
    report(
      memberReceipt.status === 200 && (type.startsWith('image/') || type === 'application/pdf'),
      'чек заказа открыт участнику',
      `статус ${memberReceipt.status}, тип ${type}`,
    );

    const etag = memberReceipt.headers.get('etag') ?? '';
    const cached = await fetch(`${BASE}${path}`, {
      headers: { cookie: cookies.member, 'if-none-match': etag },
    });
    report(cached.status === 304, 'повторный запрос чека отдаёт 304', `статус ${cached.status}`);
  }
```

- [ ] **Step 5: Прогнать тесты и сборку**

Запустить: `npm test && npm run typecheck && npm run lint`
Ожидается: чисто. `npm run smoke` требует поднятой базы и дев-сервера — его прогоняет Task 10.

- [ ] **Step 6: Коммит**

```bash
git add src/app/api/receipts prisma/seed-mock.ts scripts/smoke.ts
git commit -m "feat(receipts): serve a receipt from the app behind login (SPEC 8.4)"
```

---

### Task 7: Данные экрана

**Files:**
- Modify: `src/lib/data/queries.ts:134-160`
- Modify: `src/lib/format/labels.ts`, `src/lib/format/index.ts`
- Test: `tests/ui/format.test.ts`

**Interfaces:**
- Consumes: поле `Receipt.byteSize` (Task 3).
- Produces: `type OrderReceipt = { id: string; mediaType: string; byteSize: number }`, поле `OrderRow.receipt: OrderReceipt | null`, `formatFileSize(bytes: number): string` из `@/lib/format`.

- [ ] **Step 1: Написать падающий тест**

В `tests/ui/format.test.ts` добавить блок, дополнив импорт именем `formatFileSize`:

```ts
describe('размер файла', () => {
  it('до килобайта считает в байтах', () => {
    expect(formatFileSize(512)).toBe('512 Б');
  });

  it('килобайты — с одним знаком, пока их мало', () => {
    expect(formatFileSize(1536)).toBe('1,5 КБ');
    expect(formatFileSize(64 * 1024)).toBe('64 КБ');
  });

  it('мегабайты — так же', () => {
    expect(formatFileSize(1024 * 1024 + 512 * 1024)).toBe('1,5 МБ');
  });

  it('десятичный разделитель — запятая, как во всех числах интерфейса', () => {
    expect(formatFileSize(2560)).toContain(',');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `npx vitest run tests/ui/format.test.ts`
Ожидается: FAIL — `formatFileSize` не экспортируется.

- [ ] **Step 3: Написать `formatFileSize`**

В `src/lib/format/labels.ts` добавить:

```ts
/**
 * Размер файла человеческим языком: `1536` → `1,5 КБ` (§6.5).
 *
 * Дробная часть здесь допустима: это не деньги, а подпись кнопки, и правило
 * «только целые копейки» к ней не относится.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${round(kb)} КБ`;

  return `${round(kb / 1024)} МБ`;
}

/** До десяти — с одним знаком после запятой, дальше он только мешает. */
function round(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0).replace('.0', '').replace('.', ',');
}
```

В `src/lib/format/index.ts` добавить `formatFileSize` в список экспортов из `./labels`.

- [ ] **Step 4: Прогнать тест**

Запустить: `npx vitest run tests/ui/format.test.ts`
Ожидается: PASS.

- [ ] **Step 5: Отдать чек вместе с заказом**

В `src/lib/data/queries.ts` заменить тип и запрос `listOrders`:

```ts
/** Чек заказа: ровно то, что нужно кнопке, — без байтов и без распознавания. */
export type OrderReceipt = {
  id: string;
  mediaType: string;
  byteSize: number;
};

export type OrderRow = {
  id: string;
  amount: number;
  orderedAt: IsoDate;
  bottlesCount: number | null;
  supplier: string | null;
  note: string | null;
  createdBy: string;
  receiptId: string | null;
  receipt: OrderReceipt | null;
};

/** История заказов §6.5, свежие сверху. */
export const listOrders = cache(async (): Promise<OrderRow[]> => {
  const rows = await prisma.waterOrder.findMany({
    orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
    // Только метаданные чека: байты лежат отдельной таблицей и списку
    // не нужны вовсе (ADR-0003).
    include: { receipt: { select: { id: true, mediaType: true, byteSize: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    amount: toKopecks(row.amount, `сумма заказа ${row.id}`),
    orderedAt: toIsoDate(row.orderedAt),
    bottlesCount: row.bottlesCount,
    supplier: row.supplier,
    note: row.note,
    createdBy: row.createdBy,
    receiptId: row.receiptId,
    receipt:
      row.receipt === null
        ? null
        : { id: row.receipt.id, mediaType: row.receipt.mediaType, byteSize: row.receipt.byteSize },
  }));
});
```

- [ ] **Step 6: Прогнать тесты и типы**

Запустить: `npm test && npm run typecheck`
Ожидается: чисто.

- [ ] **Step 7: Коммит**

```bash
git add src/lib/data/queries.ts src/lib/format tests/ui/format.test.ts
git commit -m "feat(orders): expose receipt metadata to the orders screen"
```

---

### Task 8: Предпросмотр чека

**Files:**
- Create: `src/components/receipt-preview.tsx`
- Create: `src/components/receipt-field.tsx`

**Interfaces:**
- Consumes: `RECEIPT_ACCEPT`, `MAX_RECEIPT_BYTES` (Task 1), `formatFileSize` (Task 7), `@/components/ui/dialog`.
- Produces:
  - `ReceiptPreview({ src, mediaType, title, label, variant? }): ReactNode` — кнопка, открывающая диалог с файлом по адресу;
  - `ReceiptField({ name, label }): ReactNode` — поле выбора файла с предпросмотром выбранного, до отправки.

Оба компонента клиентские: диалогу нужны обработчики, полю — `URL.createObjectURL`. Это то самое исключение из правила «клиентский компонент — не норма».

- [ ] **Step 1: Написать `src/components/receipt-preview.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Предпросмотр чека (§6.5).
 *
 * Один диалог на два случая: файл, уже лежащий в базе (`/api/receipts/:id`),
 * и файл, только что выбранный в форме (`blob:`-адрес). Отличается лишь
 * источник, поэтому компонент один.
 *
 * PDF показывается встроенным просмотрщиком браузера. На телефонах его нет
 * вовсе — там виден запасной текст со ссылкой, и это норма мобильных
 * браузеров, а не ошибка. Ссылка «открыть в новой вкладке» стоит в диалоге
 * всегда: она работает там, где встроенный просмотрщик не работает.
 */
export function ReceiptPreview({
  src,
  mediaType,
  title,
  label,
  description,
}: {
  src: string;
  mediaType: string;
  /** Заголовок диалога, он же описание картинки для чтения с экрана (§12). */
  title: string;
  label: string;
  description?: string;
}): ReactNode {
  const isPdf = mediaType === 'application/pdf';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? (isPdf ? 'PDF-квитанция.' : 'Снимок экрана или фотография чека.')}
          </DialogDescription>
        </DialogHeader>

        {isPdf ? (
          <object data={src} type="application/pdf" className="border-border h-[70vh] w-full rounded-md border">
            <p className="p-4 text-sm">
              Браузер не показывает PDF прямо здесь.{' '}
              <a className="underline" href={src} target="_blank" rel="noreferrer">
                Откройте чек в новой вкладке
              </a>
              .
            </p>
          </object>
        ) : (
          // Обычный `<img>`, а не `next/image`: оптимизатор ходил бы за файлом
          // отдельным запросом без cookie и получил бы 404, а `blob:`-адрес
          // ему недоступен вовсе.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} className="max-h-[70vh] w-full rounded-md object-contain" />
        )}

        <a className="text-muted-foreground text-sm underline" href={src} target="_blank" rel="noreferrer">
          Открыть в новой вкладке
        </a>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Написать `src/components/receipt-field.tsx`**

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { ReceiptPreview } from '@/components/receipt-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatFileSize } from '@/lib/format';
import { MAX_RECEIPT_BYTES, RECEIPT_ACCEPT } from '@/lib/receipts/file';

/**
 * Поле выбора чека с предпросмотром до отправки (§6.5).
 *
 * Клиентский компонент по необходимости: предпросмотр читает выбранный файл
 * браузерным `URL.createObjectURL`, ничего не отправляя на сервер, — чтобы
 * человек увидел, что приложил тот чек, а не соседний файл из папки.
 *
 * Адрес объекта освобождается при смене файла и при уходе компонента: иначе
 * браузер держит выбранные файлы в памяти до перезагрузки страницы.
 */
export function ReceiptField({
  name = 'receipt',
  id = 'order-receipt',
}: {
  name?: string;
  id?: string;
}): ReactNode {
  const [picked, setPicked] = useState<{ url: string; type: string; name: string; size: number } | null>(
    null,
  );

  useEffect(() => {
    if (picked === null) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Чек</Label>

      <Input
        id={id}
        name={name}
        type="file"
        accept={RECEIPT_ACCEPT}
        required
        aria-describedby={`${id}-hint`}
        className="file:text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setPicked(
            file === null
              ? null
              : { url: URL.createObjectURL(file), type: file.type, name: file.name, size: file.size },
          );
        }}
      />

      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        PDF или снимок экрана, до {Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Поставка
        отмечается только с подтверждением оплаты.
      </p>

      {picked !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground truncate">
            {picked.name} · {formatFileSize(picked.size)}
          </span>
          <ReceiptPreview
            src={picked.url}
            mediaType={picked.type}
            title="Выбранный чек"
            label="Предпросмотр"
            description="Файл ещё не отправлен — так он будет выглядеть у остальных."
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить типы и линтер**

Запустить: `npm run typecheck && npm run lint`
Ожидается: чисто. Если линтер ругается на `<img>` — убедиться, что комментарий `eslint-disable-next-line @next/next/no-img-element` стоит **непосредственно** перед тегом.

- [ ] **Step 4: Коммит**

```bash
git add src/components/receipt-preview.tsx src/components/receipt-field.tsx
git commit -m "feat(ui): receipt preview dialog for images and PDFs"
```

---

### Task 9: Форма «Отметить поставку» и чек в списке

**Files:**
- Create: `src/lib/actions/orders.ts`
- Create: `src/components/order-form.tsx`
- Modify: `src/app/(app)/orders/page.tsx`

**Interfaces:**
- Consumes: `uploadReceipt` и `createWaterOrder` (Tasks 4–5), `ReceiptField`, `ReceiptPreview` (Task 8), `OrderRow.receipt` (Task 7), `ActionForm` и `ActionState` из `@/components/admin`.
- Produces: `createWaterOrderAction(previous: ActionState, form: FormData): Promise<ActionState>`, компонент `OrderForm({ today }: { today: string })`.

- [ ] **Step 1: Написать серверное действие**

Создать `src/lib/actions/orders.ts`:

```ts
'use server';

/**
 * Отметить поставку воды (§6.5).
 *
 * Действие не ходит по HTTP к собственному `/api/graphql` и не пишет в Prisma
 * само (ADR-0002): оно зовёт те же резолверы, что обслуживают эндпоинт, —
 * там проверка роли, транзакция, строка в журнале операций и аудит. Второй
 * реализации этих правил в проекте нет, и заводить её нельзя: разойдясь, они
 * дали бы заказ, который есть в таблице, но не в журнале, и инвариант §5
 * сломался бы тихо.
 *
 * Чек загружается **до** создания заказа: `createWaterOrder` требует готовый
 * `receiptFileId`. Если вторая мутация откажет, загруженный чек останется
 * ни к чему не привязанным — он никому не виден (§8.4) и виден в аудите.
 */

import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';
import { revalidatePath } from 'next/cache';

import type { ActionState } from '@/components/admin/action-state';
import type { GraphQLContext } from '@/graphql/context';
import type {
  MutationCreateWaterOrderArgs,
  MutationUploadReceiptArgs,
} from '@/graphql/generated/graphql';
import { orderMutations } from '@/graphql/resolvers/mutation/order';
import { receiptMutations } from '@/graphql/resolvers/mutation/receipt';
import { parseRubles } from '@/lib/money';
import { ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

import { actionContext } from './runtime';

/** Резолверам заказа разбор GraphQL-документа не нужен: они его не читают. */
const NO_INFO = {} as GraphQLResolveInfo;

type Call<TArgs> = (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo,
) => Promise<unknown>;

const call = {
  upload: receiptMutations.uploadReceipt as Call<MutationUploadReceiptArgs>,
  create: orderMutations.createWaterOrder as Call<MutationCreateWaterOrderArgs>,
};

function ok(message: string): ActionState {
  return { status: 'success', message };
}

function failed(cause: unknown): ActionState {
  // `GraphQLError`, `ReceiptFileError` и `RangeError` разбора суммы несут
  // формулировку, написанную для человека. Всё остальное — настоящая
  // поломка: подробности в лог, наружу нейтрально.
  if (cause instanceof GraphQLError) return { status: 'error', message: cause.message };
  if (cause instanceof ReceiptFileError) return { status: 'error', message: cause.message };
  if (cause instanceof RangeError) return { status: 'error', message: cause.message };

  console.error('[waterdrinkers] поставку отметить не удалось:', cause);
  return {
    status: 'error',
    message: 'Не удалось отметить поставку. Подробности — в логе сервера.',
  };
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(form: FormData, name: string): string | null {
  const value = text(form, name);
  return value === '' ? null : value;
}

function required(form: FormData, name: string, what: string): string {
  const value = text(form, name);
  if (value === '') throw new RangeError(`Заполните поле «${what}».`);
  return value;
}

/**
 * Пустое поле выбора файла приходит как `File` нулевой длины, а не как
 * отсутствие поля, — иначе форма без чека падала бы на разборе пустых байтов
 * вместо внятного «приложите чек».
 */
function pickedFile(form: FormData, name: string): File | null {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function bottles(form: FormData): number | null {
  const value = text(form, 'bottlesCount');
  if (value === '') return null;

  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('Количество бутылей — целое положительное число.');
  }
  return count;
}

export async function createWaterOrderAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const file = pickedFile(form, 'receipt');
    if (file === null) {
      throw new RangeError('Приложите чек: поставка без подтверждения оплаты не отмечается.');
    }

    // Формат проверяется здесь же, до обращения к базе: неподходящий файл
    // не должен доезжать до транзакции. Это не второй рубеж правил, а тот
    // же самый — `inspectReceiptFile` один на оба места, и резолвер зовёт
    // его снова уже как последнюю границу перед базой.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectReceiptFile(bytes, file.type);

    const amount = parseRubles(required(form, 'amount', 'сумма'));
    const orderedAt = required(form, 'orderedAt', 'дата поставки');
    const bottlesCount = bottles(form);

    const context = await actionContext();

    const receipt = (await call.upload(
      null,
      { file: { base64: Buffer.from(bytes).toString('base64'), mediaType: info.mediaType } },
      context,
      NO_INFO,
    )) as { id: string };

    await call.create(
      null,
      {
        input: {
          amount,
          orderedAt,
          bottlesCount,
          supplier: optionalText(form, 'supplier'),
          note: optionalText(form, 'note'),
          receiptFileId: receipt.id,
        },
      },
      context,
      NO_INFO,
    );
  } catch (cause) {
    return failed(cause);
  }

  // Заказ двигает остаток фонда и балансы: их показывают главная, «Фонд» и
  // шапка на каждой странице — поэтому обновляется весь макет, а не раздел.
  revalidatePath('/', 'layout');
  return ok('Поставка отмечена, чек приложен.');
}
```

- [ ] **Step 2: Написать форму**

Создать `src/components/order-form.tsx`:

```tsx
import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { ReceiptField } from '@/components/receipt-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createWaterOrderAction } from '@/lib/actions/orders';

/**
 * Отметить поставку (§6.5).
 *
 * Серверный компонент: разметка полей в бандл не едет, клиентской остаётся
 * только обвязка формы и поле чека. Карточка стоит на странице «Заказы», а не
 * в админ-панели, потому что так думает человек: привезли воду — иду в
 * «Заказы». Права от места не зависят — их проверяет резолвер.
 */
export function OrderForm({ today }: { today: string }): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Отметить поставку</CardTitle>
        <CardDescription>
          Деньги уходят из общего фонда сразу и раскладываются по участникам за период
          потребления (§4.4). Чек обязателен: по нему любой участник проверит трату.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ActionForm action={createWaterOrderAction} submitLabel="Отметить поставку">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-ordered-at">Дата поставки</Label>
              <Input id="order-ordered-at" name="orderedAt" type="date" defaultValue={today} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-amount">Сумма, ₽</Label>
              <Input
                id="order-amount"
                name="amount"
                inputMode="decimal"
                placeholder="3000"
                required
                aria-describedby="order-amount-hint"
              />
              <p id="order-amount-hint" className="text-muted-foreground text-xs">
                Рубли и копейки: 3000 или 3000,50.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-bottles">Бутылей</Label>
              <Input id="order-bottles" name="bottlesCount" inputMode="numeric" placeholder="10" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-supplier">Поставщик</Label>
              <Input id="order-supplier" name="supplier" placeholder="Аквафор Доставка" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-note">Примечание</Label>
              <Input id="order-note" name="note" placeholder="Привезли на два дня позже" />
            </div>

            <ReceiptField />
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Показать форму и чеки на странице заказов**

В `src/app/(app)/orders/page.tsx`:

1. Дополнить импорты:

```tsx
import { OrderForm } from '@/components/order-form';
import { ReceiptPreview } from '@/components/receipt-preview';
import { formatFileSize } from '@/lib/format';
```

(`formatFileSize` добавляется в уже существующий импорт из `@/lib/format`.)

2. Сразу после `<PageHeader …>…</PageHeader>` добавить карточку формы:

```tsx
      {currentUser.role === 'ADMIN' && <OrderForm today={today} />}
```

3. В раскрытии заказа, сразу после абзаца с периодом потребления и до таблицы долей, добавить строку с чеком:

```tsx
                        <div className="flex flex-wrap items-center gap-2">
                          {order.receipt === null ? (
                            <p className="text-muted-foreground text-xs">
                              Чек не приложен: заказ заведён до того, как чек стал обязательным.
                            </p>
                          ) : (
                            <ReceiptPreview
                              src={`/api/receipts/${order.receipt.id}`}
                              mediaType={order.receipt.mediaType}
                              title={`Чек заказа от ${formatDate(order.orderedAt)}`}
                              label={`Чек · ${formatFileSize(order.receipt.byteSize)}`}
                            />
                          )}
                        </div>
```

- [ ] **Step 4: Проверить типы, линтер и сборку**

Запустить: `npm run typecheck && npm run lint && npm run build`
Ожидается: чисто; сборка проходит и показывает маршрут `/api/receipts/[id]`.

- [ ] **Step 5: Прогнать тесты**

Запустить: `npm test`
Ожидается: PASS — все тесты.

- [ ] **Step 6: Коммит**

```bash
git add src/lib/actions/orders.ts src/components/order-form.tsx "src/app/(app)/orders/page.tsx"
git commit -m "feat(orders): record a delivery with its receipt from the orders screen (SPEC 6.5)"
```

---

### Task 10: Документы и проверка вживую

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `src/components/contribution-form.tsx:62-78`
- Modify: `src/components/admin/entry-forms.tsx:84-88`

**Interfaces:**
- Consumes: всё предыдущее.
- Produces: обновлённое состояние работ; тексты-заглушки про чеки, которые больше не врут.

Заглушки во взносах написаны до того, как хранилище было выбрано, и теперь говорят неправду («под них ещё не выбрано хранилище»). Взносы в этой работе не меняются — меняется только текст.

- [ ] **Step 1: Поправить текст в форме взноса**

В `src/components/contribution-form.tsx` заменить абзац внутри блока «Чек» на:

```tsx
        <p className="text-muted-foreground mt-1 text-xs">
          К заказу воды чек уже прикладывается (§6.5). Для взносов прикрепление и
          распознавание появятся на этапе 6: тогда дата и сумма будут подставляться из
          чека, а пока их вводит человек, а администратор сверяет при подтверждении.
        </p>
```

И в комментарии-заголовке файла заменить упоминание невыбранного хранилища на ссылку на §8.4.

- [ ] **Step 2: Поправить текст в админской форме взноса**

В `src/components/admin/entry-forms.tsx` заменить абзац на:

```tsx
          <p className="text-muted-foreground text-xs">
            Чек к взносу прикладывается на этапе 6 вместе с распознаванием — выдумывать его
            данные приложение не станет. У заказов воды чек уже обязателен (§6.5).
          </p>
```

- [ ] **Step 3: Прогнать полную проверку**

Запустить: `npm test && npm run typecheck && npm run lint && npm run check:contrast && npm run build`
Ожидается: всё зелёное. Записать настоящие числа (сколько тестов, сколько маршрутов) — они пойдут в `PROGRESS.md`.

- [ ] **Step 4: Применить миграцию и посмотреть глазами**

Если база поднята: `npx prisma migrate deploy && npm run db:seed:mock`, затем `npm run dev` и `npm run smoke` в соседнем окне.

Проверить руками: форма видна администратору и не видна участнику; выбранный PDF и выбранный PNG открываются предпросмотром до отправки; после отправки заказ появляется в списке с кнопкой чека; чек открывается у участника; заказ без чека отправить нельзя.

**`prisma migrate reset` не выполнять** — в базе лежат данные владельца.

- [ ] **Step 5: Обновить `docs/PROGRESS.md`**

В таблицу «Сейчас» внести: сделано — чеки к заказам; следующий этап — 6 (распознавание). В таблице этапов отметить работу отдельной строкой после объявлений. В разделе «Решения, принятые по ходу» добавить:

```markdown
- **Чек к поставке обязателен, а колонка `water_orders.receipt_id` — нет.** Требование
  держится схемой GraphQL (`receiptFileId: ID!`), а не разметкой формы; `NULL` в базе
  остаётся ради девяти заказов, заведённых до появления правила. Решение владельца
  от 22.09.2026: прозрачность важнее удобства ввода.
- **Чек загружается отдельной мутацией до создания заказа.** `createWaterOrder` требует
  готовый `receiptFileId`, поэтому порядок именно такой; неудачное создание заказа
  оставляет ни к чему не привязанный чек — он никому не виден (§8.4) и виден в аудите.
```

Записать в блок проверок настоящие числа из шага 3.

- [ ] **Step 6: Коммит**

```bash
git add docs/PROGRESS.md src/components/contribution-form.tsx src/components/admin/entry-forms.tsx
git commit -m "docs(progress): order receipts are done; fix stale storage notes"
```

---

## Самопроверка плана

**Покрытие спецификации.**

| Требование | Задача |
|---|---|
| §6.5 форма «Отметить поставку» у администратора | 9 |
| §6.5 чек обязателен | 5, 9 |
| §6.5 предпросмотр в форме | 8 |
| §6.5 предпросмотр в списке, открыт всем участникам | 2, 8, 9 |
| §6.5 честный показ заказа без чека | 7, 9 |
| §8.4 форматы и предел 5 МБ | 1 |
| §8.4 тип по сигнатуре, расхождение — отказ | 1, 4 |
| §8.4 байты в базе отдельной таблицей, `storage_key` | 3, 4 |
| §8.4 загрузка формой в действие, `/api/upload` не трогаем | 9 |
| §8.4 выдача, права, ETag, `nosniff`, `sandbox`, `?download=1` | 2, 6 |
| §10.2 `uploadReceipt`, `ReceiptFileInput`, поля `Receipt` | 4 |
| §10.2 `receiptFileId: ID!` | 5 |
| §11 `receipt_files`, `byte_size`, `receipt_id` остаётся nullable | 3, 5 |
| ADR-0003 проверки соблюдения (чистые тесты, тесты мутации, тесты правила видимости) | 1, 2, 4 |

Пробел, оставленный сознательно: **тестов самого маршрута `/api/receipts/:id` в плане нет** — он тянет `next/headers` и Prisma, и в проекте нет ни одного теста маршрута. Вместо них правило видимости вынесено чистой функцией и покрыто модульно (Task 2), а сам маршрут проверяется дымовой проверкой на живой базе (Task 6, шаг 4) — ровно так же, как это устроено у картинок объявлений.

**Заглушек нет:** каждый шаг несёт готовый код или точную команду с ожидаемым результатом.

**Согласованность имён** проверена сквозь задачи: `inspectReceiptFile`/`ReceiptFileError`/`MAX_RECEIPT_BYTES`/`RECEIPT_ACCEPT` (1 → 4, 8, 9), `canViewReceipt` (2 → 6), `db.tables.receiptFile` (3 → 4), `RECEIPT_ID` (5), `OrderRow.receipt` и `formatFileSize` (7 → 8, 9), `ReceiptPreview`/`ReceiptField` (8 → 9), `createWaterOrderAction` (9).
