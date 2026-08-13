/**
 * Единственная точка пересчёта: база → `CalcInput` → ядро → `CalcResult`.
 *
 * Всё, что показывает остаток фонда, баланс участника или раскладку заказа,
 * ходит сюда. Двух путей к балансу быть не должно: разойдясь, они дали бы два
 * разных ответа на один вопрос, и инвариант §5 перестал бы что-либо доказывать.
 *
 * Ядро (`src/lib/calc/`) остаётся чистым: базу читает этот файл, «сегодня»
 * берётся здесь же и передаётся внутрь аргументом (§4.3).
 */

import { cache } from 'react';

import type { PrismaClient } from '@/generated/prisma/client';
import {
  checkInvariant,
  computeBalances,
  countableContributions,
  countableTransactions,
} from '@/lib/calc';
import type {
  Balance,
  CalcInput,
  CalcResult,
  InvariantReport,
  IsoDate,
  OrderPeriod,
} from '@/lib/calc/types';
import type { Kopecks } from '@/lib/money';

import { todayIso } from './dates';
import {
  isManualTransaction,
  toAbsence,
  toContribution,
  toFundSettings,
  toFundTransaction,
  toParticipant,
  toWaterOrder,
} from './mappers';

/** Результат пересчёта вместе с исходными данными и отчётом об инварианте. */
export type FundState = {
  /** Конец открытого периода потребления последнего заказа (§4.3). */
  asOf: IsoDate;
  input: CalcInput;
  result: CalcResult;
  invariant: InvariantReport;
  /** Баланс участника, или `null`, если такого участника нет. */
  balanceOf(userId: string): Balance | null;
  /** Раскладка заказа по участникам, или `null` для заказа вне расчёта. */
  periodOf(orderId: string): OrderPeriod | null;
};

/**
 * Читает всё, что нужно ядру, одним пакетом запросов.
 *
 * Выборки намеренно без фильтров по дате: баланс — величина накопительная,
 * посчитать её по куску истории нельзя. Фильтрацию «до даты начала учёта»
 * делает само ядро (`countableOrders` и соседи, §4.2) — так правило живёт
 * в одном месте, а не размазывается по SQL.
 */
