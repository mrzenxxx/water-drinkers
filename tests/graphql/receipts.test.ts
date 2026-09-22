import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

const UPLOAD = `
  mutation ($file: ReceiptFileInput!) {
    uploadReceipt(file: $file) {
      id
      url
      mediaType
      byteSize
    }
  }
`;

/** Настоящий PDF: разбору хватает сигнатуры `%PDF-`. */
const PDF_BASE64 = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n').toString('base64');

describe('загрузка чека', () => {
  it('требует входа', async () => {
    const db = seedOffice();
    const result = await run(UPLOAD, {
      db: db.client,
      variables: { file: { base64: PDF_BASE64, mediaType: 'application/pdf' } },
    });
    expect(errorCode(result)).toBe('UNAUTHENTICATED');
  });

  it('доступна участнику: чек взноса прикладывает он сам (§6.2)', async () => {
    const db = seedOffice();
    const data = await runOk(UPLOAD, {
      db: db.client,
      userId: 'u-0',
      variables: { file: { base64: PDF_BASE64, mediaType: 'application/pdf' } },
    });

    const receipt = data.uploadReceipt as { id: string; url: string; mediaType: string; byteSize: number };
    expect(receipt.url).toBe(`/api/receipts/${receipt.id}`);
    expect(receipt.mediaType).toBe('application/pdf');
    expect(receipt.byteSize).toBe(Buffer.from(PDF_BASE64, 'base64').byteLength);
  });

  it('кладёт байты отдельной таблицей и помечает место хранения', async () => {
    const db = seedOffice();
    const data = await runOk(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { file: { base64: PDF_BASE64 } },
    });

    const { id } = data.uploadReceipt as { id: string };
    expect(db.tables.receiptFile.rows).toHaveLength(1);
    // seedOffice заводит один чек заранее (§6.5): ищем свежую запись по id,
    // а не по индексу — порядок строк таблицы не гарантирован.
    const uploaded = db.tables.receipt.rows.find((row) => row.id === id);
    expect(uploaded).toMatchObject({ id, storageKey: `db:${id}` });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toContain('receipt.upload');
  });

  it('отказывает файлу, который не является чеком', async () => {
    const db = seedOffice();
    // seedOffice заводит один чек заранее (§6.5) — отказ не должен добавить второй.
    const receiptCountBeforeUpload = db.tables.receipt.rows.length;
    const result = await run(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        file: {
          base64: Buffer.from('<!doctype html><script>alert(1)</script>').toString('base64'),
          mediaType: 'application/pdf',
        },
      },
    });

    // Код ошибки — BAD_USER_INPUT (см. `@/graphql/errors`), как и у всех
    // остальных отказов по вводу в проекте.
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
    // Отказ не оставляет за собой ни чека, ни файла.
    expect(db.tables.receipt.rows).toHaveLength(receiptCountBeforeUpload);
    expect(db.tables.receiptFile.rows).toHaveLength(0);
  });

  it('отказывает, когда объявленный тип расходится с настоящим', async () => {
    const db = seedOffice();
    const result = await run(UPLOAD, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { file: { base64: PDF_BASE64, mediaType: 'image/png' } },
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });
});
