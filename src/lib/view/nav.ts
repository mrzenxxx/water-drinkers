/**
 * Разделы приложения и подсветка текущего.
 *
 * Список лежит **отдельно от компонента навигации**, и это не вкусовщина.
 * `app-nav.tsx` помечен `'use client'`, а из клиентского модуля серверный
 * компонент получает не значения, а ссылки на клиентские сущности: попытка
 * разложить оттуда массив падает с «is not iterable» уже в рантайме. Типы
 * этого не видят, тесты тоже — ошибка вылезает только при отрисовке страницы.
 * Поэтому данные и чистые функции живут здесь, а `'use client'` остаётся
 * только там, где действительно нужен браузер.
 */

export type NavItem = { href: string; label: string };

/** Разделы §6.1–§6.6 и §6.9. «Админ-панель» добавляет оболочка — только роли ADMIN. */
export const APP_SECTIONS: readonly NavItem[] = [
  { href: '/', label: 'Главная' },
  { href: '/contributions', label: 'Мои взносы' },
  { href: '/contributions/all', label: 'Все взносы' },
  { href: '/fund', label: 'Фонд' },
  { href: '/orders', label: 'Заказы' },
  { href: '/absences', label: 'Отсутствия' },
  { href: '/dashboard', label: 'Дашборд' },
];

/**
 * Активен ли раздел.
 *
 * Главная — только точное совпадение, иначе она подсвечивалась бы всегда.
 * «Мои взносы» не должны загораться на «Все взносы», поэтому вложенный
 * адрес считается своим лишь до следующего сегмента.
 */
export function isSectionActive(pathname: string, href: string, siblings: readonly string[]): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  // Более длинный подходящий адрес забирает подсветку себе.
  return !siblings.some(
    (sibling) =>
      sibling !== href &&
      sibling.length > href.length &&
      (pathname === sibling || pathname.startsWith(`${sibling}/`)),
  );
}
