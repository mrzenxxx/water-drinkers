/**
 * Разбор файла чека по его собственным байтам (§8.4).
 *
 * Чистая функция: на входе содержимое файла, на выходе тип и размер или
 * внятная причина отказа. Ни базы, ни сети, ни `next/*` — поэтому проверяется
 * на нескольких байтах, без браузера и без настоящих файлов.
 *
 * Тип **не берётся** из того, что прислал браузер: файл, названный
 * `application/pdf`, может оказаться страницей HTML, и, отданный обратно с
 * этим заголовком, он выполнится в чужом браузере. Решает сигнатура,
 * объявленный тип лишь сверяется.
 */

import { type ImageMediaType, normalizeMediaType, readImageInfo } from '@/lib/images';

/**
 * Предел размера файла.
 *
 * Пять мегабайт — это снимок экрана банковского перевода или PDF-квитанция
 * с запасом. Файлы лежат в базе (ADR-0003), и снимать ограничение здесь
 * означало бы складывать в неё сканы в полный рост.
 */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptMediaType = ImageMediaType | 'application/pdf';

export type ReceiptFileInfo = {
  mediaType: ReceiptMediaType;
  byteSize: number;
};

/** Отказ с причиной, написанной для человека, а не для лога. */
export class ReceiptFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptFileError';
  }
}

const TYPE_LABEL: Record<ReceiptMediaType, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
};

export const SUPPORTED_RECEIPT_TYPES = Object.keys(TYPE_LABEL) as ReceiptMediaType[];

/** Значение `accept` у поля выбора файла. */
export const RECEIPT_ACCEPT = SUPPORTED_RECEIPT_TYPES.join(',');

/** `%PDF-` — первые пять байтов любого PDF. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_SIGNATURE.length) return false;
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function inspectReceiptFile(
  bytes: Uint8Array,
  declaredType?: string | null,
): ReceiptFileInfo {
  if (bytes.byteLength === 0) {
    throw new ReceiptFileError('Файл пустой.');
  }
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new ReceiptFileError(
      `Файл больше ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Уменьшите его и попробуйте снова.`,
    );
  }

  const mediaType: ReceiptMediaType | null = isPdf(bytes)
    ? 'application/pdf'
    : (readImageInfo(bytes)?.mediaType ?? null);

  if (mediaType === null) {
    throw new ReceiptFileError(
      `Это не файл одного из поддерживаемых форматов: ${Object.values(TYPE_LABEL).join(', ')}.`,
    );
  }

  // Расхождение с объявленным типом — не мелочь: либо файл переименовали,
  // либо его подменили по дороге. И то и другое стоит показать вслух.
  if (
    declaredType !== undefined &&
    declaredType !== null &&
    declaredType !== '' &&
    normalizeMediaType(declaredType) !== mediaType
  ) {
    throw new ReceiptFileError(
      `Файл назван «${declaredType}», а внутри ${TYPE_LABEL[mediaType]}. Пересохраните его и попробуйте снова.`,
    );
  }

  return { mediaType, byteSize: bytes.byteLength };
}
