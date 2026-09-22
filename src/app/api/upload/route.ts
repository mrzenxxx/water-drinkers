import { NextResponse } from 'next/server';

/**
 * Загрузка чеков идёт вне GraphQL (§10.3): POST /api/upload → fileId,
 * дальше fileId уходит в мутацию. Хранилище выбрано (§8.4, ADR-0003) и
 * загрузка сегодня работает через мутацию `uploadReceipt` в форме поставки
 * (§6.5). Этот отдельный эндпоинт понадобится на этапе 6, когда распознавание
 * начнёт работать до отправки формы — реализация отложена до тех пор.
 */
export function POST(): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Upload is implemented at stage 6' } },
    { status: 501 },
  );
}

export const runtime = 'nodejs';
