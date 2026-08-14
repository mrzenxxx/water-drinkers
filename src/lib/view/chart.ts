/**
 * Геометрия графиков.
 *
 * Графики рисуются встроенным SVG прямо на сервере: клиентская библиотека
 * ради пяти прямых линий утянула бы в бандл десятки килобайт и потребовала бы
 * `'use client'` там, где никаких событий нет (CLAUDE.md). Значит вся
 * математика — здесь, чистыми функциями, и покрыта тестами; компонент только
 * подставляет её результат в атрибуты.
 *
 * Единицы: домен — копейки (или любые числа), диапазон — пользовательские
 * координаты SVG. Никаких `Date`, никакого DOM.
 */

/** Отступы вокруг области данных. Ось X живёт в нижнем поле — она не обрезается. */
export type ChartPadding = { top: number; right: number; bottom: number; left: number };

export type ChartBox = {
  width: number;
  height: number;
  padding: ChartPadding;
  /** Область данных. */
  plot: { x: number; y: number; width: number; height: number };
};

export function chartBox(width: number, height: number, padding: ChartPadding): ChartBox {
  return {
    width,
    height,
    padding,
    plot: {
      x: padding.left,
      y: padding.top,
      width: Math.max(0, width - padding.left - padding.right),
      height: Math.max(0, height - padding.top - padding.bottom),
    },
  };
}

/** Шаги «красивой» засечки: 1, 2, 2.5, 5 и их десятичные кратные. */
const NICE_STEPS = [1, 2, 2.5, 5, 10];

/** Ближайший сверху «круглый» шаг для приблизительной величины. */
export function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

/**
 * Засечки оси значений: круглые числа, покрывающие домен целиком.
 *
 * Ноль попадает в набор всегда, когда домен его пересекает: без нулевой линии
 * ступень «фонд ушёл в минус» ничем не отличается от просто низкого столбика.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];

  const low = Math.min(min, max, 0);
  const high = Math.max(min, max, 0);
  if (low === high) return [low];

  const step = niceStep((high - low) / Math.max(1, count));
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;

  const ticks: number[] = [];
  // Счёт по индексу, а не накоплением: сложение шагов вроде 2.5 копило бы
  // погрешность и давало засечки «999,9999».
  const steps = Math.round((last - first) / step);
  for (let index = 0; index <= steps; index += 1) {
    ticks.push(first + index * step);
  }

  return ticks;
}

export type Scale = {
  domain: [number, number];
  range: [number, number];
  (value: number): number;
};

/** Линейная шкала. Вырожденный домен не делит на ноль, а кладёт всё в середину. */
export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  const scale = ((value: number) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)) as Scale;

  scale.domain = domain;
  scale.range = range;
  return scale;
}

/**
 * Домен, натянутый ровно на засечки, и сами засечки.
 *
 * Порядок именно такой — сначала засечки, потом домен по ним, а не наоборот.
 * Если сперва раздвинуть домен «с запасом», а потом округлить засечки наружу,
 * крайняя из них окажется за краем панели: подпись обрежет краем картинки или,
 * хуже, наложит на соседнюю панель. Натянув домен на засечки, мы получаем
 * ровные подписи, полное использование высоты и ни одной линии за кадром.
 *
 * Ноль в домен входит всегда: без нулевой линии столбик «минус» и столбик
 * «плюс» выглядят одинаково.
 */
export function niceDomain(
  values: readonly number[],
  count = 4,
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0] };

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const ticks = niceTicks(min, max, count);

  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  // Все значения нулевые: домен нулевой ширины делил бы на ноль в шкале.
  if (low === high) return { domain: [low, low + 1], ticks: [low] };

  return { domain: [low, high], ticks };
}

/** Центр `index`-й полосы в полосовой шкале. */
export function bandCenter(index: number, count: number, width: number, offset = 0): number {
  if (count <= 0) return offset + width / 2;
  return offset + (width / count) * (index + 0.5);
}

/** Ширина одной полосы за вычетом зазора между соседями (§ зазор — 2px). */
export function bandWidth(count: number, width: number, gap = 2, maxWidth = 24): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.min(maxWidth, width / count - gap));
}

export type Point = { x: number; y: number };

/** Ломаная через точки. Пустой список даёт пустой путь, а не `NaN`. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ');
}

/**
 * Ступенчатая ломаная: значение держится до следующей точки и меняется скачком.
 *
 * Именно так живёт остаток фонда (§6.9): между заказами он не «плавно
 * снижается», а стоит на месте, и рисовать наклон значило бы врать.
 */
export function stepPath(points: readonly Point[], endX?: number): string {
  if (points.length === 0) return '';

  const parts = [`M${round(points[0]!.x)} ${round(points[0]!.y)}`];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    parts.push(`H${round(point.x)}`, `V${round(point.y)}`);
  }
  if (endX !== undefined) parts.push(`H${round(endX)}`);

  return parts.join(' ');
}

/** Заливка под ступенчатой ломаной до базовой линии. */
export function stepAreaPath(
  points: readonly Point[],
  baselineY: number,
  endX?: number,
): string {
  if (points.length === 0) return '';

  const last = endX ?? points[points.length - 1]!.x;
  return `${stepPath(points, endX)} L${round(last)} ${round(baselineY)} L${round(points[0]!.x)} ${round(baselineY)} Z`;
}

/**
 * Доля отрезка `[from, to]` внутри окна `[windowFrom, windowTo]`, в единицах 0..1.
 *
 * Отсюда берутся положение и длина полосы отсутствия на таймлайне: полоса
 * обрезается окном, но не исчезает, если начало осталось за кадром.
 */
export function spanFraction(
  from: number,
  to: number,
  windowFrom: number,
  windowTo: number,
): { start: number; length: number } {
  const span = windowTo - windowFrom;
  if (span <= 0) return { start: 0, length: 0 };

  const clampedFrom = Math.max(from, windowFrom);
  const clampedTo = Math.min(to, windowTo);
  if (clampedTo < clampedFrom) return { start: 0, length: 0 };

  return {
    start: (clampedFrom - windowFrom) / span,
    length: (clampedTo - clampedFrom) / span,
  };
}

/** Координаты в SVG округляются до сотых: длинные хвосты только раздувают разметку. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
