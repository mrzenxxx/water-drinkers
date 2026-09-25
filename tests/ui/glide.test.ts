import { describe, expect, it } from 'vitest';

import { glideDuration, glideKeyframes, type Box } from '@/lib/view/glide';

const A: Box = { left: 0, top: 0, width: 100, height: 36 };
const B: Box = { left: 110, top: 0, width: 80, height: 36 };

const px = (value: string): number => Number(value.replace('px', ''));

describe('путь линзы между разделами', () => {
  it('начинается на старом разделе и кончается на новом', () => {
    const frames = glideKeyframes(A, B);
    expect(frames[0]).toMatchObject({ left: '0px', width: '100px', offset: 0 });
    expect(frames.at(-1)).toMatchObject({ left: '110px', width: '80px', offset: 1 });
  });

  it('вправо: сжимается у правого края старого и входит в левый край нового', () => {
    const [, shrunk, arrived] = glideKeyframes(A, B);
    expect(px(shrunk!.left) + px(shrunk!.width) / 2).toBe(100);
    expect(px(arrived!.left) + px(arrived!.width) / 2).toBe(110);
    expect(px(shrunk!.width)).toBeLessThan(A.width);
  });

  it('влево: зеркально — через левый край старого и правый край нового', () => {
    const [, shrunk, arrived] = glideKeyframes(B, A);
    expect(px(shrunk!.left) + px(shrunk!.width) / 2).toBe(110);
    expect(px(arrived!.left) + px(arrived!.width) / 2).toBe(100);
  });

  it('в середине пути пузырёк ниже раздела и стоит по его средней линии', () => {
    const [, shrunk] = glideKeyframes(A, B);
    const height = px(shrunk!.height);
    expect(height).toBeLessThan(A.height);
    expect(px(shrunk!.top) + height / 2).toBe(A.top + A.height / 2);
  });

  it('далёкий переход длится дольше соседнего, но в разумных пределах', () => {
    const near = glideDuration(A, B);
    const far = glideDuration(A, { ...B, left: 900 });
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(800);
  });
});
