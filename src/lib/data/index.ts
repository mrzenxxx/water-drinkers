/**
 * Слой данных: между Prisma и всем, что данными пользуется.
 *
 * Задачи слоя ровно три:
 *  1. перевести строки таблиц в чистые типы ядра (`mappers.ts`, `dates.ts`,
 *     `money.ts`) — правило 5 CLAUDE.md держится на том, что этот перевод
 *     лежит здесь, а не внутри `src/lib/calc/`;
 *  2. дать единственную точку пересчёта (`fund.ts`), чтобы к балансу вело
 *     ровно одно вычисление;
 *  3. писать журнал аудита (`audit.ts`).
 *
 * Пользуются им и резолверы GraphQL, и серверные компоненты напрямую —
 * без HTTP-запроса к собственному `/api/graphql` (CLAUDE.md, §12а).
 */

export type { DbClient, AuditAction, AuditRecord } from './audit';
export { writeAudit } from './audit';

export { markAnnouncementsSeen } from './announcements';

export {
  fromIsoDate,
  instantToIsoDate,
  todayIso,
  toIsoDate,
  toIsoDateOrNull,
  toIsoDateTime,
  toIsoDateTimeOrNull,
} from './dates';

export type { FundFlowStat, FundState, MonthlyStat } from './fund';
export { fundFlowStats, getFundState, loadCalcInput, loadFundState, monthlyStats } from './fund';

export {
  DEFAULT_FUND_SETTINGS,
  isManualTransaction,
  toAbsence,
  toAbsenceType,
  toContribution,
  toContributionStatus,
  toFundSettings,
  toFundTransaction,
  toParticipant,
  toWaterOrder,
} from './mappers';

export { toBigIntKopecks, toKopecks } from './money';
