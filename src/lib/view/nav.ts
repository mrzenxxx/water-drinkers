/**
 * Разделы приложения, вкладки внутри раздела и подсветка текущего.
 *
 * Список лежит **отдельно от компонентов навигации**, и это не вкусовщина.
 * `app-sidebar.tsx` помечен `'use client'`, а из клиентского модуля серверный
 * компонент получает не значения, а ссылки на клиентские сущности: попытка
 * разложить оттуда массив падает с «is not iterable» уже в рантайме. Типы
 * этого не видят, тесты тоже — ошибка вылезает только при отрисовке страницы.
 * Поэтому данные и чистые функции живут здесь, а `'use client'` остаётся
 * только там, где действительно нужен браузер.
 */

/**
 * Значок раздела — строка, а не компонент.
 *
 * Компонент отсюда пришлось бы провезти через клиентскую границу, а через неё
 * серверные значения не ездят: на той стороне оказалась бы ссылка на
 * клиентскую сущность. Строку же можно сериализовать всегда, и разбор
 * «ключ → значок» живёт там, где значок рисуется (`nav-icons.ts`).
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
  | 'admin'
  | 'queue'
  | 'entry'
  | 'journal';

/**
 * `badge` — число непрочитанного у раздела, `hint` — подсказка при наведении
 * и подпись значка в свёрнутой полосе. Обычные сериализуемые поля: список
 * пересекает границу «сервер → клиент», и всё в нём обязано быть значением,
 * а не ссылкой на клиентскую сущность.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  hint?: string;
  badge?: number;
};

/**
 * Раздел боковой панели. `children` — вкладки внутри раздела: они не
 * дублируются в панели, а показываются полосой под шапкой, когда раздел
 * открыт. Так боковая панель остаётся коротким списком мест, а не деревом.
 */
export type NavSection = NavItem & { children?: readonly NavItem[] };

/**
 * Разделы участника (§6.1–§6.6, §6.9, §6.12).
 *
 * Девять пунктов в строку не помещались и растили шапку в два ряда. Здесь их
 * пять: близкие экраны собраны в разделы с вкладками — «Мои взносы» и «Все
 * взносы» это один вопрос с двух сторон, а фонд, заказы и отсутствия — три
 * стороны одного расчёта. «Админ-панель» добавляет оболочка, только роли ADMIN.
 */
export const APP_SECTIONS: readonly NavSection[] = [
  { href: '/', label: 'Главная', icon: 'home', hint: 'Баланс, должники, события' },
  { href: '/notices', label: 'Объявления', icon: 'notices', hint: 'Сообщения администратора' },
  {
    href: '/contributions',
    label: 'Взносы',
    icon: 'wallet',
    hint: 'Мои и общие взносы',
    children: [
      { href: '/contributions', label: 'Мои взносы', icon: 'wallet', hint: 'Что внёс я' },
      { href: '/contributions/all', label: 'Все взносы', icon: 'people', hint: 'Взносы всех участников' },
    ],
  },
  {
    href: '/fund',
    label: 'Касса',
    icon: 'fund',
    hint: 'Остаток, заказы, отсутствия',
    children: [
      { href: '/fund', label: 'Фонд', icon: 'fund', hint: 'Остаток и сходимость' },
      { href: '/orders', label: 'Заказы', icon: 'orders', hint: 'Закупки воды' },
      { href: '/absences', label: 'Отсутствия', icon: 'absences', hint: 'Дни вне офиса' },
    ],
  },
  { href: '/dashboard', label: 'Дашборд', icon: 'dashboard', hint: 'Графики и сводка за период' },
];

/** Вкладки админ-панели (§6.7) и объявлений админа (§6.12). */
export const ADMIN_TABS: readonly NavItem[] = [
  { href: '/admin/queue', label: 'Очередь', icon: 'queue', hint: 'Взносы на подтверждение' },
  { href: '/admin/participants', label: 'Участники', icon: 'people', hint: 'Состав и балансы' },
  { href: '/admin/entry', label: 'Ввод за участника', icon: 'entry', hint: 'Взнос и отсутствие' },
  { href: '/admin/journal', label: 'Журнал', icon: 'journal', hint: 'Аудит и корректировки' },
  { href: '/admin/notices', label: 'Объявления', icon: 'notices', hint: 'Сообщения участникам' },
];

/** Раздел админ-панели. Собирается функцией, чтобы вкладки не разъехались с ним. */
export const ADMIN_SECTION: NavSection = {
  href: '/admin',
  label: 'Админ-панель',
  icon: 'admin',
  hint: 'Очередь, участники, журнал',
  children: ADMIN_TABS,
};

/** Все адреса раздела: свой и вкладок. По ним раздел и опознаётся как текущий. */
export function sectionHrefs(section: NavSection): readonly string[] {
  if (section.children === undefined) return [section.href];
  return [section.href, ...section.children.map((child) => child.href)];
}

/** Все адреса навигации разом — набор «соседей» для `isSectionActive`. */
export function navHrefs(sections: readonly NavSection[]): readonly string[] {
  return sections.flatMap(sectionHrefs);
}

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
 * Активен ли пункт.
 *
 * Главная — только точное совпадение, иначе она подсвечивалась бы всегда.
 * «Мои взносы» не должны загораться на «Все взносы», поэтому вложенный
 * адрес считается своим лишь до следующего сегмента.
 */
export function isSectionActive(
  pathname: string,
  href: string,
  siblings: readonly string[],
): boolean {
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

/**
 * Раздел, внутри которого мы находимся, или `null`.
 *
 * Раздел свой, если текущий адрес совпал с его собственным или с адресом
 * любой его вкладки. Прямое сравнение по префиксу здесь не годится: «Заказы»
 * живут по адресу `/orders`, а принадлежат разделу «Касса» (`/fund`) —
 * группировка в интерфейсе не обязана повторять дерево маршрутов.
 */
export function activeSection(
  pathname: string,
  sections: readonly NavSection[],
): NavSection | null {
  const siblings = navHrefs(sections);
  return (
    sections.find((section) =>
      sectionHrefs(section).some((href) => isSectionActive(pathname, href, siblings)),
    ) ?? null
  );
}

/**
 * Вкладки текущего раздела. Пустой список — вкладок нет и полосу рисовать
 * незачем: одинокая вкладка это не выбор, а украшение.
 */
export function sectionTabs(
  pathname: string,
  sections: readonly NavSection[],
): readonly NavItem[] {
  const section = activeSection(pathname, sections);
  if (section?.children === undefined) return [];
  return section.children.length > 1 ? section.children : [];
}
