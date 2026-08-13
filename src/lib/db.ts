import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

/**
 * Единственный экземпляр PrismaClient, создаваемый лениво.
 *
 * Ленивость здесь не оптимизация, а требование: `next build` обходит модули
 * маршрутов, и клиент, создаваемый на импорте, ронял бы сборку требованием
 * DATABASE_URL. Сборка не должна зависеть от живой базы.
 *
 * В dev-режиме Next.js перезагружает модули, поэтому клиент кладётся
 * в globalThis: иначе на каждой перезагрузке открывался бы новый пул.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client !== undefined) return client;

  if (globalForPrisma.prisma !== undefined) {
    client = globalForPrisma.prisma;
    return client;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

/**
 * Прокси, за которым прячется отложенное создание клиента. Снаружи
 * неотличим от обычного PrismaClient.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property) as unknown;

    // Методы клиента опираются на свой `this`, поэтому привязываем к экземпляру,
    // а не к прокси — иначе Prisma потеряет внутреннее состояние.
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
