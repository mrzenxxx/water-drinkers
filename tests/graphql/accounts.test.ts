import { describe, expect, it } from 'vitest';

import { MAX_FAILED_LOGINS, hashPassword, loginWithMagicLink, readSession } from '@/lib/auth';

import { TEST_CONFIG, errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

/**
 * Учётные записи (§3, §7, ADR-0004): вход по логину и паролю, магическая
 * ссылка, отзыв сессий, мьют, бан и лимит на записи участника.
 */

const LOGIN = `
  mutation ($login: String!, $password: String!) {
    login(login: $login, password: $password) { needsProfile user { id login } }
  }
`;

const ISSUE = `
  mutation ($id: ID!, $login: String!, $password: String!) {
    issueCredentials(id: $id, login: $login, password: $password) {
      user { id login }
      credentials { login password magicLinkUrl }
    }
  }
`;

const SUGGEST = `
  query ($firstName: String!, $middleName: String, $lastName: String!, $excludeUserId: ID) {
    suggestCredentials(firstName: $firstName, middleName: $middleName, lastName: $lastName, excludeUserId: $excludeUserId) {
      login password
    }
  }
`;

const RESTRICT = `
  mutation ($id: ID!, $restriction: Restriction!) {
    setParticipantRestriction(id: $id, restriction: $restriction) { id restriction }
  }
`;

const SET_ROLE = `mutation ($id: ID!, $role: Role!) { setParticipantRole(id: $id, role: $role) { id role } }`;
const UPDATE = `
  mutation ($id: ID!, $input: ParticipantProfileInput!) {
    updateParticipant(id: $id, input: $input) { id login firstName middleName lastName department { name } }
  }
`;

const ME = `query { me { id } fund { balance } }`;
const SUBMIT = `mutation ($amount: Money!, $paidAt: Date!) { submitContribution(amount: $amount, paidAt: $paidAt) { id } }`;
const ADD_ABSENCE = `
  mutation ($type: AbsenceType!, $startsOn: Date!, $endsOn: Date!) {
    addAbsence(type: $type, startsOn: $startsOn, endsOn: $endsOn) { id }
  }
`;

async function withPassword(db: ReturnType<typeof seedOffice>, userId: string, password: string) {
  const hash = await hashPassword(password);
  const row = db.tables.user.rows.find((user) => user.id === userId);
  if (row === undefined) throw new Error(`нет участника ${userId}`);
  row.passwordHash = hash;
}

function cookieJar() {
  const jar: { token: string | null } = { token: null };
  return { jar, setSessionCookie: async (token: string) => void (jar.token = token) };
}

describe('вход по логину и паролю', () => {
  it('верный пароль выдаёт сессию, логин без учёта регистра и пробелов', async () => {
    const db = seedOffice();
    await withPassword(db, 'u-0', 'correct-horse');
    const { jar, setSessionCookie } = cookieJar();

    const data = await runOk(LOGIN, {
      db: db.client,
      setSessionCookie,
      variables: { login: ' P0 ', password: 'correct-horse' },
    });

    expect(data.login).toMatchObject({ needsProfile: false, user: { id: 'u-0', login: 'p0' } });
    expect(readSession(jar.token ?? undefined, TEST_CONFIG.sessionSecret, new Date())?.uid).toBe('u-0');
  });

  it('неверный пароль, чужой логин и невыданный пароль неразличимы', async () => {
    const db = seedOffice();
    await withPassword(db, 'u-0', 'correct-horse');

    const attempts = [
      { login: 'p0', password: 'wrong-horse' },
      { login: 'nobody', password: 'correct-horse' },
      { login: 'p1', password: 'correct-horse' },
    ];
    const messages = new Set<string>();
    for (const variables of attempts) {
      const result = await run(LOGIN, { db: db.client, variables });
      expect(errorCode(result)).toBe('INVALID_CREDENTIALS');
      messages.add(result.errors?.[0]?.message ?? '');
    }
    expect(messages.size).toBe(1);
  });

  it(`после ${MAX_FAILED_LOGINS} неудач подряд вход блокируется даже с верным паролем`, async () => {
    const db = seedOffice();
    await withPassword(db, 'u-0', 'correct-horse');

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await run(LOGIN, { db: db.client, variables: { login: 'p0', password: 'wrong' } });
    }
    const locked = await run(LOGIN, { db: db.client, variables: { login: 'p0', password: 'correct-horse' } });
    expect(locked.errors?.[0]?.extensions?.reason).toBe('locked');
  });

  it('бан сообщается только после верного пароля', async () => {
    const db = seedOffice();
    await withPassword(db, 'u-0', 'correct-horse');
    db.tables.user.rows.find((row) => row.id === 'u-0')!.restriction = 'BANNED';

    const wrong = await run(LOGIN, { db: db.client, variables: { login: 'p0', password: 'wrong' } });
    expect(wrong.errors?.[0]?.extensions?.reason).toBe('invalid');

    const right = await run(LOGIN, { db: db.client, variables: { login: 'p0', password: 'correct-horse' } });
    expect(right.errors?.[0]?.extensions?.reason).toBe('banned');
  });
});

