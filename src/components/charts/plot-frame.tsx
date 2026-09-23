'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
} from 'react';

import { bandIndexAt } from '@/lib/view/chart';

/**
 * Общая механика графиков: ширина, наведение и касание.
 *
 * Графики рисуются в настоящих пикселях контейнера, а не растягиванием
 * картинки фиксированной ширины: у растянутой `viewBox` на широком экране
 * вырастают шрифт и толщина линий, на узком они же становятся нечитаемыми.
 * Ширину меряет `ResizeObserver`; до первого замера (и на сервере) график
 * рисуется на запасной ширине — геометрия та же, только масштаб другой.
 *
 * Подсказка — своя, а не Radix: ей нужно открываться и от мыши, и от касания
 * пальцем (у Radix касание подсказку не открывает), и стоять у текущей
 * полосы, а не у элемента-триггера.
 */

/**
 * Ширина рамки графика в пикселях; `fallback` — до первого замера.
 *
 * `ref` вешается на рамку, `frame` — та же рамка объектом: по ней
 * подсказка узнаёт, что касание пришлось мимо графика.
 */
export function useFrameWidth(fallback: number): {
  ref: (node: HTMLDivElement | null) => () => void;
  frame: React.RefObject<HTMLDivElement | null>;
  width: number;
} {
  const [width, setWidth] = useState(fallback);
  const frame = useRef<HTMLDivElement | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    frame.current = node;
    if (node === null) return () => {};
    const observer = new ResizeObserver((entries) => {
      const measured = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      frame.current = null;
    };
  }, []);

  return { ref, frame, width };
}

export type PlotHover = {
  /** Номер полосы под курсором или пальцем. */
  active: number | null;
  /** Высота курсора внутри картинки — по ней ищется ближайшая линия. */
  pointerY: number | null;
  setActive: (index: number | null) => void;
  /** Обработчики на `<svg>`. */
  svgProps: {
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerLeave: (event: PointerEvent<SVGSVGElement>) => void;
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
    onBlur: () => void;
    tabIndex: number;
  };
};

/**
 * Какая полоса выбрана.
 *
 * Мышь выбирает наведением и снимает выбор уходом с графика. Палец выбирает
 * касанием; касание той же полосы или мимо графика подсказку закрывает.
 * С клавиатуры — стрелки, Home/End и Escape.
 */
export function usePlotHover({
  count,
  left,
  band,
  container,
}: {
  count: number;
  left: number;
  band: number;
  /** Касание вне этого элемента закрывает подсказку. */
  container: React.RefObject<HTMLElement | null>;
}): PlotHover {
  const [active, setActive] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);

  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      index: bandIndexAt(event.clientX - rect.left, left, band, count),
      y: event.clientY - rect.top,
    };
  };

  useEffect(() => {
    if (active === null) return;
    const close = (event: globalThis.PointerEvent) => {
      const node = container.current;
      if (node !== null && event.target instanceof Node && !node.contains(event.target)) {
        setActive(null);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [active, container]);

  return {
    active,
    pointerY,
    setActive,
    svgProps: {
      tabIndex: 0,
      onPointerMove: (event) => {
        if (event.pointerType === 'touch') return;
        const { index, y } = locate(event);
        setActive(index);
        setPointerY(y);
      },
      onPointerDown: (event) => {
        if (event.pointerType !== 'touch') return;
        const { index, y } = locate(event);
        setPointerY(y);
        setActive((current) => (current === index ? null : index));
      },
      onPointerLeave: (event) => {
        if (event.pointerType === 'touch') return;
        setActive(null);
        setPointerY(null);
      },
      onKeyDown: (event) => {
        if (count === 0) return;
        const moves: Record<string, (current: number) => number> = {
          ArrowLeft: (current) => Math.max(0, current - 1),
          ArrowRight: (current) => Math.min(count - 1, current + 1),
          Home: () => 0,
          End: () => count - 1,
        };
        if (event.key === 'Escape') {
          setActive(null);
          return;
        }
        const move = moves[event.key];
        if (move === undefined) return;
        event.preventDefault();
        setPointerY(null);
        setActive((current) => move(current ?? count - 1));
      },
      onBlur: () => setActive(null),
    },
  };
}

/**
 * Карточка у выбранной полосы.
 *
 * Встаёт справа от полосы, а во второй половине графика — слева, чтобы
 * не уходить за край. `x` — в координатах рамки (с учётом прокрутки).
 */
export function PlotTip({
  x,
  frameWidth,
  children,
}: {
  x: number;
  frameWidth: number;
  children: ReactNode;
}): ReactNode {
  const onRight = x <= frameWidth / 2;

  return (
    <div
      role="status"
      className="glass-strong animate-in fade-in-0 zoom-in-95 pointer-events-none absolute top-2 z-20 w-max max-w-[min(20rem,calc(100%-1rem))] rounded-lg px-3 py-2 text-xs leading-snug duration-100 motion-reduce:animate-none"
      style={onRight ? { left: Math.max(8, x + 12) } : { right: Math.max(8, frameWidth - x + 12) }}
    >
      {children}
    </div>
  );
}

/**
 * Листаемая область графика, который не поместился по ширине.
 *
 * При показе и при смене ширины она прокручена к правому краю: свежие шаги
 * важнее давних. Позиция прокрутки отдаётся наружу, чтобы подсказка стояла
 * у полосы, а не там, где полоса была до прокрутки.
 */
export function useScrollToEnd(
  contentWidth: number,
  scrolls: boolean,
): {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
} {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const node = scrollRef.current;
    // Присваивание прокрутки само вызывает `scroll`, а он — `onScroll`.
    if (node !== null && scrolls) node.scrollLeft = node.scrollWidth;
  }, [contentWidth, scrolls]);

  return {
    scrollRef,
    scrollLeft: scrolls ? scrollLeft : 0,
    onScroll: (event) => setScrollLeft(event.currentTarget.scrollLeft),
  };
}
