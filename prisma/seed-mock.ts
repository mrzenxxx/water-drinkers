import 'dotenv/config';

import { createHash } from 'node:crypto';

import { prisma } from '../src/lib/db';

/**
 * Демонстрационные данные для разработки.
 *
 * Реальных пользователей ещё нет, а посмотреть, как экраны выглядят
 * с настоящей историей, нужно уже сейчас. Здесь полгода жизни офиса:
 * заказы, взносы, отпуска, больничные, очередь на подтверждение,
 * один участник с долгом и один вышедший из состава.
 *
 * ⚠️ Только для разработки. Скрипт **стирает** взносы, заказы, отсутствия
 * и журнал операций, после чего наполняет их заново.
 *
 *   npm run db:seed:mock
 *
 * Данные детерминированы: один и тот же прогон даёт одну и ту же картинку,
 * иначе скриншоты и отладка разъезжались бы от запуска к запуску.
 */

const DOMAIN = 'sspk.spb.ru';
const ADMIN_EMAIL = `e.kondobarov@${DOMAIN}`;

/** Учёт начат полгода назад, ровно в первое число месяца. */
const START = startOfMonthMonthsAgo(6);

/** 500 ₽ в копейках. */
const RUB = 100;
const STANDARD_CONTRIBUTION = 500 * RUB;

type Person = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'PARTICIPANT';
  /** Смещение даты вступления от начала учёта, в днях. */
  joinOffset: number;
  /** Смещение выхода из состава, если человек ушёл. */
  leftOffset?: number;
};

const PEOPLE: Person[] = [
  { email: ADMIN_EMAIL, firstName: 'Евгений', lastName: 'Кондобаров', role: 'ADMIN', joinOffset: 0 },
  { email: `i.petrov@${DOMAIN}`, firstName: 'Иван', lastName: 'Петров', role: 'PARTICIPANT', joinOffset: 0 },
  { email: `a.smirnova@${DOMAIN}`, firstName: 'Анна', lastName: 'Смирнова', role: 'PARTICIPANT', joinOffset: 0 },
  { email: `d.volkov@${DOMAIN}`, firstName: 'Дмитрий', lastName: 'Волков', role: 'PARTICIPANT', joinOffset: 0 },
  { email: `m.orlova@${DOMAIN}`, firstName: 'Мария', lastName: 'Орлова', role: 'PARTICIPANT', joinOffset: 0 },
  { email: `s.gusev@${DOMAIN}`, firstName: 'Сергей', lastName: 'Гусев', role: 'PARTICIPANT', joinOffset: 0 },
  // Пришёл в середине периода — проверяет, что дни присутствия считаются от вступления.
  { email: `k.novikova@${DOMAIN}`, firstName: 'Ксения', lastName: 'Новикова', role: 'PARTICIPANT', joinOffset: 74 },
  // Ушёл, но остаток за ним числится — экран должен показывать и таких.
  { email: `p.lebedev@${DOMAIN}`, firstName: 'Павел', lastName: 'Лебедев', role: 'PARTICIPANT', joinOffset: 0, leftOffset: 128 },
];

/** Заказы: смещение в днях от начала учёта, сумма в рублях, бутылей. */
const ORDERS: { day: number; rubles: number; bottles: number }[] = [
  { day: 3, rubles: 2400, bottles: 8 },
  { day: 24, rubles: 2400, bottles: 8 },
  { day: 45, rubles: 3000, bottles: 10 },
  { day: 67, rubles: 2400, bottles: 8 },
  { day: 88, rubles: 2700, bottles: 9 },
  { day: 110, rubles: 3000, bottles: 10 },
  { day: 131, rubles: 2400, bottles: 8 },
  { day: 152, rubles: 3300, bottles: 11 },
  { day: 170, rubles: 2400, bottles: 8 },
];

/**
 * Объявления администратора (§6.12): закреплённая инструкция и пара новостей.
 *
 * Одно закреплено, остальные — по дате. Так на экране видно ровно то, ради
 * чего раздел затевался: инструкция не тонет, а свежее сообщение стоит первым
 * среди обычных.
 */
const ANNOUNCEMENTS: { title: string; body: string; dayOffset: number; pinned?: boolean }[] = [
  {
    title: 'Как пользоваться кассой',
    pinned: true,
    dayOffset: 1,
    body: [
      'Касса собирает деньги на бутилированную воду. Всё, что в неё внесено и из неё',
      'потрачено, видно всем.',
      '',
      'Как внести взнос:',
      '1. Откройте раздел «Мои взносы».',
      '2. Укажите сумму и дату платежа, приложите фото чека.',
      '3. Отправьте — взнос уйдёт на подтверждение администратору.',
      '',
      'На баланс взнос влияет только после подтверждения.',
      '',
      '- Отпуск и больничный отмечайте в разделе «Отсутствия»: за эти дни вода',
      '  на вас не раскладывается.',
      '- Любое число можно раскрыть: в разделе «Фонд» видно, из чего сложился баланс.',
    ].join('\n'),
  },
  {
    title: 'Сменили поставщика',
    dayOffset: 120,
    body: [
      'С этого месяца возим воду у «Аквалайн»: бутыль дешевле на 30 ₽, привозят по вторникам.',
      'На долях это скажется со следующего заказа.',
    ].join('\n'),
  },
  {
    title: 'Проверьте свой баланс перед отпуском',
    dayOffset: 168,
    body: [
      'Перед длинным отпуском стоит закрыть долг: пока вас нет, заказы всё равно проходят,',
      'а доля за дни отсутствия не начисляется только при отмеченном отпуске.',
      '',
      'Отметить отпуск: раздел «Отсутствия» → «Добавить».',
    ].join('\n'),
  },
];

