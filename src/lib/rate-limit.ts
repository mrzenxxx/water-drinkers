/**
 * Лимит на записи участника: не больше одной в час и двух за сутки.
 *
 * Считается отдельно для каждого вида записи — отсутствий и взносов.
 * Сутки скользящие: 24 часа назад от текущего момента, а не календарный
 * день, иначе в полночь лимит обнулялся бы и две записи шли бы подряд.
 *
 * Чистая функция: моменты прошлых записей приходят аргументом, откуда
 * их взять — дело вызывающего кода.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const WRITE_LIMITS = [
  { windowMs: HOUR_MS, limit: 1 },
  { windowMs: DAY_MS, limit: 2 },
] as const;

export type WriteRateDecision = { ok: true } | { ok: false; retryAt: Date };

/**
 * Когда окно освободится. В окне `k ≥ limit` записей; чтобы добавить ещё
 * одну, должны выйти `k − limit + 1` самых старых — то есть запись
 * с индексом `k − limit` в порядке возрастания.
 */
function windowRetry(times: number[], now: number, windowMs: number, limit: number): number | null {
  const inWindow = times.filter((t) => t > now - windowMs && t <= now).sort((a, b) => a - b);
  if (inWindow.length < limit) return null;
  return inWindow[inWindow.length - limit] + windowMs;
}

export function checkWriteRate(previous: readonly Date[], now: Date): WriteRateDecision {
  const times = previous.map((d) => d.getTime());
  const at = now.getTime();

  let retry: number | null = null;
  for (const { windowMs, limit } of WRITE_LIMITS) {
    const r = windowRetry(times, at, windowMs, limit);
    if (r !== null && (retry === null || r > retry)) retry = r;
  }

  return retry === null ? { ok: true } : { ok: false, retryAt: new Date(retry) };
}

/** Насколько глубоко в прошлое нужны записи, чтобы решить: самое длинное окно. */
export const WRITE_RATE_LOOKBACK_MS = DAY_MS;
