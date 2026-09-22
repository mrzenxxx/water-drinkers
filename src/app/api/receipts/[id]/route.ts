import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';
import { canViewReceipt } from '@/lib/receipts/access';

/**
 * Выдача файла чека (§8.4).
 *
 * Адрес ведёт на приложение, а не на хранилище (`Receipt.url`): байты сегодня
 * лежат в базе, завтра могут переехать (ADR-0003), и это не должно означать
 * правку схемы и клиента. Тем же устроена картинка объявления (§6.12).
 *
 * Чек не публичен. Касса — внутреннее приложение, и квитанция с фамилией и
 * суммой не должна открываться по ссылке кому угодно: кто именно её видит,
 * решает чистое правило `canViewReceipt`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `Receipt.id` в базе — `UUID` (`prisma/schema.prisma`). Адрес вида
 * `/api/receipts/foo` до колонки такого типа не проверяется Prisma — она
 * бросает ошибку разбора значения, и без проверки формата здесь это выглядело
 * бы как 500, хотя по смыслу это тот же самый «не найдено», что и у чужого
 * или отсутствующего чека.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Расширение для имени файла при сохранении. */
const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (user === null) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Требуется вход.' } },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Тот же ответ и у несуществующего, и у чужого, и у неправильно оформленного
  // адреса: «есть, но не для тебя» — лишнее знание о чужих взносах.
  const missing = NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Чек не найден.' } },
    { status: 404 },
  );

  if (!UUID.test(id)) return missing;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      mediaType: true,
      createdAt: true,
      file: { select: { bytes: true } },
      waterOrders: { select: { id: true } },
      contributions: { select: { userId: true } },
    },
  });

  const bytes = receipt?.file?.bytes;
  if (receipt == null || bytes == null) return missing;

  const visible = canViewReceipt(
    {
      orderIds: receipt.waterOrders.map((order) => order.id),
      contributionUserIds: receipt.contributions.map((contribution) => contribution.userId),
    },
    user,
  );
  if (!visible) return missing;

  // Файл чека неизменяем: метка версии — момент его создания.
  const etag = `"${receipt.createdAt.getTime().toString(36)}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const download = new URL(request.url).searchParams.get('download') === '1';
  const name = `receipt-${receipt.createdAt.toISOString().slice(0, 10)}.${EXTENSION[receipt.mediaType] ?? 'bin'}`;

  const headers: Record<string, string> = {
    'Content-Type': receipt.mediaType,
    'Content-Length': String(bytes.byteLength),
    ETag: etag,
    // `private` — чек принадлежит вошедшему, общим кешам его не отдаём.
    'Cache-Control': 'private, max-age=0, must-revalidate',
    // Тип определён по сигнатуре при загрузке; запрещаем браузеру угадывать
    // его заново и наткнуться на что-то исполняемое.
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': download ? `attachment; filename="${name}"` : 'inline',
  };

  // Встроенный просмотрщик PDF умеет исполнять JavaScript из документа,
  // а документ отдаётся со своего домена — поэтому песочница (§8.4).
  if (receipt.mediaType === 'application/pdf') {
    headers['Content-Security-Policy'] = 'sandbox';
  }

  return new Response(new Uint8Array(bytes), { headers });
}
