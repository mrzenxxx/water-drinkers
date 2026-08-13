import 'dotenv/config';

import { prisma } from '../src/lib/db';

/**
 * Наполнение базы. На этапе 0 создаётся только единственная строка настроек
 * фонда — участники, взносы и заказы появятся на этапах 2-4.
 */
async function main(): Promise<void> {
  await prisma.fundSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
