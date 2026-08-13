import { NextResponse } from 'next/server';

/**
 * Загрузка чеков идёт вне GraphQL (§10.3): POST /api/upload → fileId,
 * дальше fileId уходит в мутацию. Реализация — этап 6, вместе с хранилищем
 * чеков (открытый вопрос №6 в docs/SPEC.md §16).
 */
export function POST(): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Upload is implemented at stage 6' } },
    { status: 501 },
  );
}

export const runtime = 'nodejs';
