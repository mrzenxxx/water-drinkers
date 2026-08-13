import { describe, expect, it } from 'vitest';

import { decideAccess, isAllowedDomain, isValidEmail, splitEmail } from '@/lib/auth/whitelist';

const DOMAIN = 'sspk.spb.ru';
const PARTICIPANTS = ['e.kondobarov@sspk.spb.ru', 'i.petrov@sspk.spb.ru'];

describe('splitEmail', () => {
  it('разбирает обычный адрес', () => {
    expect(splitEmail('E.Kondobarov@SSPK.spb.ru')).toEqual({
      local: 'e.kondobarov',
      domain: 'sspk.spb.ru',
    });
  });

  it('отвергает мусор', () => {
    for (const bad of ['', 'нет-собаки', 'a@b', 'два@@сразу.ru', 'с пробелом@sspk.spb.ru', '@sspk.spb.ru']) {
      expect(splitEmail(bad), bad).toBeNull();
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe('isAllowedDomain', () => {
  it('не путается в регистре и пробелах', () => {
    expect(isAllowedDomain('  E.Kondobarov@SSPK.SPB.RU  ', DOMAIN)).toBe(true);
  });

  it('не принимает поддомен и похожий домен', () => {
    expect(isAllowedDomain('a@mail.sspk.spb.ru', DOMAIN)).toBe(false);
    expect(isAllowedDomain('a@sspk.spb.ru.evil.com', DOMAIN)).toBe(false);
    expect(isAllowedDomain('a@sspkspb.ru', DOMAIN)).toBe(false);
  });
});

describe('decideAccess', () => {
  it('пускает участника из рабочего домена', () => {
    expect(decideAccess('E.Kondobarov@sspk.spb.ru', DOMAIN, PARTICIPANTS)).toEqual({
      allowed: true,
      email: 'e.kondobarov@sspk.spb.ru',
    });
  });

  it('не пускает чужой домен', () => {
    expect(decideAccess('e.kondobarov@gmail.com', DOMAIN, PARTICIPANTS)).toEqual({
      allowed: false,
      reason: 'foreign_domain',
    });
  });

  it('не пускает сотрудника, который не в списке участников', () => {
    expect(decideAccess('someone.else@sspk.spb.ru', DOMAIN, PARTICIPANTS)).toEqual({
      allowed: false,
      reason: 'not_a_participant',
    });
  });

  it('домена мало: он проверяется вместе со списком, а не вместо него', () => {
    // Именно этот случай отличает «вход по домену» от «входа по списку».
    const insider = 'director@sspk.spb.ru';
    expect(isAllowedDomain(insider, DOMAIN)).toBe(true);
    expect(decideAccess(insider, DOMAIN, PARTICIPANTS).allowed).toBe(false);
  });

  it('пускает бывшего участника — он должен видеть свой остаток', () => {
    expect(decideAccess('i.petrov@sspk.spb.ru', DOMAIN, PARTICIPANTS).allowed).toBe(true);
  });

  it('отвергает мусорный адрес до всех прочих проверок', () => {
    expect(decideAccess('не-адрес', DOMAIN, PARTICIPANTS)).toEqual({
      allowed: false,
      reason: 'invalid_email',
    });
  });
});
