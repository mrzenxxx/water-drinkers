/**
 * Разбор картинки по её собственным байтам.
 *
 * Чистая функция: на входе содержимое файла, на выходе тип и размеры или
 * внятная причина отказа. Ни базы, ни сети, ни `next/*` — поэтому проверяется
 * тестом на нескольких байтах, без браузера и без загрузки настоящих файлов.
 *
 * Тип **не берётся** из того, что прислал браузер. `Content-Type` в форме —
 * такой же ввод, как и всё прочее: файл, названный `image/png`, может оказаться
 * страницей HTML, и, отданный обратно с этим заголовком, он выполнится в чужом
 * браузере. Поэтому тип выводится из сигнатуры, а объявленный лишь сверяется.
 *
 * Размеры достаются заодно: зная их, страница резервирует место под картинку
 * и не дёргается, когда та догрузится.
 */

/**
 * Предел размера файла.
 *
 * Два мегабайта — это фотография объявления с доски или снимок экрана, чего
 * для сообщения в офисной кассе более чем достаточно. Картинки лежат в базе
 * (см. `announcement_images` в §11), и снимать ограничение здесь означало бы
 * складывать в неё чужие обои.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Форматы, которые умеет показать любой браузер и не умеет исполнить. */
export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export type ImageInfo = {
  mediaType: ImageMediaType;
  width: number;
  height: number;
};

/** Отказ с причиной, написанной для человека, а не для лога. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

const TYPE_LABEL: Record<ImageMediaType, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
};

/** Список для подписи `accept` у поля выбора файла и для текстов ошибок. */
export const SUPPORTED_IMAGE_TYPES = Object.keys(TYPE_LABEL) as ImageMediaType[];

/**
 * Тип и размеры картинки или отказ.
 *
 * `declaredType` — то, чем файл назвался. Он не решает ничего: если сигнатура
 * говорит другое, верна сигнатура, а расхождение — повод отказать.
 */
export function inspectImage(bytes: Uint8Array, declaredType?: string | null): ImageInfo {
  if (bytes.byteLength === 0) {
    throw new ImageError('Файл пустой.');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageError(
      `Картинка больше ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} МБ. Уменьшите её и попробуйте снова.`,
    );
  }

  const info = readPng(bytes) ?? readGif(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);

  if (info === null) {
    throw new ImageError(
      `Это не картинка одного из поддерживаемых форматов: ${Object.values(TYPE_LABEL).join(', ')}.`,
    );
  }

  // Расхождение с объявленным типом — не мелочь: либо файл переименовали,
  // либо его подменили по дороге. И то и другое стоит показать вслух.
  if (
    declaredType !== undefined &&
    declaredType !== null &&
    declaredType !== '' &&
    normalizeType(declaredType) !== info.mediaType
  ) {
    throw new ImageError(
      `Файл назван «${declaredType}», а внутри ${TYPE_LABEL[info.mediaType]}. Пересохраните картинку.`,
    );
  }

  if (info.width <= 0 || info.height <= 0) {
    throw new ImageError('У картинки нулевой размер — файл повреждён.');
  }

  return info;
}

function normalizeType(value: string): string {
  const type = value.split(';')[0]?.trim().toLowerCase() ?? '';
  // `image/jpg` пишут в половине форм, хотя правильный тип — `image/jpeg`.
  return type === 'image/jpg' ? 'image/jpeg' : type;
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.byteLength < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  return matches(bytes, offset, [...text].map((char) => char.charCodeAt(0)));
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] as number) << 24) |
    ((bytes[offset + 1] as number) << 16) |
    ((bytes[offset + 2] as number) << 8) |
    (bytes[offset + 3] as number)
  ) >>> 0;
}

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] as number) << 8) | (bytes[offset + 1] as number);
}

function u16le(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset + 1] as number) << 8) | (bytes[offset] as number);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** У PNG размеры лежат в заголовке IHDR — он всегда первый блок. */
function readPng(bytes: Uint8Array): ImageInfo | null {
  if (!matches(bytes, 0, PNG_SIGNATURE)) return null;
  if (bytes.byteLength < 24 || !ascii(bytes, 12, 'IHDR')) return null;

  return { mediaType: 'image/png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function readGif(bytes: Uint8Array): ImageInfo | null {
  if (!ascii(bytes, 0, 'GIF87a') && !ascii(bytes, 0, 'GIF89a')) return null;
  if (bytes.byteLength < 10) return null;

  return { mediaType: 'image/gif', width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

/**
 * WebP бывает трёх видов, и размеры в каждом лежат по-своему: простой (`VP8 `),
 * без потерь (`VP8L`) и расширенный (`VP8X`). Разбираются все три — иначе
 * половина современных снимков экрана отвергалась бы как «не картинка».
 */
function readWebp(bytes: Uint8Array): ImageInfo | null {
  if (!ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null;
  if (bytes.byteLength < 30) return null;

  if (ascii(bytes, 12, 'VP8X')) {
    // Размеры холста хранятся тремя байтами и уменьшенными на единицу.
    const width = 1 + ((bytes[24] as number) | ((bytes[25] as number) << 8) | ((bytes[26] as number) << 16));
    const height = 1 + ((bytes[27] as number) | ((bytes[28] as number) << 8) | ((bytes[29] as number) << 16));
    return { mediaType: 'image/webp', width, height };
  }

  if (ascii(bytes, 12, 'VP8L')) {
    // 14 бит на сторону, упакованы подряд начиная с 21-го байта.
    const packed =
      (bytes[21] as number) |
      ((bytes[22] as number) << 8) |
      ((bytes[23] as number) << 16) |
      ((bytes[24] as number) << 24);
    return {
      mediaType: 'image/webp',
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }

  if (ascii(bytes, 12, 'VP8 ')) {
    return {
      mediaType: 'image/webp',
      width: u16le(bytes, 26) & 0x3fff,
      height: u16le(bytes, 28) & 0x3fff,
    };
  }

  return null;
}

/**
 * У JPEG размеров в начале файла нет: их приходится искать, перебирая сегменты
 * до первого заголовка кадра (SOF). Сегменты с данными изображения пропускаются
 * по объявленной длине, поэтому перебор не превращается в разбор всей картинки.
 */
function readJpeg(bytes: Uint8Array): ImageInfo | null {
  if (!matches(bytes, 0, [0xff, 0xd8])) return null;

  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1] as number;

    // Заполнители и маркеры без полезной нагрузки длины не несут.
    if (marker === 0xff || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const isFrameHeader =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isFrameHeader) {
      return {
        mediaType: 'image/jpeg',
        height: u16be(bytes, offset + 5),
        width: u16be(bytes, offset + 7),
      };
    }

    const length = u16be(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}
