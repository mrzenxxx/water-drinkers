import { describe, expect, it } from 'vitest';

import { MAX_RECEIPT_BYTES, ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

/**
 * Разбор чека по его собственным байтам (§8.4).
 *
 * Настоящие файлы не нужны: решают сигнатуры, и они собираются здесь руками.
 * Заодно видно, что именно функция читает, а что игнорирует.
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

/** Настоящий PNG 4×2: размеры лежат в заголовке IHDR, больше ничего не нужно. */
const PNG = bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  [0x00, 0x00, 0x00, 0x0d],
  'IHDR',
  [0x00, 0x00, 0x00, 0x04],
  [0x00, 0x00, 0x00, 0x02],
  [0x08, 0x06, 0x00, 0x00, 0x00],
);

const PDF = bytes('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

describe('разбор файла чека', () => {
  it('узнаёт PDF по сигнатуре и считает размер', () => {
    expect(inspectReceiptFile(PDF)).toEqual({
      mediaType: 'application/pdf',
      byteSize: PDF.byteLength,
    });
  });

  it('узнаёт картинку', () => {
    expect(inspectReceiptFile(PNG).mediaType).toBe('image/png');
  });

  it('принимает совпадающий объявленный тип', () => {
    expect(inspectReceiptFile(PDF, 'application/pdf').mediaType).toBe('application/pdf');
    expect(inspectReceiptFile(PNG, 'image/png').mediaType).toBe('image/png');
  });

  it('отказывает, когда объявленный тип расходится с настоящим', () => {
    expect(() => inspectReceiptFile(PDF, 'image/png')).toThrow(ReceiptFileError);
  });

  it('отказывает файлу неизвестного формата', () => {
    // HTML, названный чеком: ровно тот случай, ради которого тип берётся
    // из сигнатуры, а не из формы.
    expect(() => inspectReceiptFile(bytes('<!doctype html><script>'), 'application/pdf')).toThrow(
      ReceiptFileError,
    );
  });

  it('отказывает пустому файлу', () => {
    expect(() => inspectReceiptFile(new Uint8Array(0))).toThrow(ReceiptFileError);
  });

  it('отказывает файлу больше предела', () => {
    const huge = new Uint8Array(MAX_RECEIPT_BYTES + 1);
    huge.set(PDF, 0);
    expect(() => inspectReceiptFile(huge)).toThrow(/5 МБ/);
  });

  it('сообщения написаны для человека, а не для лога', () => {
    expect(() => inspectReceiptFile(new Uint8Array(0))).toThrow('Файл пустой.');
  });
});
