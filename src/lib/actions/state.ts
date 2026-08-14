/**
 * Состояние формы для `useActionState`.
 *
 * Отдельным файлом от `runtime.ts` не из любви к дроблению: `runtime.ts`
 * тянет контекст резолверов, а с ним Prisma и драйвер PostgreSQL. Клиентскому
 * компоненту нужно из всего этого одно начальное значение — импортируй он его
 * оттуда, сборка потащила бы серверный драйвер в браузерный бандл и упала бы
 * на `util/types`. Здесь нет ничего, кроме типов и трёх конструкторов.
 */

export type ActionState = {
  status: 'idle' | 'success' | 'error';
  /** Текст для человека. У успеха бывает пустым. */
  message: string | null;
  /** Код ошибки из `extensions.code` (§10.3) — экран может обработать частный случай. */
  code?: string;
};

export const IDLE: ActionState = { status: 'idle', message: null };

export function success(message: string | null = null): ActionState {
  return { status: 'success', message };
}

export function failure(message: string, code?: string): ActionState {
  return code === undefined ? { status: 'error', message } : { status: 'error', message, code };
}
