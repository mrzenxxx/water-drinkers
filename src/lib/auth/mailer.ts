/**
 * Отправка писем — провайдер-агностичный слой, как `ReceiptExtractor` в §8.1.
 *
 * Приложение знает интерфейс, а не провайдера: почтовый сервис ещё не выбран
 * (открытый вопрос №4), и выбор не должен потребовать правок выше этой папки.
 */

export type Letter = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  readonly id: string;
  send(letter: Letter): Promise<void>;
}

/**
 * Локальная разработка: код печатается в лог вместо отправки.
 * Годится только для разработки — в продакшене код в логах это утечка.
 */
export const consoleMailer: Mailer = {
  id: 'console',

  async send(letter) {
    console.info(`\n─── письмо ─────────────────\nКому:  ${letter.to}\nТема:  ${letter.subject}\n\n${letter.text}\n────────────────────────────\n`);
  },
};

/**
 * SMTP появится, когда будет выбран провайдер. Пока честно падаем:
 * молчаливая заглушка в проде означала бы, что человек ждёт письмо,
 * которое никогда не придёт.
 */
export const smtpMailer: Mailer = {
  id: 'smtp',

  async send() {
    throw new Error(
      'SMTP mailer is not configured yet (open question 4). Set MAIL_PROVIDER=console for local development.',
    );
  },
};

export function createMailer(provider: string | undefined): Mailer {
  switch (provider) {
    case 'smtp':
      return smtpMailer;
    case 'console':
    case undefined:
    case '':
      return consoleMailer;
    default:
      throw new Error(`Unknown MAIL_PROVIDER "${provider}". Expected "console" or "smtp".`);
  }
}

export function loginCodeLetter(to: string, code: string): Letter {
  return {
    to,
    subject: `Код входа в WaterDrinkers: ${code}`,
    text: [
      `Код для входа: ${code}`,
      '',
      'Код действует 10 минут и вводится один раз.',
      'Если вы не запрашивали вход — просто не вводите его, ничего делать не нужно.',
    ].join('\n'),
  };
}
