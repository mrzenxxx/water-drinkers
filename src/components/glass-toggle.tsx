'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { nextGlass } from '@/lib/glass';
import { getServerSnapshot, getSnapshot, setGlass, subscribe } from '@/lib/glass-store';

/**
 * Переключатель стекла: матовое ↔ жидкое. Стоит в шапке слева от темы.
 *
 * В отличие от кнопки темы, это переключатель с состоянием (`aria-pressed`):
 * «жидкое стекло включено» — да или нет. Значок — пузырик: пустой контур в
 * матовом виде, с бликом и заливкой — в жидком.
 */
export function GlassToggle(): ReactNode {
  const style = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const liquid = style === 'liquid';
  const label = liquid ? 'Выключить жидкое стекло' : 'Включить жидкое стекло';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setGlass(nextGlass(style))}
      aria-label="Жидкое стекло"
      aria-pressed={liquid}
      title={label}
    >
      <BubbleIcon />
    </Button>
  );
}

/**
 * Пузырик, который вытягивается в три.
 *
 * Матовое стекло — один пузырёк с бликом внутри, без заливки. Жидкое —
 * три пересекающиеся окружности, уходящие вдаль по диагонали в 45°: каждая
 * следующая меньше и дальше, как пузырьки, поднимающиеся в толще воды.
 *
 * Все три окружности есть всегда. В матовом виде они стоят друг на друге и
 * читаются одним пузырьком; при переключении разъезжаются по диагонали, а
 * блик гаснет. Положение задаёт CSS по атрибуту `data-glass` на
 * `<html>` (`.glass-bubble` в `globals.css`), а не состояние React: атрибут
 * стоит ещё до первой отрисовки, и в жидком виде пузырьки не разъезжаются
 * заново при каждой загрузке страницы — только по нажатию.
 */
function BubbleIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className="glass-bubbles size-5 overflow-visible"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      {/* Дальний рисуется первым, ближний — поверх. */}
      <g className="glass-bubble glass-bubble-3">
        <circle r="8" vectorEffect="non-scaling-stroke" />
      </g>
      <g className="glass-bubble glass-bubble-2">
        <circle r="8" vectorEffect="non-scaling-stroke" />
      </g>
      <g className="glass-bubble glass-bubble-1">
        <circle r="8" vectorEffect="non-scaling-stroke" />
        {/* Блик: светлая дуга и искра в верхней левой четверти. */}
        <g className="glass-bubble-glint">
          <path
            d="M-5.2 -1.2a5.4 5.4 0 0 1 4-4"
            stroke="currentColor"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="3.4" cy="-4.2" r="1" fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
