/**
 * Вид стекла: матовое (по умолчанию) или жидкое.
 *
 * Матовое — плоские градиенты и размытие фона. Жидкое — то же самое плюс
 * объём: блики, светлые кромки, рельеф полей и свечение цвета элемента.
 * Выбор — дело вкуса, а не доступности, поэтому живёт рядом с темой и так же
 * хранится в браузере: на сервере его нет, и расчёт от него не зависит.
 *
 * Применяется атрибутом `data-glass` на `<html>`; стили жидкого стекла в
 * `globals.css` подключаются селектором `[data-glass='liquid']`.
 */

export const GLASS_STORAGE_KEY = 'waterdrinkers-glass';

export type GlassStyle = 'matte' | 'liquid';

export function isGlassStyle(value: unknown): value is GlassStyle {
  return value === 'matte' || value === 'liquid';
}

export function nextGlass(current: GlassStyle): GlassStyle {
  return current === 'liquid' ? 'matte' : 'liquid';
}

/**
 * Скрипт выставляет `data-glass` до первой отрисовки — как тема, чтобы
 * жидкое стекло не проступало на загрузке из матового. Выполняется
 * синхронно в `<head>`, до гидратации React.
 */
export const GLASS_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${GLASS_STORAGE_KEY}');
    document.documentElement.dataset.glass = stored === 'liquid' ? 'liquid' : 'matte';
  } catch (error) {
    document.documentElement.dataset.glass = 'matte';
  }
})();
`;
