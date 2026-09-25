'use client';

import { useCallback, useLayoutEffect, useRef, type RefCallback } from 'react';

import { glideDuration, glideKeyframes, type Box } from '@/lib/view/glide';

/**
 * Одна линза на всю полосу разделов, которая переплывает к выбранному.
 *
 * Раньше линзу рисовала сама ссылка выбранного раздела, и при переходе она
 * гасла на старом месте и загоралась на новом. Теперь это отдельный элемент
 * под ссылками: хук меряет выбранную ссылку, ставит линзу на её место и, если
 * раздел сменился, ведёт её по пути `glideKeyframes` — сжаться, переползти,
 * растечься.
 *
 * Если новый переход начался, пока линза ещё в пути, она продолжает с того
 * места, где её застал клик, а не прыгает обратно к старту. Смена размеров
 * полосы (ширина окна, шрифт) переставляет линзу без анимации. Кто просил
 * меньше движения, видит перестановку сразу.
 */
export function useGlidingPill(activeKey: string | null): {
  containerRef: RefCallback<HTMLElement>;
  pillRef: RefCallback<HTMLElement>;
  itemRef: (key: string) => RefCallback<HTMLElement>;
} {
  const container = useRef<HTMLElement | null>(null);
  const pill = useRef<HTMLElement | null>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const placed = useRef<Box | null>(null);
  const activeRef = useRef(activeKey);

  const measure = useCallback((element: HTMLElement): Box | null => {
    const host = container.current;
    if (host === null) return null;
    const outer = host.getBoundingClientRect();
    const inner = element.getBoundingClientRect();
    return {
      left: inner.left - outer.left + host.scrollLeft,
      top: inner.top - outer.top + host.scrollTop,
      width: inner.width,
      height: inner.height,
    };
  }, []);

  const place = useCallback((box: Box | null) => {
    const element = pill.current;
    if (element === null) return;
    if (box === null) {
      element.style.opacity = '0';
      placed.current = null;
      return;
    }
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    element.style.opacity = '1';
    placed.current = box;
  }, []);

  useLayoutEffect(() => {
    activeRef.current = activeKey;
    const element = pill.current;
    if (element === null) return;

    const target = activeKey === null ? undefined : items.current.get(activeKey);
    const to = target === undefined ? null : measure(target);
    if (to === null) {
      place(null);
      return;
    }

    // Линза в пути: стартуем с того места, где она сейчас на экране.
    const running = element.getAnimations();
    const from = running.length > 0 ? measure(element) : placed.current;
    for (const animation of running) animation.cancel();

    place(to);

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === null || calm || (from.left === to.left && from.width === to.width)) return;

    element.animate(glideKeyframes(from, to), { duration: glideDuration(from, to) });
  }, [activeKey, measure, place]);

  // Размеры полосы поменялись — линза встаёт на место без анимации.
  useLayoutEffect(() => {
    const host = container.current;
    if (host === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const key = activeRef.current;
      const target = key === null ? undefined : items.current.get(key);
      if (pill.current?.getAnimations().length) return;
      place(target === undefined ? null : measure(target));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure, place]);

  const containerRef = useCallback<RefCallback<HTMLElement>>((node) => {
    container.current = node;
  }, []);

  const pillRef = useCallback<RefCallback<HTMLElement>>((node) => {
    pill.current = node;
  }, []);

  const itemRef = useCallback(
    (key: string): RefCallback<HTMLElement> =>
      (node) => {
        if (node === null) items.current.delete(key);
        else items.current.set(key, node);
      },
    [],
  );

  return { containerRef, pillRef, itemRef };
}
