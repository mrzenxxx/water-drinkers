/**
 * Дымовая проверка на живой базе: страницы, права и инвариант §5.
 *
 * Зачем она отдельно от `npm test`. Модульные и интеграционные тесты идут на
 * подставном клиенте Prisma и не отрисовывают ни одной страницы — а именно
 * там живут ошибки, которых не видят ни типы, ни тесты: значение, вывезенное
 * через границу `'use client'`, забытый `dynamic = 'force-dynamic'`, колонка,
 * которой нет в базе. Один такой отказ (500 на всех экранах участника) уже был
 * найден только этим способом.
 *
 * Что нужно: поднятая база, применённые миграции, наполненные данные и
 * запущенное приложение.
 *
 *   docker compose up -d
 *   npx prisma migrate deploy && npm run db:seed && npm run db:seed:mock
 *   npm run dev
 *   npm run smoke
 *
 * Переменные: `SMOKE_BASE_URL` (по умолчанию http://localhost:3000),
 * `DATABASE_URL` и `SESSION_SECRET` — те же, что у приложения, иначе
 * подписанная здесь сессия не подойдёт.
 *
 * Скрипт **ничего не меняет** в базе, кроме имени и фамилии участников без
 * профиля: без них оболочка уводит на заполнение профиля (§7) и проверять
 * становится нечего.
 */

// Скрипт запускается вне Next.js, а `.env` читает только он — как и сид-скрипты,
// проверка подтягивает переменные сама. Без этой строки она падает на
// `SESSION_SECRET не задан`, хотя в файле он есть.
import 'dotenv/config';

import { SESSION_COOKIE, issueSession } from '@/lib/auth/session';
import { loadFundState } from '@/lib/data/fund';
import { prisma } from '@/lib/db';
import { formatKopecks } from '@/lib/money';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

type Page = {
  path: string;
  as: 'admin' | 'member';
  /** Куски текста, которые обязаны быть в разметке. */
  expect?: string[];
};

const PAGES: readonly Page[] = [
  { path: '/', as: 'member', expect: ['Остаток фонда'] },
  { path: '/contributions', as: 'member' },
  { path: '/contributions/all', as: 'member', expect: ['Все взносы'] },
  { path: '/fund', as: 'member', expect: ['Σ балансов'] },
  { path: '/orders', as: 'member' },
  { path: '/absences', as: 'member' },
  { path: '/notices', as: 'member', expect: ['Объявления'] },
  { path: '/statistics', as: 'member', expect: ['<svg'] },
  { path: '/profile', as: 'member', expect: ['Учётная запись'] },
  { path: '/statistics?period=quarter&granularity=week', as: 'member', expect: ['<svg'] },
  { path: '/admin/queue', as: 'admin' },
  { path: '/admin/participants', as: 'admin' },
  { path: '/admin/entry', as: 'admin' },
  { path: '/admin/journal', as: 'admin' },
  { path: '/admin/notices', as: 'admin', expect: ['Новое объявление'] },
];

/** Признаки того, что страница отрисовалась в ошибку, а не в содержимое. */
const FAILURE_MARKERS = ['Application error', 'Internal Server Error'];

let failed = 0;

function report(ok: boolean, what: string, detail = ''): void {
  if (!ok) failed += 1;
  console.info(`${ok ? '  ok  ' : ' ПРОВАЛ'}  ${what}${detail === '' ? '' : `  — ${detail}`}`);
}

async function main(): Promise<void> {
  const secret = process.env.SESSION_SECRET ?? '';
  if (secret.length < 32) throw new Error('SESSION_SECRET не задан или короче 32 символов');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const member = await prisma.user.findFirst({ where: { role: 'PARTICIPANT', leftAt: null } });
  if (admin === null || member === null) {
    throw new Error('в базе нет администратора или действующего участника — выполните db:seed и db:seed:mock');
  }

  for (const user of [admin, member]) {
    if ((user.firstName ?? '') === '' || (user.lastName ?? '') === '') {
      await prisma.user.update({
        where: { id: user.id },
        data: { firstName: user.firstName ?? 'Тест', lastName: user.lastName ?? 'Тестов' },
      });
    }
  }

  const cookies = {
    admin: `${SESSION_COOKIE}=${issueSession(admin.id, secret, new Date())}`,
    member: `${SESSION_COOKIE}=${issueSession(member.id, secret, new Date())}`,
  };

  // ─── Инвариант §5 на живых данных ─────────────────────────────────────
  const state = await loadFundState(prisma);
  report(
    state.invariant.isConsistent,
    'инвариант §5 сходится',
    `фонд ${formatKopecks(state.invariant.fundBalance)}, Σ балансов ${formatKopecks(state.invariant.balancesSum)}`,
  );

  // ─── Права ────────────────────────────────────────────────────────────
  const guest = await fetch(`${BASE}/fund`, { redirect: 'manual' });
  report(
    guest.status >= 300 && guest.status < 400 && (guest.headers.get('location') ?? '').includes('/login'),
    'гость с закрытой страницы уходит на вход',
    `${guest.status} ${guest.headers.get('location') ?? ''}`,
  );

  const intruder = await fetch(`${BASE}/admin/participants`, {
    headers: { cookie: cookies.member },
    redirect: 'manual',
  });
  report(
    intruder.status >= 300 && intruder.status < 400,
    'участник не попадает в админ-панель',
    `${intruder.status} ${intruder.headers.get('location') ?? ''}`,
  );

  // ─── Чеки (§8.4) ──────────────────────────────────────────────────────
  const withReceipt = await prisma.waterOrder.findFirst({
    where: { receiptId: { not: null } },
    select: { receiptId: true },
  });

  if (withReceipt?.receiptId == null) {
    // Не ошибка: это ожидаемо, пока ни одной поставки с чеком не отмечено.
    // `db:seed:mock` тут не подсказка — он стирает взносы, заказы, отсутствия
    // и объявления в базе, а в базе разработки лежат настоящие данные владельца.
    report(true, 'в базе нет заказа с чеком — проверка чеков пропущена, пока поставка не отмечена');
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

  // ─── Страницы ─────────────────────────────────────────────────────────
  for (const page of PAGES) {
    const response = await fetch(`${BASE}${page.path}`, { headers: { cookie: cookies[page.as] } });
    const html = await response.text();

    const problems: string[] = [];
    if (response.status !== 200) problems.push(`статус ${response.status}`);
    for (const marker of FAILURE_MARKERS) {
      if (html.includes(marker)) problems.push(`страница отрисовалась в ошибку: "${marker}"`);
    }
    for (const needle of page.expect ?? []) {
      if (!html.includes(needle)) problems.push(`нет фрагмента "${needle}"`);
    }

    report(problems.length === 0, page.path, problems.join('; '));
  }

  console.info('');
  console.info(failed === 0 ? 'Дымовая проверка пройдена.' : `Провалено проверок: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