/** Отсутствия: индекс участника, тип, начало и конец в днях от старта. */
const ABSENCES: { person: number; type: 'VACATION' | 'SICK_LEAVE'; from: number; to: number }[] = [
  { person: 1, type: 'VACATION', from: 40, to: 54 },
  { person: 2, type: 'SICK_LEAVE', from: 62, to: 68 },
  { person: 3, type: 'VACATION', from: 95, to: 116 },
  { person: 0, type: 'VACATION', from: 120, to: 133 },
  { person: 4, type: 'SICK_LEAVE', from: 141, to: 145 },
  { person: 5, type: 'VACATION', from: 150, to: 164 },
  { person: 2, type: 'VACATION', from: 172, to: 179 },
];

/**
 * Взносы: индекс участника и дни, когда он скидывался.
 *
 * Ритм — примерно раз в три недели, вслед за заказами. Частота подобрана так,
 * чтобы большинство было в плюсе: главная и дашборд держатся на контрасте
 * «должен / не должен» (§6.1, §12), и на сплошь красных данных этот контраст
 * пропадает — проверить, читается ли экран без чтения, становится нечем.
 *
 * Неровности здесь намеренные, как и требует §14а:
 *  * Сергей (5) отстал и обязан светиться должником;
 *  * Павел (7) вышел из состава с положительным остатком;
 *  * Ксения (6) пришла в середине и платит только со дня вступления;
 *  * Анна (2) и Мария (4) пропустили по взносу и держатся у нуля.
 */
const CONTRIBUTION_DAYS: Record<number, number[]> = {
  0: [2, 23, 44, 66, 87, 109, 130, 151, 169],
  1: [2, 23, 44, 66, 87, 109, 130, 151, 169],
  2: [2, 23, 44, 66, 87, 109, 130, 169],
  3: [2, 23, 44, 66, 87, 109, 130, 151, 169],
  4: [2, 23, 44, 66, 87, 109, 130, 151],
  5: [2, 44, 87],
  6: [87, 109, 130, 151, 169],
  7: [2, 23, 44, 66, 87, 109],
};

/** Взносы на подтверждении — наполняют очередь администратора. */
const PENDING_DAYS: Record<number, number[]> = {
  4: [176],
  5: [178],
};

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

/**
 * Устойчивый (не случайный) id демо-чека, выведенный из номера заказа.
 *
 * Настоящая мутация `uploadReceipt` (`src/graphql/resolvers/mutation/receipt.ts`)
 * получает id заранее через `randomUUID()` и пишет строку одной вставкой сразу
 * с правильным `storage_key = db:<id>` — без промежуточной пустой записи и
 * второго запроса на её исправление. Здесь тот же приём, но не `randomUUID()`:
 * демо-данные обязаны быть детерминированными (§14а), а он даёт новое значение
 * на каждый прогон. Хеш смещения дня заказа даёт тот же id при повторном сиде.
 */