describe('выдача учётных данных', () => {
  it('предлагает свободный логин из ФИО, свой логин при перевыпуске не считается занятым', async () => {
    const db = seedOffice();

    const fresh = await runOk(SUGGEST, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { firstName: 'Евгений', lastName: 'Кондобаров' },
    });
    expect((fresh.suggestCredentials as { login: string }).login).toBe('e.kondobarov2');

    const own = await runOk(SUGGEST, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { firstName: 'Евгений', lastName: 'Кондобаров', excludeUserId: ADMIN_ID },
    });
    const suggestion = own.suggestCredentials as { login: string; password: string };
    expect(suggestion.login).toBe('e.kondobarov');
    expect(suggestion.password).toHaveLength(12);

    // Предложение ничего не записывает.
    expect(db.tables.auditEntry.rows).toHaveLength(0);
  });

  it('предложение доступно только администратору', async () => {
    const db = seedOffice();
    const result = await run(SUGGEST, {
      db: db.client,
      userId: 'u-0',
      variables: { firstName: 'Иван', lastName: 'Иванов' },
    });
    expect(errorCode(result)).toBe('FORBIDDEN');
  });

  it('перевыпуск отзывает прежние сессии, пароль и ссылку', async () => {
    const db = seedOffice();
    const before = Date.now() - 1000;

    const first = await runOk(ISSUE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', login: 'p0-login', password: 'first-password' },
    });
    const firstLink = (first.issueCredentials as { credentials: { magicLinkUrl: string } }).credentials.magicLinkUrl;

    const old = await run(ME, { db: db.client, userId: 'u-0', sessionIssuedAt: before });
    expect(errorCode(old)).toBe('UNAUTHENTICATED');

    await runOk(ISSUE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', login: 'i.petrov', password: 'second-password' },
    });

    const token = firstLink.split('/l/')[1]!;
    expect((await loginWithMagicLink(db.client, TEST_CONFIG, token)).ok).toBe(false);

    const oldPassword = await run(LOGIN, { db: db.client, variables: { login: 'i.petrov', password: 'first-password' } });
    expect(errorCode(oldPassword)).toBe('INVALID_CREDENTIALS');
    await runOk(LOGIN, { db: db.client, variables: { login: 'i.petrov', password: 'second-password' } });

    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'participant.credentials',
      'participant.credentials',
    ]);
  });

  it('магическая ссылка входит до срока и многоразовая', async () => {
    const db = seedOffice();
    const issued = await runOk(ISSUE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', login: 'p0-login', password: 'first-password' },
    });
    const token = (issued.issueCredentials as { credentials: { magicLinkUrl: string } }).credentials.magicLinkUrl.split(
      '/l/',
    )[1]!;

    expect((await loginWithMagicLink(db.client, TEST_CONFIG, token)).ok).toBe(true);
    expect((await loginWithMagicLink(db.client, TEST_CONFIG, token)).ok).toBe(true);
    expect((await loginWithMagicLink(db.client, TEST_CONFIG, `${token}x`)).ok).toBe(false);

    const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect((await loginWithMagicLink(db.client, TEST_CONFIG, token, later)).ok).toBe(false);
  });

  it('правка ФИО и отдела не меняет логин', async () => {
    const db = seedOffice();
    const data = await runOk(UPDATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        id: 'u-0',
        input: { firstName: 'Пётр', middleName: 'Ильич', lastName: 'Смирнов', newDepartment: 'Склад' },
      },
    });
    expect(data.updateParticipant).toMatchObject({
      login: 'p0',
      firstName: 'Пётр',
      middleName: 'Ильич',
      lastName: 'Смирнов',
      department: { name: 'Склад' },
    });
  });
});

