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
