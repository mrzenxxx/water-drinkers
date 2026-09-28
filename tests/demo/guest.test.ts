import { describe, expect, it } from 'vitest';

import {
  DEMO_GUESTS_PER_HOUR,
  DemoGuestLimitError,
  createDemoGuest,
  demoGuestIdentity,
  demoUrlFromEnv,
  isDemoMode,
} from '@/lib/demo/guest';
import { createFakeDb, dateColumn } from '../support/fake-prisma';

const CONFIG = {
  sessionSecret: 'demo-secret-demo-secret-demo-secret-42',
  appUrl: 'https://demo-puzyrik.example.sslip.io',
};
const NOW = new Date('2026-09-28T10:00:00.000Z');
const BYTES = Uint8Array.from([0x3f, 0xa9, 0x1c, 0x0e]);

describe('гость демо-версии', () => {
  it('получает логин и имя из случайных байтов', () => {
    expect(demoGuestIdentity(BYTES)).toEqual({
      login: 'demo-3fa91c0e',
      firstName: 'Демо',
      lastName: 'Гость 3FA9',
    });
  });

  it('заводится администратором, который не пьёт воду, и получает ссылку своего контура', async () => {
    const db = createFakeDb();
    db.now = NOW;

    const link = await createDemoGuest(db.client, CONFIG, NOW, BYTES);

    expect(link.startsWith(`${CONFIG.appUrl}/l/`)).toBe(true);
    const [guest] = db.tables.user.snapshot();
    expect(guest).toMatchObject({ login: 'demo-3fa91c0e', role: 'ADMIN' });
    // Полуинтервал [joinedAt, leftAt) пуст: в долях заказов гостя нет.
    expect(guest!.joinedAt).toEqual(dateColumn('2026-09-28'));
    expect(guest!.leftAt).toEqual(dateColumn('2026-09-28'));
    expect(guest!.passwordHash).not.toBeNull();
    expect(guest!.magicLinkHash).not.toBeNull();
    expect(db.tables.auditEntry.snapshot()).toEqual([
      expect.objectContaining({ action: 'demo.guest', actorId: null, entityId: guest!.id }),
    ]);
  });

  it('упирается в предел гостей за час, а старые гости в предел не входят', async () => {
    const db = createFakeDb();
    db.now = NOW;
    const recent = new Date(NOW.getTime() - 30 * 60 * 1000);
    const old = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
    db.tables.user.seed([
      ...Array.from({ length: DEMO_GUESTS_PER_HOUR - 1 }, (_, i) => ({
        login: `demo-r${i}`,
        joinedAt: dateColumn('2026-09-28'),
        createdAt: recent,
      })),
      { login: 'demo-old', joinedAt: dateColumn('2026-09-27'), createdAt: old },
      { login: 'e.kondobarov', joinedAt: dateColumn('2026-09-01'), createdAt: recent },
    ]);

    await createDemoGuest(db.client, CONFIG, NOW, BYTES);
    await expect(createDemoGuest(db.client, CONFIG, NOW, Uint8Array.from([1, 2, 3, 4]))).rejects.toBeInstanceOf(
      DemoGuestLimitError,
    );
  });
});

describe('переменные окружения демо', () => {
  it('включают режим демо только значением 1', () => {
    expect(isDemoMode({ DEMO_MODE: '1' })).toBe(true);
    expect(isDemoMode({ DEMO_MODE: 'true' })).toBe(false);
    expect(isDemoMode({})).toBe(false);
  });

  it('дают адрес демо без хвостового слэша или ничего', () => {
    expect(demoUrlFromEnv({ DEMO_URL: 'https://demo-puzyrik.x.sslip.io/ ' })).toBe(
      'https://demo-puzyrik.x.sslip.io',
    );
    expect(demoUrlFromEnv({ DEMO_URL: '  ' })).toBeNull();
    expect(demoUrlFromEnv({})).toBeNull();
  });
});