describe('мьют и бан (§3)', () => {
  it('мьют закрывает записи, но не чтение', async () => {
    const db = seedOffice();
    await runOk(RESTRICT, { db: db.client, userId: ADMIN_ID, variables: { id: 'u-0', restriction: 'MUTED' } });

    await runOk(ME, { db: db.client, userId: 'u-0' });

    const contribution = await run(SUBMIT, {
      db: db.client,
      userId: 'u-0',
      variables: { amount: 50_000, paidAt: '2026-06-10' },
    });
    expect(errorCode(contribution)).toBe('MUTED');

    const absence = await run(ADD_ABSENCE, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'VACATION', startsOn: '2026-06-10', endsOn: '2026-06-12' },
    });
    expect(errorCode(absence)).toBe('MUTED');
    expect(db.tables.contribution.rows).toHaveLength(0);
    expect(db.tables.absence.rows).toHaveLength(0);
  });

  it('бан отзывает открытую сессию', async () => {
    const db = seedOffice();
    await runOk(RESTRICT, { db: db.client, userId: ADMIN_ID, variables: { id: 'u-0', restriction: 'BANNED' } });

    const result = await run(ME, { db: db.client, userId: 'u-0', sessionIssuedAt: Date.now() + 60_000 });
    expect(errorCode(result)).toBe('UNAUTHENTICATED');
  });

  it('администратора не ограничить, ограниченного не назначить администратором', async () => {
    const db = seedOffice();

    const admin = await run(RESTRICT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: ADMIN_ID, restriction: 'MUTED' },
    });
    expect(errorCode(admin)).toBe('CONFLICT');

    await runOk(RESTRICT, { db: db.client, userId: ADMIN_ID, variables: { id: 'u-0', restriction: 'MUTED' } });
    const promote = await run(SET_ROLE, { db: db.client, userId: ADMIN_ID, variables: { id: 'u-0', role: 'ADMIN' } });
    expect(errorCode(promote)).toBe('CONFLICT');
  });

  it('ограничивает только администратор', async () => {
    const db = seedOffice();
    const result = await run(RESTRICT, { db: db.client, userId: 'u-1', variables: { id: 'u-0', restriction: 'BANNED' } });
    expect(errorCode(result)).toBe('FORBIDDEN');
  });
});

describe('лимит записей участника', () => {
  function auditAt(db: ReturnType<typeof seedOffice>, actorId: string, action: string, minutesAgo: number) {
    db.tables.auditEntry.seed([
      { actorId, action, entity: 'contribution', createdAt: new Date(Date.now() - minutesAgo * 60_000) },
    ]);
  }

  it('на взносы лимит по времени не действует: их держит правило «один на рассмотрении»', async () => {
    const db = seedOffice();
    auditAt(db, 'u-0', 'contribution.submit', 20);
    auditAt(db, 'u-0', 'contribution.submit', 40);

    await runOk(SUBMIT, { db: db.client, userId: 'u-0', variables: { amount: 50_000, paidAt: '2026-06-10' } });
  });

  it('третий за сутки отвергается, даже если последний был больше часа назад', async () => {
    const db = seedOffice();
    auditAt(db, 'u-0', 'absence.add', 300);
    auditAt(db, 'u-0', 'absence.add', 120);

    const result = await run(ADD_ABSENCE, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'VACATION', startsOn: '2026-06-10', endsOn: '2026-06-12' },
    });
    expect(errorCode(result)).toBe('RATE_LIMITED');
  });

  it('лимит отдельный по видам записей и не касается чужих и админских', async () => {
    const db = seedOffice();
    auditAt(db, 'u-0', 'absence.add', 10);
    auditAt(db, 'u-1', 'contribution.submit', 10);
    auditAt(db, ADMIN_ID, 'contribution.submit.for', 5);

    await runOk(SUBMIT, { db: db.client, userId: 'u-0', variables: { amount: 50_000, paidAt: '2026-06-10' } });

    auditAt(db, ADMIN_ID, 'contribution.submit', 10);
    await runOk(SUBMIT, { db: db.client, userId: ADMIN_ID, variables: { amount: 50_000, paidAt: '2026-06-10' } });
  });
});
