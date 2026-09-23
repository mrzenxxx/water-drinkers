'use server';

/**
 * Server Actions админ-панели (§6.7).
 *
 * Формы экранов вызывают эти функции напрямую (`<form action={…}>` +
 * `useActionState`) — без клиентского `fetch` к собственному `/api/graphql`
 * (CLAUDE.md, §12а).
 *
 * Правила при этом не дублируются: действие собирает контекст и зовёт **тот же
 * резолвер**, что и HTTP-эндпоинт. Второй реализации проверки прав, знака суммы
 * или сходимости сальдо в проекте нет — разойдясь, они дали бы приложение,
 * которое через GraphQL запрещает то, что разрешает через форму.
 *
 * `info` резолверам админ-панели не нужен: ни один из них не разбирает дерево
 * запроса. Поэтому сюда передаётся пустой объект — честнее, чем тащить в
 * серверное действие разбор GraphQL-документа ради неиспользуемого аргумента.
 */

import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import type { GraphQLContext } from '@/graphql/context';
import { buildContext } from '@/graphql/context';
import { AbsenceType, Role } from '@/graphql/generated/graphql';
import type {
  MutationAddAbsenceForArgs,
  MutationAddContributionForArgs,
  MutationConfirmContributionArgs,
  MutationCreateAdjustmentArgs,
  MutationDeactivateParticipantArgs,
  MutationReactivateParticipantArgs,
  MutationRejectContributionArgs,
  MutationSetOpeningBalancesArgs,
  MutationSetParticipantRoleArgs,
  MutationSettleParticipantArgs,
} from '@/graphql/generated/graphql';
import { adminMutations } from '@/graphql/resolvers/mutation/admin';
import { contributionMutations } from '@/graphql/resolvers/mutation/contribution';
import { SESSION_COOKIE, authConfigFromEnv, readSession, sessionCookieOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseRubles, type Kopecks } from '@/lib/money';
import { UNATTRIBUTED, type ActionState } from '@/components/admin/action-state';

// ─── Состояние формы ───────────────────────────────────────────────────────

function ok(message: string): ActionState {
  return { status: 'success', message };
}

function failed(cause: unknown): ActionState {
  // GraphQLError несёт текст, написанный для человека (§10.3). Всё остальное —
  // либо опечатка в форме (RangeError из parseRubles), либо настоящая поломка,
  // и подменять её бодрым «что-то пошло не так» нельзя.
  if (cause instanceof GraphQLError) return { status: 'error', message: cause.message };
  if (cause instanceof RangeError || cause instanceof TypeError) {
    return { status: 'error', message: cause.message };
  }
  console.error('[waterdrinkers] админское действие не выполнено:', cause);
  return { status: 'error', message: 'Не удалось выполнить действие. Подробности — в логе сервера.' };
}

// ─── Контекст ──────────────────────────────────────────────────────────────

const NO_INFO = {} as GraphQLResolveInfo;

