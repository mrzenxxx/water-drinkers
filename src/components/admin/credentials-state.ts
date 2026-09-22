/**
 * Состояние форм, выдающих учётные данные: «Добавить участника» и «Новые
 * учётные данные» у существующего.
 *
 * Обе формы работают в два шага в одном `<form>`: кнопка «Сгенерировать»
 * заполняет логин и пароль, администратор их при желании правит, и только
 * «Создать» / «Сохранить» что-то записывает. После записи форма показывает
 * карточку с данными и кнопкой «Скопировать».
 *
 * React 19 сбрасывает неуправляемые поля формы после каждого действия.
 * Поэтому введённое возвращается в `values`, а поля берут `defaultValue`
 * оттуда; `version` меняется с каждым ответом и пересоздаёт поля — иначе
 * `defaultValue` не перечитался бы.
 */

export type IssuedCredentialsView = {
  login: string;
  password: string;
  magicLinkUrl: string;
  magicLinkExpiresAt: string;
};

export type CredentialsFormState = {
  status: 'idle' | 'suggested' | 'issued' | 'error';
  message: string;
  /** Поле, к которому относится ошибка: подсвечивается у него. */
  field: string | null;
  values: Record<string, string>;
  credentials: IssuedCredentialsView | null;
  version: number;
};

export const CREDENTIALS_IDLE: CredentialsFormState = {
  status: 'idle',
  message: '',
  field: null,
  values: {},
  credentials: null,
  version: 0,
};

/** Текст для пересылки человеку — ровно то, что кладёт в буфер «Скопировать». */
export function credentialsMessage(credentials: IssuedCredentialsView): string {
  return [
    `Логин: ${credentials.login}`,
    `Пароль: ${credentials.password}`,
    `Вход по ссылке, без пароля: ${credentials.magicLinkUrl}`,
  ].join('\n');
}
