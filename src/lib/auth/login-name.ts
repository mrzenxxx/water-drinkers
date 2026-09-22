/**
 * Логин участника из его ФИО.
 *
 * Схема — первая буква имени, точка, первая буква отчества (если оно есть),
 * точка и фамилия, всё латиницей: «Евгений Викторович Кондобаров» →
 * `e.v.kondobarov`, без отчества — `e.kondobarov`.
 *
 * Модуль чистый и без серверных зависимостей: форма администратора
 * импортирует его, чтобы показывать логин ещё до обращения к серверу.
 */

/**
 * Транслитерация в привычном для корпоративных логинов виде: ж → zh,
 * х → kh, ц → ts, щ → shch, й → y, ю → yu, я → ya. Мягкий и твёрдый знаки
 * выпадают. Паспортная схема (ю → iu, й → i) нарочно не взята: логины
 * вида `iu.ivanov` людей скорее путают.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export const LOGIN_MIN_LENGTH = 3;
export const LOGIN_MAX_LENGTH = 40;

/** Латиница, цифры, точка и дефис; на краях — только буква или цифра. */
const LOGIN_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

/**
 * Строка латиницей в нижнем регистре. Латиница и цифры проходят как есть,
 * дефис сохраняется (двойная фамилия), всё прочее — пробелы, апострофы,
 * незнакомые буквы — отбрасывается.
 */
export function transliterate(text: string): string {
  let out = '';
  for (const char of text.trim().toLowerCase()) {
    const mapped = CYRILLIC[char];
    if (mapped !== undefined) out += mapped;
    else if (/[a-z0-9-]/.test(char)) out += char;
  }
  // Дефис по краям или сдвоенный остаётся от выброшенных символов.
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Первая буква имени латиницей: «Юрий» → `yu`, «Жанна» → `zh`. */
function initial(name: string): string {
  const first = name.trim().charAt(0);
  return first === '' ? '' : transliterate(first);
}

export type FullName = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
};

/**
 * Базовый логин без учёта занятости. Пустая строка — если из ФИО не удалось
 * получить ни одной латинской буквы фамилии: такой логин вызывающий код
 * должен отвергнуть, а не придумывать за администратора.
 */
export function buildLogin({ firstName, middleName, lastName }: FullName): string {
  const surname = transliterate(lastName);
  if (surname === '') return '';

  const parts = [initial(firstName)];
  const middle = middleName?.trim() ?? '';
  if (middle !== '') parts.push(initial(middle));
  parts.push(surname);

  return parts.filter((p) => p !== '').join('.');
}

/**
 * Свободный логин: базовый, а если он занят — с числом на конце, начиная
 * с двойки (`e.kondobarov2`). `taken` сравнивается без учёта регистра:
 * в базе логин лежит в `citext`.
 */
export function uniqueLogin(base: string, taken: Iterable<string>): string {
  const busy = new Set<string>();
  for (const login of taken) busy.add(login.toLowerCase());

  const candidate = base.toLowerCase();
  if (!busy.has(candidate)) return candidate;

  for (let n = 2; ; n += 1) {
    const next = `${candidate}${n}`;
    if (!busy.has(next)) return next;
  }
}

/** Логин в том виде, в каком он хранится и сравнивается. */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/** Годится ли логин, который администратор ввёл или поправил руками. */
export function isValidLogin(login: string): boolean {
  return (
    login.length >= LOGIN_MIN_LENGTH &&
    login.length <= LOGIN_MAX_LENGTH &&
    LOGIN_PATTERN.test(login) &&
    !/[.-]{2}/.test(login)
  );
}
