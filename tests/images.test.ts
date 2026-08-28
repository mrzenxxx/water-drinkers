import { describe, expect, it } from 'vitest';

import { ImageError, MAX_IMAGE_BYTES, inspectImage } from '@/lib/images';

/**
 * Разбор картинки по её собственным байтам (§6.12).
 *
 * Настоящие файлы для этого не нужны: размеры лежат в заголовке, и заголовок
 * собирается здесь руками. Заодно видно, что именно функция читает.
 */

function bytes(...parts: (number | number[] | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') flat.push(...[...part].map((char) => char.charCodeAt(0)));
    else if (Array.isArray(part)) flat.push(...part);
    else flat.push(part);
  }
  return Uint8Array.from(flat);
}

const u32be = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const u16be = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff];
const u16le = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff];
const u24le = (value: number): number[] => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
];

function png(width: number, height: number): Uint8Array {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    u32be(13),
    'IHDR',
    u32be(width),
    u32be(height),
    [8, 6, 0, 0, 0],
  );
}

function gif(width: number, height: number): Uint8Array {
  return bytes('GIF89a', u16le(width), u16le(height), [0x00, 0x00, 0x00, 0x00]);
}

/** Минимальный JPEG: маркер начала и заголовок кадра SOF0. */
function jpeg(width: number, height: number): Uint8Array {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xc0],
    u16be(17),
    [8],
    u16be(height),
    u16be(width),
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );
}

/** WebP расширенного вида: размеры холста тремя байтами, уменьшенные на единицу. */
function webp(width: number, height: number): Uint8Array {
  return bytes(
    'RIFF',
    u32be(0),
    'WEBP',
    'VP8X',
    u32be(10),
    [0, 0, 0, 0],
    u24le(width - 1),
    u24le(height - 1),
  );
}

describe('разбор картинки', () => {
  it('читает размеры PNG, GIF, JPEG и WebP', () => {
    expect(inspectImage(png(640, 480))).toEqual({
      mediaType: 'image/png',
      width: 640,
      height: 480,
    });
    expect(inspectImage(gif(16, 9))).toEqual({ mediaType: 'image/gif', width: 16, height: 9 });
    expect(inspectImage(jpeg(1024, 768))).toEqual({
      mediaType: 'image/jpeg',
      width: 1024,
      height: 768,
    });
    expect(inspectImage(webp(300, 200))).toEqual({
      mediaType: 'image/webp',
      width: 300,
      height: 200,
    });
  });

  it('тип берётся из сигнатуры, а не из того, чем файл назвался', () => {
    // Страница HTML, названная картинкой, отданная обратно с этим заголовком,
    // выполнилась бы в чужом браузере. Поэтому решает содержимое.
    expect(() => inspectImage(bytes('<!doctype html><script>'), 'image/png')).toThrow(ImageError);
  });

  it('расхождение объявленного типа с настоящим — отказ', () => {
    expect(() => inspectImage(png(10, 10), 'image/jpeg')).toThrow(/внутри PNG/);
  });

  it('`image/jpg` из форм считается тем же, что `image/jpeg`', () => {
    expect(inspectImage(jpeg(8, 8), 'image/jpg').mediaType).toBe('image/jpeg');
  });

  it('пустой и слишком большой файл не принимаются', () => {
    expect(() => inspectImage(new Uint8Array(0))).toThrow(/пустой/);
    expect(() => inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow(/больше 2 МБ/);
  });

  it('обрубленный заголовок — не картинка, а не «нулевой размер»', () => {
    expect(() => inspectImage(bytes([0x89, 0x50, 0x4e, 0x47]))).toThrow(ImageError);
  });

  it('JPEG без заголовка кадра отвергается, а не зацикливается', () => {
    // Сегмент комментария и ничего больше: размеров в файле нет.
    const truncated = bytes([0xff, 0xd8], [0xff, 0xfe], u16be(12), new Array(10).fill(0x20));
    expect(() => inspectImage(truncated)).toThrow(ImageError);
  });
});