export async function loadCalcInput(
  db: PrismaClient,
  asOf: IsoDate = todayIso(),
): Promise<CalcInput> {
  const [settings, users, absences, orders, contributions, transactions] = await Promise.all([
    db.fundSettings.findUnique({ where: { id: 1 } }),
    db.user.findMany({ orderBy: { id: 'asc' } }),
    db.absence.findMany({ orderBy: { id: 'asc' } }),
    db.waterOrder.findMany({ orderBy: { orderedAt: 'asc' } }),
    db.contribution.findMany({ orderBy: { paidAt: 'asc' } }),
    db.fundTransaction.findMany({
      where: { type: { in: ['SETTLEMENT', 'ADJUSTMENT'] } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    fund: toFundSettings(settings),
    participants: users.map(toParticipant),
    absences: absences.map(toAbsence),
    orders: orders.map(toWaterOrder),
    contributions: contributions.map(toContribution),
    // Фильтр по типу продублирован: `where` мог бы уехать при правке запроса,
    // а маппер на чужом типе бросает — пусть лучше упрётся здесь.
    transactions: transactions.filter(isManualTransaction).map(toFundTransaction),
    asOf,
  };
}

/**
 * Пересчёт с проверкой инварианта §5.
 *
 * Расхождение — всегда баг в коде, а не в данных, поэтому оно пишется в лог
 * уровня `error` и не глотается. Бросить исключение нельзя: тогда приложение
 * перестало бы показывать хоть что-то ровно в тот момент, когда данные надо
 * рассматривать. Администратору расхождение видно через `Fund.isConsistent`
 * (§5, пункт 3).
 */
export async function loadFundState(
  db: PrismaClient,
  asOf: IsoDate = todayIso(),
): Promise<FundState> {
  const input = await loadCalcInput(db, asOf);
  const result = computeBalances(input);
  const invariant = checkInvariant(result);

  if (!invariant.isConsistent) {
    console.error(
      '[waterdrinkers] Инвариант §5 нарушен: Σ балансов = %d коп., фонд = %d коп., расхождение = %d коп. (asOf %s)',
      invariant.balancesSum,
      invariant.fundBalance,
      invariant.difference,
      asOf,
    );
  }

  const balances = new Map(result.balances.map((balance) => [balance.userId, balance]));
  const periods = new Map(result.orderPeriods.map((period) => [period.orderId, period]));

  return {
    asOf,
    input,
    result,
    invariant,
    balanceOf: (userId) => balances.get(userId) ?? null,
    periodOf: (orderId) => periods.get(orderId) ?? null,
  };
}

/**
 * Тот же пересчёт, мемоизированный на время одного запроса (`cache` из React,
 * CLAUDE.md).
 *
 * Точка входа для серверных компонентов: главная спрашивает и остаток фонда,
 * и свой баланс, и очередь должников — считать всё это трижды незачем.
 * Резолверы GraphQL пользуются мемоизацией из контекста (`ctx.fundState`):
 * `cache` вне React-запроса просто вызывает функцию, а контекст создаётся
 * на каждый запрос и потому работает всегда, в том числе в тестах.
 */
export const getFundState = cache(loadFundState);

// ─── Помесячная сводка (§6.4, GraphQL MonthlyStat) ─────────────────────────

export type MonthlyStat = {
  /** `YYYY-MM`. */
  month: string;
  contributions: Kopecks;
  /** Отрицательная величина: деньги ушли из фонда (§2.3). */
  orders: Kopecks;
  /** Остаток фонда на конец месяца. */
  endBalance: Kopecks;
};

/** Пятьдесят лет помесячно — больше на графике смысла не имеет. */
const MAX_MONTHS = 600;

function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return index === 12
    ? `${String(year + 1).padStart(4, '0')}-01`
    : `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`;
}

/**
 * Динамика фонда по месяцам для графика §6.4.
 *
 * Считается из того же отфильтрованного набора, что и балансы: последний
 * `endBalance` обязан совпасть с `CalcResult.fundBalance`, иначе график и
 * таблица рассказывали бы разные истории (§6.9, «дашборд только показывает»).
 */
export function monthlyStats(input: CalcInput, result: CalcResult): MonthlyStat[] {
  const byMonth = new Map<string, { contributions: Kopecks; orders: Kopecks; other: Kopecks }>();

  const bucket = (month: string) => {
    const existing = byMonth.get(month);
    if (existing) return existing;
    const created = { contributions: 0, orders: 0, other: 0 };
    byMonth.set(month, created);
    return created;
  };

  // Берутся ровно те записи, что учло ядро (§4.2): свои фильтры разошлись бы
  // с остатком фонда, а сводка обязана сходиться с ним до копейки.
  for (const contribution of countableContributions(input.contributions, input.fund)) {
    bucket(monthOf(contribution.paidAt)).contributions += contribution.amount;
  }
  // `orderPeriods` — уже отфильтрованные заказы; знак меняем здесь, потому что
  // в ядре сумма заказа положительная, а в журнале и на графике она расход.
  for (const period of result.orderPeriods) {
    bucket(monthOf(period.orderedAt)).orders -= period.amount;
  }
  for (const transaction of countableTransactions(input.transactions ?? [], input.fund)) {
    bucket(monthOf(transaction.occurredOn)).other += transaction.amount;
  }

  const months = [...byMonth.keys()].sort();
  const first = input.fund.startDate === null ? months[0] : monthOf(input.fund.startDate);
  if (first === undefined) return [];

  const last = [months[months.length - 1] ?? first, monthOf(input.asOf)].sort()[1] as string;

  const stats: MonthlyStat[] = [];
  let running = input.fund.openingBalance;

  // Страховка: дату начала учёта задаёт администратор, и опечатка в годе
  // не должна превращать график в десятки тысяч строк.
  for (let month = first; month <= last && stats.length < MAX_MONTHS; month = nextMonth(month)) {
    const totals = byMonth.get(month) ?? { contributions: 0, orders: 0, other: 0 };
    running += totals.contributions + totals.orders + totals.other;
    stats.push({
      month,
      contributions: totals.contributions,
      orders: totals.orders,
      endBalance: running,
    });
  }

  return stats;
}
