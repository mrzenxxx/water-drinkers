import type { GraphQLContext } from '@/graphql/context';
import type { Confidence, ReceiptResolvers } from '@/graphql/generated/graphql';

/**
 * Чек и результат его распознавания (§8).
 *
 * Само распознавание — этап 6; здесь только чтение того, что записано
 * в `receipts.extraction`. Разбор нарочно недоверчивый: JSONB мог быть записан
 * прошлой версией провайдера, и падать на этом всей страницей незачем —
 * непрочитанное извлечение отдаётся как `null`, чек всё равно виден.
 */

export type StoredExtraction = {
  paidAt: string | null;
  amountKopecks: number | null;
  payerHint: string | null;
  confidence: Confidence;
  notes: string;
  provider: string;
};

const CONFIDENCE: Record<string, Confidence> = {
  HIGH: 'HIGH' as Confidence,
  MEDIUM: 'MEDIUM' as Confidence,
  LOW: 'LOW' as Confidence,
  high: 'HIGH' as Confidence,
  medium: 'MEDIUM' as Confidence,
  low: 'LOW' as Confidence,
};

/** `receipts.extraction` → структура §8.1, или `null`, если прочитать нельзя. */
export function parseExtraction(value: unknown): StoredExtraction | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const confidence = CONFIDENCE[String(raw.confidence)];
  if (confidence === undefined) return null;

  return {
    paidAt: typeof raw.paidAt === 'string' ? raw.paidAt : null,
    amountKopecks: Number.isSafeInteger(raw.amountKopecks) ? (raw.amountKopecks as number) : null,
    payerHint: typeof raw.payerHint === 'string' ? raw.payerHint : null,
    confidence,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    provider: typeof raw.provider === 'string' ? raw.provider : 'unknown',
  };
}

export const Receipt: ReceiptResolvers<GraphQLContext> = {
  /**
   * Адрес выдачи файла. Наружу отдаётся ссылка на приложение, а не на
   * хранилище: маршрут `src/app/api/receipts/[id]/route.ts` уже проверяет вход
   * (401), право на конкретный чек (404 для чужого и несуществующего),
   * отдаёт `ETag` и `nosniff`, PDF — в песочнице. Хранилище выбрано (§8.4,
   * ADR-0003): байты лежат в PostgreSQL, отдельной таблицей `receipt_files`.
   * Если оно когда-нибудь сменится на S3 или диск, этот адрес не изменится —
   * ни схему, ни клиента трогать не придётся.
   */
  url: (parent) => `/api/receipts/${parent.id}`,

  extraction: (parent) => {
    const parsed = parseExtraction(parent.extraction);
    if (parsed === null) return null;

    return {
      paidAt: parsed.paidAt,
      amount: parsed.amountKopecks,
      payerHint: parsed.payerHint,
      confidence: parsed.confidence,
      notes: parsed.notes,
      provider: parsed.provider,
    };
  },
};
