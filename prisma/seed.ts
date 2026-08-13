import 'dotenv/config';

import { prisma } from '../src/lib/db';

/**
 * Наполнение базы: строка настроек фонда и первый администратор.
 *
 * Остальные участники заводятся администратором через `addParticipant`
 * (этап 3), а не здесь: состав команды меняется и в коде ему не место.
 *
 * Имя и фамилия намеренно не заполняются — человек вводит их сам при
 * первом входе (§7), приложение не выдумывает персональные данные.
 */
const ADMIN_EMAIL = 'e.kondobarov@sspk.spb.ru';

async function main(): Promise<void> {
  await prisma.fundSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      role: 'ADMIN',
      joinedAt: new Date(),
    },
  });

  console.info(`Администратор: ${admin.email} (${admin.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
