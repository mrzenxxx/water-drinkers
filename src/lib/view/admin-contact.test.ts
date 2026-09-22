import { describe, expect, it } from 'vitest';

import { adminTelegramHref } from '@/lib/view/admin-contact';

describe('adminTelegramHref', () => {
  it('дописывает схему адресу без неё — иначе ссылка ведёт внутрь сайта', () => {
    expect(adminTelegramHref('t.me/ivanov')).toBe('https://t.me/ivanov');
  });

  it('оставляет полный адрес как есть', () => {
    expect(adminTelegramHref('https://t.me/ivanov')).toBe('https://t.me/ivanov');
    expect(adminTelegramHref('http://t.me/ivanov')).toBe('http://t.me/ivanov');
  });

  it('не спотыкается на пробелах вокруг значения', () => {
    expect(adminTelegramHref('  t.me/ivanov  ')).toBe('https://t.me/ivanov');
  });

  it('без переменной и на пустой строке кнопки нет', () => {
    expect(adminTelegramHref(undefined)).toBeNull();
    expect(adminTelegramHref('')).toBeNull();
    expect(adminTelegramHref('   ')).toBeNull();
  });

  it('отвергает всё, что не http и не https', () => {
    expect(adminTelegramHref('javascript:alert(1)')).toBeNull();
    expect(adminTelegramHref('tg://resolve?domain=ivanov')).toBeNull();
    expect(adminTelegramHref('data:text/html,<script>')).toBeNull();
  });
});
