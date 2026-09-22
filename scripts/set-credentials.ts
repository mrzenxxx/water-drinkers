/**
 * Новый пароль и магическая ссылка для участника — из командной строки.
 *
 *   npm run credentials -- e.kondobarov
 *
 * Нужен ровно для одного случая: первому администратору. Всем остальным
 * учётные данные выдаёт администратор в панели, но самому себе без входа
 * он их не выдаст. Прежние входы участника отзываются, как и из панели.
 */

import 'dotenv/config';

import { authConfigFromEnv, credentialFields, generatePassword, normalizeLogin } from '@/lib/auth';
import { writeAudit } from '@/lib/data/audit';
import { prisma } from '@/lib/db';

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (raw === undefined || raw.trim() === '') {
    throw new Error('Укажите логин: npm run credentials -- e.kondobarov');
  }

  const login = normalizeLogin(raw);
  const user = await prisma.user.findUnique({ where: { login } });
  if (user === null) throw new Error(`Участника с логином «${login}» нет. Выполните db:seed.`);

  const now = new Date();
  const { data, credentials } = await credentialFields(authConfigFromEnv(), login, generatePassword(), now);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data });
    await writeAudit(tx, {
      actorId: null,
      action: 'participant.credentials',
      entity: 'user',
      entityId: user.id,
      before: { login },
      after: { login },
    });
  });

  console.info(`Логин:  ${credentials.login}`);
  console.info(`Пароль: ${credentials.password}`);
  console.info(`Ссылка: ${credentials.magicLinkUrl}`);
  console.info(`Ссылка действует до ${credentials.magicLinkExpiresAt.toLocaleString('ru-RU')}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