function demoReceiptId(orderDay: number): string {
  const hash = createHash('sha256').update(`water-order-receipt:${orderDay}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x40; // версия 4
  hash[8] = (hash[8]! & 0x3f) | 0x80; // вариант RFC 4122
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function createDemoReceipt(orderDay: number): Promise<string> {
  const id = demoReceiptId(orderDay);
  await prisma.receipt.create({
    data: { id, storageKey: `db:${id}`, mediaType: 'image/png', byteSize: DEMO_RECEIPT.byteLength },
  });
  await prisma.receiptFile.create({ data: { receiptId: id, bytes: DEMO_RECEIPT } });
  return id;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed mock data in production');
  }

  console.info(`Начало учёта: ${iso(START)}`);

  // Дата начала учёта задаётся явно: с нулевым начальным сальдо она ничего
  // не отсекает, но экран «Фонд» должен показывать, с какого дня идёт счёт.
  await prisma.fundSettings.upsert({
    where: { id: 1 },
    update: { defaultContribution: BigInt(STANDARD_CONTRIBUTION), startDate: START },
    create: { id: 1, defaultContribution: BigInt(STANDARD_CONTRIBUTION), startDate: START },
  });

  // Порядок важен: сначала то, на что ссылаются, потом то, что ссылается.
  await prisma.fundTransaction.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.waterOrder.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.announcement.deleteMany();
  // Чеки удаляются после заказов и взносов — они на них ссылаются.
  await prisma.receiptFile.deleteMany();
  await prisma.receipt.deleteMany();

  const users = [];
  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { login: person.email.split('@')[0]! },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role,
        joinedAt: dayFromStart(person.joinOffset),
        leftAt: person.leftOffset === undefined ? null : dayFromStart(person.leftOffset),
      },
      create: {
        login: person.email.split('@')[0]!,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role,
        joinedAt: dayFromStart(person.joinOffset),
        leftAt: person.leftOffset === undefined ? null : dayFromStart(person.leftOffset),
      },
    });
    users.push(user);
  }

  const admin = users[0]!;

  /**
   * Объявления (§6.12): закреплённая инструкция и пара свежих сообщений.
   *
   * Пустой раздел на демонстрационных данных ничего не показывает, а весь
   * смысл раздела — в том, как выглядит закреплённое рядом с обычным.
   * Даты публикации разведены: непрочитанное считается по ним.
   */
  for (const notice of ANNOUNCEMENTS) {
    await prisma.announcement.create({
      data: {
        title: notice.title,
        body: notice.body,
        pinned: notice.pinned ?? false,
        publishedAt: dayFromStart(notice.dayOffset),
        createdBy: admin.id,
      },
    });
  }

  for (const absence of ABSENCES) {
    await prisma.absence.create({
      data: {
        userId: users[absence.person]!.id,
        type: absence.type,
        startsOn: dayFromStart(absence.from),
        endsOn: dayFromStart(absence.to),
        note: absence.type === 'VACATION' ? 'Отпуск' : 'Больничный',
      },
    });
  }

  let orderTotal = 0;
  for (const order of ORDERS) {
    const amount = order.rubles * RUB;

    // Чек есть не у каждого: часть истории заведена до того, как он стал
    // обязательным, и экран обязан показывать оба случая честно (§6.5).
    const receiptId = order.day % 2 === 0 ? await createDemoReceipt(order.day) : null;

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

    // Каждый заказ обязан иметь зеркальную операцию в журнале, иначе
    // остаток фонда разойдётся с историей и инвариант §5 упадёт.
    await prisma.fundTransaction.create({
      data: {
        type: 'ORDER',
        amount: BigInt(-amount),
        refId: created.id,
        createdBy: admin.id,
        createdAt: dayFromStart(order.day),
      },
    });
    orderTotal += amount;
  }

  let confirmedTotal = 0;
  let confirmedCount = 0;
  for (const [index, days] of Object.entries(CONTRIBUTION_DAYS)) {
    const user = users[Number(index)]!;

    for (const day of days) {
      const contribution = await prisma.contribution.create({
        data: {
          userId: user.id,
          amount: BigInt(STANDARD_CONTRIBUTION),
          paidAt: dayFromStart(day),
          status: 'CONFIRMED',
          submittedAt: dayFromStart(day),
          reviewedBy: admin.id,
          reviewedAt: dayFromStart(day + 1),
        },
      });

      await prisma.fundTransaction.create({
        data: {
          type: 'CONTRIBUTION',
          amount: BigInt(STANDARD_CONTRIBUTION),
          userId: user.id,
          refId: contribution.id,
          createdBy: admin.id,
          createdAt: dayFromStart(day + 1),
        },
      });

      confirmedTotal += STANDARD_CONTRIBUTION;
      confirmedCount += 1;
    }
  }

  // Неподтверждённые взносы в журнал не попадают: до проверки администратором
  // деньги фондом не считаются (§4.5).
  let pendingCount = 0;
  for (const [index, days] of Object.entries(PENDING_DAYS)) {
    for (const day of days) {
      await prisma.contribution.create({
        data: {
          userId: users[Number(index)]!.id,
          amount: BigInt(STANDARD_CONTRIBUTION),
          paidAt: dayFromStart(day),
          status: 'PENDING',
          submittedAt: dayFromStart(day),
        },
      });
      pendingCount += 1;
    }
  }

  const fund = confirmedTotal - orderTotal;

  console.info(
    [
      '',
      `Участников:        ${users.length} (один вышел из состава)`,
      `Заказов:           ${ORDERS.length} на ${(orderTotal / RUB).toLocaleString('ru-RU')} ₽`,
      `Взносов принято:   ${confirmedCount} на ${(confirmedTotal / RUB).toLocaleString('ru-RU')} ₽`,
      `На подтверждении:  ${pendingCount}`,
      `Отсутствий:        ${ABSENCES.length}`,
      `Остаток фонда:     ${(fund / RUB).toLocaleString('ru-RU')} ₽`,
      '',
      'Проверить инвариант: сумма балансов должна совпасть с остатком фонда.',
    ].join('\n'),
  );
}

/** Первое число месяца, N месяцев назад — чтобы период выглядел ровно. */
function startOfMonthMonthsAgo(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
}

function dayFromStart(days: number): Date {
  return new Date(START.getTime() + days * 24 * 60 * 60 * 1000);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
