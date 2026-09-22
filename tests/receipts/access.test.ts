import { describe, expect, it } from 'vitest';

import { canViewReceipt } from '@/lib/receipts/access';

/** Кому виден чек (§8.4). Чистое правило: ни базы, ни запроса. */

const ADMIN = { id: 'u-admin', role: 'ADMIN' };
const AUTHOR = { id: 'u-1', role: 'PARTICIPANT' };
const STRANGER = { id: 'u-2', role: 'PARTICIPANT' };

const NOTHING = { orderIds: [], contributionUserIds: [] };

describe('видимость чека', () => {
  it('чек заказа открыт любому участнику: деньги ушли из общего фонда', () => {
    const links = { orderIds: ['o-1'], contributionUserIds: [] };
    expect(canViewReceipt(links, STRANGER)).toBe(true);
    expect(canViewReceipt(links, ADMIN)).toBe(true);
  });

  it('чек взноса виден его автору', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, AUTHOR)).toBe(true);
  });

  it('чужой чек взноса участнику не виден', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, STRANGER)).toBe(false);
  });

  it('чужой чек взноса виден администратору: он его и проверяет', () => {
    const links = { orderIds: [], contributionUserIds: ['u-1'] };
    expect(canViewReceipt(links, ADMIN)).toBe(true);
  });

  it('ни к чему не привязанный чек не виден никому, включая администратора', () => {
    // Это мусор незавершённой отправки, а не документ.
    expect(canViewReceipt(NOTHING, ADMIN)).toBe(false);
    expect(canViewReceipt(NOTHING, AUTHOR)).toBe(false);
  });
});
