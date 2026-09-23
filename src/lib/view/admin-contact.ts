/**
 * Связь с администратором (§7): Telegram и MAX.
 *
 * Мессенджера два, потому что одного не хватает. Telegram есть не у всех, а
 * с рабочего компьютера он обычно и не откроется вовсе; MAX открывается, но
 * стоит не у каждого. Поэтому оба адреса равноправны: какие заданы, те и
 * показаны, а порядок один и тот же везде.
 *
 * Адрес приходит из переменной окружения, и написать его человек может
 * по-разному. Написанное без схемы — `t.me/ivanov` — браузер считает **путём
 * внутри сайта**, и ссылка вместо мессенджера открывает свою же страницу 404.
 * Поэтому схема дописывается здесь, а не ожидается от того, кто заполнял
 * переменную: забыть её — норма, а не ошибка настройки.
 *
 * Разрешены только `http` и `https`. Переменная окружения — не то же самое,
 * что ввод из браузера, но `javascript:` в атрибуте `href` остаётся
 * исполняемым кодом при любом происхождении, и пускать туда что попало
 * незачем: подходящих значений здесь ровно два вида. Собственные схемы
 * мессенджеров (`tg://`, `max://`) тоже отвергаются: без установленного
 * приложения они не ведут никуда, а веб-адрес работает всегда.
 */

/** Мессенджер. По нему же выбирается знак в `brand-marks.tsx`. */
export type AdminContactId = 'telegram' | 'max';

export type AdminContact = {
  id: AdminContactId;
  /** Название мессенджера: подпись ссылки и её всплывающая подсказка. */
  label: string;
  href: string;
};

/** Что задано в окружении. Обе переменные необязательны. */
export type AdminContactEnv = {
  telegram: string | undefined;
  max: string | undefined;
};

export function adminContactHref(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (value === undefined || value === '') return null;

  // `//t.me/ivanov` — протокол-относительный адрес: схема своя, а не наша.
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.toString();
}

/**
 * Список ссылок для показа. Пустой список означает «звать некуда»: ни текста,
 * ни знаков — вести в никуда хуже, чем не звать.
 */
export function adminContacts(env: AdminContactEnv): AdminContact[] {
  const found: AdminContact[] = [];

  const telegram = adminContactHref(env.telegram);
  if (telegram !== null) found.push({ id: 'telegram', label: 'Telegram', href: telegram });

  const max = adminContactHref(env.max);
  if (max !== null) found.push({ id: 'max', label: 'MAX', href: max });

  return found;
}

/**
 * То же из окружения. Переменные читаются в одном месте: два экрана, читающие
 * `process.env` каждый по-своему, однажды разошлись бы в написании имени.
 */
export function adminContactsFromEnv(): AdminContact[] {
  return adminContacts({
    telegram: process.env.ADMIN_TELEGRAM_URL,
    max: process.env.ADMIN_MAX_URL,
  });
}
