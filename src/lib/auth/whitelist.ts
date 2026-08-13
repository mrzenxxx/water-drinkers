/**
 * Кто вообще имеет право войти (§7).
 *
 * Две независимые проверки: адрес принадлежит рабочему домену И числится
 * в списке участников. Домена мало — иначе войдёт любой сотрудник компании,
 * а не только тот, кто скидывается на воду.
 *
 * Функции чистые: список участников передаётся аргументом, в базу не ходим.
 */

/** Приводит адрес к каноничному виду для сравнения. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Локальная часть и домен. `null`, если адрес не похож на адрес. */
export function splitEmail(email: string): { local: string; domain: string } | null {
  const normalized = normalizeEmail(email);

  // Одна собака, непустые половины, в домене есть точка и нет пробелов.
  const match = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(normalized);
  if (match === null) return null;

  return { local: match[1] as string, domain: match[2] as string };
}

export function isValidEmail(email: string): boolean {
  return splitEmail(email) !== null;
}

/** Адрес принадлежит рабочему домену. */
export function isAllowedDomain(email: string, allowedDomain: string): boolean {
  const parts = splitEmail(email);
  if (parts === null) return false;

  return parts.domain === normalizeEmail(allowedDomain);
}

export type WhitelistDecision =
  | { allowed: true; email: string }
  | { allowed: false; reason: 'invalid_email' | 'foreign_domain' | 'not_a_participant' };

/**
 * Итоговое решение о допуске.
 *
 * `knownParticipants` — адреса из таблицы участников (активных и бывших:
 * бывший участник должен иметь возможность войти и увидеть свой остаток).
 */
export function decideAccess(
  email: string,
  allowedDomain: string,
  knownParticipants: readonly string[],
): WhitelistDecision {
  const parts = splitEmail(email);
  if (parts === null) return { allowed: false, reason: 'invalid_email' };

  const normalized = `${parts.local}@${parts.domain}`;

  if (parts.domain !== normalizeEmail(allowedDomain)) {
    return { allowed: false, reason: 'foreign_domain' };
  }

  const known = new Set(knownParticipants.map(normalizeEmail));
  if (!known.has(normalized)) {
    return { allowed: false, reason: 'not_a_participant' };
  }

  return { allowed: true, email: normalized };
}
