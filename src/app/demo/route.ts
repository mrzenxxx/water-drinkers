import { authConfigFromEnv } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DemoGuestLimitError, createDemoGuest, isDemoMode } from '@/lib/demo/guest';

/**
 * «Смотреть демо-версию»: форма на странице входа прода и теста шлёт сюда
 * POST, демо-контур заводит гостя-администратора и уводит на его магическую
 * ссылку (src/lib/demo/guest.ts).
 *
 * Только POST: по GET гостей плодили бы поисковые роботы и превью ссылок в
 * мессенджерах. Форма приходит с чужого поддомена, поэтому это обработчик
 * маршрута, а не серверное действие — у действий Next сверяет Origin.
 * Вне демо-контура маршрута как будто нет.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  if (!isDemoMode()) return new Response(null, { status: 404 });

  try {
    const link = await createDemoGuest(prisma, authConfigFromEnv());
    // 303: после POST браузер идёт по ссылке обычным GET.
    return Response.redirect(link, 303);
  } catch (error) {
    if (error instanceof DemoGuestLimitError) {
      return new Response(error.message, {
        status: 429,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '3600' },
      });
    }
    throw error;
  }
}
