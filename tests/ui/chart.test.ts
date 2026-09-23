import { describe, expect, it } from 'vitest';

import {
  bandCenter,
  bandIndexAt,
  bandLayout,
  labelStride,
  bandWidth,
  chartBox,
  linePath,
  linearScale,
  niceDomain,
  niceStep,
  niceTicks,
  spanFraction,
  stepAreaPath,
  stepPath,
} from '@/lib/view/chart';

describe('область данных', () => {
  it('вычитает поля, оставляя место под ось', () => {
    const box = chartBox(400, 200, { top: 10, right: 10, bottom: 30, left: 50 });
    expect(box.plot).toEqual({ x: 50, y: 10, width: 340, height: 160 });
  });

  it('не уходит в отрицательный размер на узком контейнере', () => {
    const box = chartBox(40, 20, { top: 10, right: 10, bottom: 30, left: 50 });
    expect(box.plot.width).toBe(0);
    expect(box.plot.height).toBe(0);
  });
});

describe('засечки оси значений', () => {
  it('округляет шаг до 1, 2, 2.5 или 5 в своём порядке величины', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(30_000)).toBe(50_000);
  });

  it('всегда включает ноль и накрывает домен', () => {
    const ticks = niceTicks(-120_000, 340_000, 4);
    expect(ticks).toContain(0);
    expect(Math.min(...ticks)).toBeLessThanOrEqual(-120_000);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(340_000);
  });

  it('не копит погрешность на дробном шаге', () => {
    const ticks = niceTicks(0, 10, 4);
    expect(ticks).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('вырожденный домен даёт одну засечку', () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });
});

describe('шкалы', () => {
  it('переводит значение из домена в диапазон', () => {
    const scale = linearScale([0, 100], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(100)).toBe(0);
    expect(scale(50)).toBe(100);
  });

  it('вырожденный домен кладёт всё в середину, а не делит на ноль', () => {
    const scale = linearScale([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(Number.isFinite(scale(7))).toBe(true);
  });

});

describe('домен, натянутый на засечки', () => {
  it('не оставляет ни одной засечки за краем панели', () => {
    const { domain, ticks } = niceDomain([100_000, -150_000, 350_000], 2);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
    expect(ticks.every((tick) => tick >= domain[0] && tick <= domain[1])).toBe(true);
  });

  it('всегда включает ноль', () => {
    expect(niceDomain([100, 200, 300]).ticks).toContain(0);
    expect(niceDomain([-100, -200]).ticks).toContain(0);
  });

  it('даёт больше одной линии сетки на обычных данных', () => {
    expect(niceDomain([100_000, -150_000, 350_000], 2).ticks.length).toBeGreaterThanOrEqual(3);
  });

  it('вырожденные данные не дают домен нулевой ширины', () => {
    expect(niceDomain([]).domain).toEqual([0, 1]);
    expect(niceDomain([0, 0]).domain).toEqual([0, 1]);
  });
});

describe('полосовая шкала', () => {
  it('ставит центры полос равномерно', () => {
    expect(bandCenter(0, 4, 400)).toBe(50);
    expect(bandCenter(3, 4, 400)).toBe(350);
    expect(bandCenter(0, 4, 400, 20)).toBe(70);
  });

  it('оставляет зазор между соседями и не толстеет сверх предела', () => {
    expect(bandWidth(4, 400)).toBe(24);
    expect(bandWidth(40, 400, 2)).toBe(8);
    expect(bandWidth(0, 400)).toBe(0);
  });
});

describe('пути', () => {
  const points = [
    { x: 0, y: 10 },
    { x: 10, y: 20 },
    { x: 20, y: 5 },
  ];

  it('ломаная соединяет точки отрезками', () => {
    expect(linePath(points)).toBe('M0 10 L10 20 L20 5');
    expect(linePath([])).toBe('');
  });

  it('ступень держит значение до следующей точки', () => {
    expect(stepPath(points)).toBe('M0 10 H10 V20 H20 V5');
    expect(stepPath(points, 30)).toBe('M0 10 H10 V20 H20 V5 H30');
  });

  it('заливка замыкается на базовую линию', () => {
    expect(stepAreaPath(points, 100)).toBe('M0 10 H10 V20 H20 V5 L20 100 L0 100 Z');
    expect(stepAreaPath([], 100)).toBe('');
  });
});

describe('доля отрезка в окне', () => {
  it('считает положение и длину внутри окна', () => {
    expect(spanFraction(2, 4, 0, 10)).toEqual({ start: 0.2, length: 0.2 });
  });

  it('обрезает окном, но не выбрасывает пересекающий отрезок', () => {
    expect(spanFraction(-5, 5, 0, 10)).toEqual({ start: 0, length: 0.5 });
    expect(spanFraction(8, 20, 0, 10)).toEqual({ start: 0.8, length: 0.2 });
  });

  it('отрезок целиком вне окна даёт нулевую длину', () => {
    expect(spanFraction(20, 30, 0, 10)).toEqual({ start: 0, length: 0 });
    expect(spanFraction(0, 10, 5, 5)).toEqual({ start: 0, length: 0 });
  });
});

describe('раскладка полос под ширину', () => {
  it('растягивает немногие полосы на всю ширину', () => {
    expect(bandLayout(4, 800, 14)).toEqual({ plotWidth: 800, band: 200, scrolls: false });
  });

  it('не сжимает полосу уже минимума, а расширяет область и листает', () => {
    expect(bandLayout(40, 300, 14)).toEqual({ plotWidth: 560, band: 14, scrolls: true });
  });

  it('без полос не делит на ноль', () => {
    expect(bandLayout(0, 300, 14)).toEqual({ plotWidth: 300, band: 0, scrolls: false });
  });

  it('прореживает подписи так, чтобы они не слипались', () => {
    expect(labelStride(12, 60, 48)).toBe(1);
    expect(labelStride(52, 10, 48)).toBe(5);
    expect(labelStride(0, 10, 48)).toBe(1);
  });

  it('находит полосу под курсором и не выходит за край', () => {
    expect(bandIndexAt(76, 76, 20, 5)).toBe(0);
    expect(bandIndexAt(175.9, 76, 20, 5)).toBe(4);
    expect(bandIndexAt(176, 76, 20, 5)).toBeNull();
    expect(bandIndexAt(50, 76, 20, 5)).toBeNull();
  });
});
