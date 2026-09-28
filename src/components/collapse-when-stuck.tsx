'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Узкий экран — тот, где раскрытая липкая панель закрыла бы собой список. */
const NARROW = '(max-width: 47.99rem)';

/**
 * Сворачивает липкую панель (`.sticky-filters`) на телефоне, когда её
 * прокрутили.
 *
 * Пока панель стоит на своём месте в начале страницы, она раскрыта — по ней
 * видно, что выбрано. Когда начало того, что под ней (список, сводка),
 * доходит до шапки, раскрытая панель на телефоне закрывала бы полэкрана
 * поверх него, и она сворачивается в строку заголовка. Раскрыть её снова
 * можно нажатием, прямо поверх списка. На широком экране места хватает, и
 * панель остаётся как есть.
 *
 * Свернувшись, панель укорачивается в потоке, и всё под ней подскочило бы на
 * её высоту — человек потерял бы строку, которую читал. Поэтому прокрутка
 * возвращается ровно на этот сдвиг. Ждать, пока место панели на странице
 * прокрутится целиком, нужно именно ради этого: сворачивайся она в сам момент
 * прилипания, вернуть прокрутку было бы некуда — выше начала страницы.
 *
 * Обёртка `display: contents` не создаёт своей коробки: панель остаётся
 * прямым участником колонки страницы, и прилипание работает относительно неё.
 * Сворачивается панель только на переходе «ещё не прокручена → прокручена»,
 * поэтому раскрытую вручную панель не захлопывает каждый следующий шаг
 * прокрутки.
 */
export function CollapseWhenStuck({ children }: { children: ReactNode }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = ref.current?.firstElementChild;
    const below = ref.current?.nextElementSibling;
    if (!(panel instanceof HTMLDetailsElement) || !below) return;

    const narrow = window.matchMedia(NARROW);
    let passed = false;
    let frame = 0;

    const collapse = (): void => {
      const before = below.getBoundingClientRect().top;
      panel.open = false;
      // Если браузер уже поправил прокрутку сам (привязка прокрутки), сдвиг нулевой.
      const shift = below.getBoundingClientRect().top - before;
      if (shift !== 0) window.scrollBy(0, shift);
    };

    const check = (): void => {
      frame = 0;
      const stickyTop = Number.parseFloat(getComputedStyle(panel).top);
      const now = below.getBoundingClientRect().top <= stickyTop;
      if (now && !passed && narrow.matches && panel.open) collapse();
      passed = now;
    };
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
