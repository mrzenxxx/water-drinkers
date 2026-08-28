import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';

/**
 * Выдача картинки объявления (§6.12).
 *
 * Адрес ведёт на приложение, а не на хранилище (`Announcement.image.url`):
 * байты сегодня лежат в базе, завтра могут переехать, и это не должно означать
 * правку схемы и клиента. Тем же соображением живёт `Receipt.url` (§8).
 *
 * Картинка не публична. Касса — внутреннее приложение, и снимок экрана с
 * фамилиями должников не должен открываться по ссылке кому угодно. Черновик
 * и архив видит только администратор — ровно как и в списке.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: {
      imageMediaType: true,
      publishedAt: true,
      archivedAt: true,
      updatedAt: true,
      image: { select: { bytes: true } },
    },
  });

  const bytes = announcement?.image?.bytes;
  if (announcement == null || announcement.imageMediaType === null || bytes == null) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Картинка не найдена.' } },
      { status: 404 },
    );
  }

  const hidden = announcement.publishedAt === null || announcement.archivedAt !== null;
  if (hidden && user.role !== 'ADMIN') {
    // Тот же ответ, что и у несуществующей: «есть, но не для тебя» — лишнее
    // знание о том, что администратор сейчас пишет.
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Картинка не найдена.' } },
      { status: 404 },
    );
  }

  /**
   * Метка версии — момент последней правки объявления: картинку меняет только
   * она. Браузер, у которого картинка уже есть, получит 304 и не потянет
   * мегабайт заново.
   */
  const etag = `"${announcement.updatedAt.getTime().toString(36)}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': announcement.imageMediaType,
      'Content-Length': String(bytes.byteLength),
      ETag: etag,
      // `private` — картинка принадлежит вошедшему, и общим кешам её не отдаём.
      // `must-revalidate` вместе с ETag: заменённая картинка обязана появиться
      // сразу, а не когда истечёт чужой срок хранения.
      'Cache-Control': 'private, max-age=0, must-revalidate',
      // Тип определён по сигнатуре файла при загрузке; запрещаем браузеру
      // угадывать его заново и наткнуться на что-то исполняемое.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