type Call<TArgs, TResult> = (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

/**
 * Резолверы объявлены типом `Resolver`, который допускает и объект с полем
 * `resolve`. Здесь они заведомо функции — это видно в самих файлах, — поэтому
 * приведение честное, а не попытка обмануть проверку типов.
 */
const call = {
  setOpeningBalances: adminMutations.setOpeningBalances as Call<MutationSetOpeningBalancesArgs, unknown>,
  deactivateParticipant: adminMutations.deactivateParticipant as Call<MutationDeactivateParticipantArgs, unknown>,
  reactivateParticipant: adminMutations.reactivateParticipant as Call<MutationReactivateParticipantArgs, unknown>,
  setParticipantRole: adminMutations.setParticipantRole as Call<MutationSetParticipantRoleArgs, unknown>,
  settleParticipant: adminMutations.settleParticipant as Call<MutationSettleParticipantArgs, unknown>,
  createAdjustment: adminMutations.createAdjustment as Call<MutationCreateAdjustmentArgs, unknown>,
  addContributionFor: adminMutations.addContributionFor as Call<MutationAddContributionForArgs, unknown>,
  addAbsenceFor: adminMutations.addAbsenceFor as Call<MutationAddAbsenceForArgs, unknown>,
  confirmContribution: contributionMutations.confirmContribution as Call<MutationConfirmContributionArgs, unknown>,
  rejectContribution: contributionMutations.rejectContribution as Call<MutationRejectContributionArgs, unknown>,
};

async function actionContext(): Promise<GraphQLContext> {
  const config = authConfigFromEnv();
  const store = await cookies();
  const payload = readSession(store.get(SESSION_COOKIE)?.value, config.sessionSecret, new Date());

  return buildContext({
    // Резолверы читают из `request` только его наличие; сетевого запроса здесь нет.
    request: new Request('http://server-action/admin', { method: 'POST' }),
    db: prisma,
    config,
    userId: payload?.uid ?? null,
    sessionIssuedAt: payload?.iat ?? 0,

    async setSessionCookie(token: string) {
      (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(config.appUrl));
    },
    async clearSessionCookie() {
      (await cookies()).delete(SESSION_COOKIE);
    },
  });
}

/**
 * Обновление после успешного действия.
 *
 * Пересчитывается всё дерево, а не только текущая вкладка: подтверждение взноса
 * меняет и очередь, и балансы участников, и главную. Экономить тут значит
 * показывать вчерашние цифры на соседнем экране.
 */
function refresh(): void {
  revalidatePath('/', 'layout');
}

// ─── Разбор формы ──────────────────────────────────────────────────────────

function text(form: FormData, field: string): string {
  return String(form.get(field) ?? '').trim();
}

function optionalText(form: FormData, field: string): string | null {
  const value = text(form, field);
  return value === '' ? null : value;
}

/** Рубли из формы → копейки. Плавающая точка не участвует (правило 2). */
function money(form: FormData, field: string, label: string): Kopecks {
  const raw = text(form, field);
  if (raw === '') {
    throw new RangeError(`Поле «${label}» не заполнено.`);
  }
  try {
    return parseRubles(raw);
  } catch {
    throw new RangeError(`Поле «${label}»: «${raw}» не похоже на сумму в рублях.`);
  }
}

function requiredField(form: FormData, field: string, label: string): string {
  const value = text(form, field);
  if (value === '') {
    throw new RangeError(`Поле «${label}» не заполнено.`);
  }
  return value;
}

// ─── Очередь подтверждений ─────────────────────────────────────────────────

export async function confirmContributionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await call.confirmContribution(null, { id: requiredField(form, 'id', 'взнос') }, ctx, NO_INFO);
    refresh();
    return ok('Взнос подтверждён.');
  } catch (cause) {
    return failed(cause);
  }
}

export async function rejectContributionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await call.rejectContribution(
      null,
      {
        id: requiredField(form, 'id', 'взнос'),
        comment: requiredField(form, 'comment', 'причина отказа'),
      },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok('Взнос отклонён, участник увидит причину.');
  } catch (cause) {
    return failed(cause);
  }
}

// ─── Участники ─────────────────────────────────────────────────────────────

export async function deactivateParticipantAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await call.deactivateParticipant(
      null,
      {
        id: requiredField(form, 'id', 'участник'),
        leftAt: requiredField(form, 'leftAt', 'дата выхода'),
      },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok('Участник исключён из состава. История взносов сохранена.');
  } catch (cause) {
    return failed(cause);
  }
}

export async function reactivateParticipantAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await call.reactivateParticipant(null, { id: requiredField(form, 'id', 'участник') }, ctx, NO_INFO);
    refresh();
    return ok('Участник снова в составе.');
  } catch (cause) {
    return failed(cause);
  }
}

export async function setParticipantRoleAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const raw = requiredField(form, 'role', 'роль');
    if (raw !== Role.Admin && raw !== Role.Participant) {
      throw new RangeError(`Неизвестная роль «${raw}».`);
    }
    const role: Role = raw === Role.Admin ? Role.Admin : Role.Participant;

    const ctx = await actionContext();
    await call.setParticipantRole(
      null,
      { id: requiredField(form, 'id', 'участник'), role },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok(role === Role.Admin ? 'Назначен администратором.' : 'Права администратора сняты.');
  } catch (cause) {
    return failed(cause);
  }
}

/**
 * Выплата остатка.
 *
 * Форма спрашивает сумму как положительное число рублей — так её и произносят
 * вслух («вернули тысячу»), — а в журнал она уходит отрицательной (§2.3).
 * Знак ставится ровно здесь, в одном месте.
 */
