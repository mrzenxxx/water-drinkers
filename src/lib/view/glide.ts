/**
 * Путь пузырька-линзы между разделами навигации.
 *
 * Линза не прыгает и не просто едет: как капля, она сначала подтягивает
 * заднюю кромку к передней и сжимается в маленький пузырёк на краю текущего
 * раздела — в промежутке между подписями со стороны, куда движется, — затем
 * переползает к ближнему краю нового раздела и уже там растекается на всю его
 * ширину. Направление берётся из взаимного положения разделов: вправо —
 * пузырёк выходит из правого края и входит в левый, влево — наоборот.
 *
 * Функция чистая: на входе два прямоугольника, на выходе ключевые кадры для
 * `Element.animate`. Поэтому путь проверяется тестом без браузера.
 */

export type Box = { left: number; top: number; width: number; height: number };

export type GlideFrame = {
  left: string;
  top: string;
  width: string;
  height: string;
  offset: number;
  easing?: string;
};

/** Пузырёк в середине пути: ширина в пикселях и доля высоты раздела. */
const BLOB_WIDTH = 14;
const BLOB_HEIGHT = 0.55;

/** Доли времени: сжатие, переползание, растекание. */
const SHRINK_END = 0.3;
const TRAVEL_END = 0.7;

const EASE_OUT = 'cubic-bezier(0.3, 0, 0.2, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.35, 1)';

function frame(box: Box, offset: number, easing?: string): GlideFrame {
  const result: GlideFrame = {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    offset,
  };
  if (easing !== undefined) result.easing = easing;
  return result;
}

/** Пузырёк с центром в точке `x` на средней линии прямоугольника `around`. */
function blobAt(x: number, around: Box): Box {
  const height = Math.max(4, around.height * BLOB_HEIGHT);
  const width = Math.min(BLOB_WIDTH, around.width);
  return {
    left: x - width / 2,
    top: around.top + (around.height - height) / 2,
    width,
    height,
  };
}

export function glideKeyframes(from: Box, to: Box): GlideFrame[] {
  const rightward = to.left + to.width / 2 >= from.left + from.width / 2;

  // Выход — через край, обращённый к цели; вход — через ближний к старту край цели.
  const exitX = rightward ? from.left + from.width : from.left;
  const entryX = rightward ? to.left : to.left + to.width;

  return [
    frame(from, 0, EASE_OUT),
    frame(blobAt(exitX, from), SHRINK_END, EASE_IN_OUT),
    frame(blobAt(entryX, to), TRAVEL_END, EASE_OUT),
    frame(to, 1),
  ];
}

/**
 * Длительность пути: дальше — дольше, но не бесконечно. Короткий шаг к
 * соседу занимает около полусекунды, переход через всю полосу — не больше
 * восьмисот миллисекунд.
 */
export function glideDuration(from: Box, to: Box): number {
  const distance = Math.abs(to.left + to.width / 2 - (from.left + from.width / 2));
  return Math.round(420 + Math.min(distance * 0.4, 380));
}
