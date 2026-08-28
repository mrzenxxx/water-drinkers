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

/**
 * Значок раздела — строка, а не компонент.
 *
 * Компонент отсюда пришлось бы провезти через клиентскую границу в `AppNav`,
 * а через неё серверные значения не ездят: на той стороне оказалась бы ссылка
 * на клиентскую сущность. Строку же можно сериализовать всегда, и разбор
 * «ключ → значок» живёт там, где значок рисуется.
 */
export type NavIcon =
  | 'home'
  | 'wallet'
  | 'people'
  | 'fund'
  | 'orders'
  | 'absences'
  | 'dashboard'
  | 'notices'
  | 'admin';

/**
 * `badge` — число непрочитанного у раздела. Обычное сериализуемое поле:
 * список разделов пересекает границу «сервер → клиент», и всё в нём обязано
 * быть значением, а не ссылкой на клиентскую сущность.
 */
export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };

/** Разделы §6.1–§6.6, §6.9 и §6.12. «Админ-панель» добавляет оболочка — только роли ADMIN. */
export const APP_SECTIONS: readonly NavItem[] = [
  { href: '/', label: 'Главная', icon: 'home' },
  { href: '/notices', label: 'Объявления', icon: 'notices' },
  { href: '/contributions', label: 'Мои взносы', icon: 'wallet' },
  { href: '/contributions/all', label: 'Все взносы', icon: 'people' },
  { href: '/fund', label: 'Фонд', icon: 'fund' },
  { href: '/orders', label: 'Заказы', icon: 'orders' },
  { href: '/absences', label: 'Отсутствия', icon: 'absences' },
  { href: '/dashboard', label: 'Дашборд', icon: 'dashboard' },
];

/**
 * Свой ли это адрес.
 *
 * Куда уйти после сохранения формы, решает скрытое поле, а поле приходит из
 * браузера — значит, это ввод, а не намерение приложения. Без проверки туда
 * подставляется `//evil.example`, и переход после сохранения уводит человека
 * с сайта. Разрешён ровно один вид значения: путь от корня, без второй косой
 * черты (протокол-относительный адрес) и без обратной (её нормализуют браузеры).
 */
export function isInternalPath(value: string | null): value is string {
  return (
    value !== null &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  );
}

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
