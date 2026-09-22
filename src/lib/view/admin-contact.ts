/**
 * Ссылка на администратора в Telegram (§7).
 *
 * Адрес приходит из `ADMIN_TELEGRAM_URL`, и написать его человек может
 * по-разному. Написанное без схемы — `t.me/ivanov` — браузер считает **путём
 * внутри сайта**, и кнопка вместо Telegram открывает свою же страницу 404.
 * Поэтому схема дописывается здесь, а не ожидается от того, кто заполнял
 * переменную окружения: забыть её — норма, а не ошибка настройки.
 *
 * Разрешены только `http` и `https`. Переменная окружения — не то же самое,
 * что ввод из браузера, но `javascript:` в атрибуте `href` остаётся
 * исполняемым кодом при любом происхождении, и пускать туда что попало
 * незачем: подходящих значений здесь ровно два вида.
 */
export function adminTelegramHref(raw: string | undefined): string | null {
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
