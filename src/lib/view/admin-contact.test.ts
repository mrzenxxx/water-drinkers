import { describe, expect, it } from 'vitest';

import { adminContactHref, adminContacts } from '@/lib/view/admin-contact';

describe('adminContactHref', () => {
  it('дописывает схему адресу без неё — иначе ссылка ведёт внутрь сайта', () => {
    expect(adminContactHref('t.me/ivanov')).toBe('https://t.me/ivanov');
    expect(adminContactHref('max.ru/ivanov')).toBe('https://max.ru/ivanov');
  });

  it('оставляет полный адрес как есть', () => {
    expect(adminContactHref('https://t.me/ivanov')).toBe('https://t.me/ivanov');
    expect(adminContactHref('http://t.me/ivanov')).toBe('http://t.me/ivanov');
  });

  it('не спотыкается на пробелах вокруг значения', () => {
    expect(adminContactHref('  t.me/ivanov  ')).toBe('https://t.me/ivanov');
  });

  it('без переменной и на пустой строке ссылки нет', () => {
    expect(adminContactHref(undefined)).toBeNull();
    expect(adminContactHref('')).toBeNull();
    expect(adminContactHref('   ')).toBeNull();
  });

  it('отвергает всё, что не http и не https', () => {
    expect(adminContactHref('javascript:alert(1)')).toBeNull();
    expect(adminContactHref('tg://resolve?domain=ivanov')).toBeNull();
    expect(adminContactHref('max://profile/ivanov')).toBeNull();
    expect(adminContactHref('data:text/html,<script>')).toBeNull();
  });
});

describe('adminContacts', () => {
  it('показывает оба мессенджера в одном порядке: Telegram, затем MAX', () => {
    expect(adminContacts({ telegram: 't.me/ivanov', max: 'max.ru/ivanov' })).toEqual([
      { id: 'telegram', label: 'Telegram', href: 'https://t.me/ivanov' },
      { id: 'max', label: 'MAX', href: 'https://max.ru/ivanov' },
    ]);
  });

  it('обходится одним, если задан только он', () => {
    expect(adminContacts({ telegram: 't.me/ivanov', max: undefined })).toEqual([
      { id: 'telegram', label: 'Telegram', href: 'https://t.me/ivanov' },
    ]);
    expect(adminContacts({ telegram: undefined, max: 'max.ru/ivanov' })).toEqual([
      { id: 'max', label: 'MAX', href: 'https://max.ru/ivanov' },
    ]);
  });

  it('без переменных список пуст — звать некуда', () => {
    expect(adminContacts({ telegram: undefined, max: undefined })).toEqual([]);
  });

  it('негодный адрес выпадает, годный рядом остаётся', () => {
    expect(adminContacts({ telegram: 'javascript:alert(1)', max: 'max.ru/ivanov' })).toEqual([
      { id: 'max', label: 'MAX', href: 'https://max.ru/ivanov' },
    ]);
  });
});