export async function settleParticipantAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const payout = money(form, 'amount', 'сумма выплаты');
    if (payout <= 0) {
      throw new RangeError('Сумма выплаты указывается положительным числом.');
    }

    const ctx = await actionContext();
    await call.settleParticipant(
      null,
      {
        id: requiredField(form, 'id', 'участник'),
        amount: -payout,
        note: requiredField(form, 'note', 'комментарий'),
      },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok('Выплата записана в журнал операций.');
  } catch (cause) {
    return failed(cause);
  }
}

// ─── Журнал и корректировки ────────────────────────────────────────────────

export async function createAdjustmentAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    // «Не знаю, чьи деньги» — отдельное значение, а не пустое поле (§2.4).
    // Пустым список участника быть не может: форма требует выбора, и незаполненная
    // строка означала бы, что администратор проскочил вопрос, а не ответил на него.
    const chosen = requiredField(form, 'userId', 'участник');
    const userId = chosen === UNATTRIBUTED ? null : chosen;
    const ctx = await actionContext();

    await call.createAdjustment(
      null,
      {
        userId,
        amount: money(form, 'amount', 'сумма корректировки'),
        comment: requiredField(form, 'comment', 'комментарий'),
      },
      ctx,
      NO_INFO,
    );

    refresh();
    return ok(
      userId === null
        ? 'Корректировка записана и разделена поровну между активными участниками.'
        : 'Корректировка записана.',
    );
  } catch (cause) {
    return failed(cause);
  }
}

/**
 * Стартовое состояние фонда (§4.2).
 *
 * Кнопка «Распределить поровну» отправляет ту же форму с `equalSplit`: доли
 * считает сервер методом наибольших остатков (`splitOpeningBalanceEqually`),
 * а не браузер. Своей арифметики здесь нет и быть не должно.
 */
export async function setOpeningBalancesAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const equalSplit = text(form, 'intent') === 'equal-split';

    const openingBalances: { userId: string; amount: Kopecks }[] = [];
    if (!equalSplit) {
      for (const [key, value] of form.entries()) {
        if (!key.startsWith('opening:')) continue;
        const userId = key.slice('opening:'.length);
        const raw = String(value).trim();
        openingBalances.push({ userId, amount: raw === '' ? 0 : parseRubles(raw) });
      }
    }

    const ctx = await actionContext();
    await call.setOpeningBalances(
      null,
      {
        input: {
          startDate: requiredField(form, 'startDate', 'дата начала учёта'),
          fundOpeningBalance: money(form, 'fundOpeningBalance', 'начальное сальдо фонда'),
          openingBalances,
          equalSplit,
        },
      },
      ctx,
      NO_INFO,
    );

    refresh();
    return ok(
      equalSplit
        ? 'Стартовое состояние сохранено, сальдо разделены поровну.'
        : 'Стартовое состояние сохранено.',
    );
  } catch (cause) {
    return failed(cause);
  }
}

// ─── Ввод за участника ─────────────────────────────────────────────────────

export async function addContributionForAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await call.addContributionFor(
      null,
      {
        input: {
          userId: requiredField(form, 'userId', 'участник'),
          amount: money(form, 'amount', 'сумма'),
          paidAt: requiredField(form, 'paidAt', 'дата платежа'),
        },
      },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok('Взнос внесён и уже учтён в фонде.');
  } catch (cause) {
    return failed(cause);
  }
}

export async function addAbsenceForAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const raw = requiredField(form, 'type', 'тип отсутствия');
    if (raw !== AbsenceType.Vacation && raw !== AbsenceType.SickLeave) {
      throw new RangeError(`Неизвестный тип отсутствия «${raw}».`);
    }
    const type: AbsenceType = raw === AbsenceType.Vacation ? AbsenceType.Vacation : AbsenceType.SickLeave;

    const ctx = await actionContext();
    await call.addAbsenceFor(
      null,
      {
        input: {
          userId: requiredField(form, 'userId', 'участник'),
          type,
          startsOn: requiredField(form, 'startsOn', 'дата начала'),
          endsOn: requiredField(form, 'endsOn', 'дата окончания'),
          note: optionalText(form, 'note'),
        },
      },
      ctx,
      NO_INFO,
    );
    refresh();
    return ok('Отсутствие внесено.');
  } catch (cause) {
    return failed(cause);
  }
}
