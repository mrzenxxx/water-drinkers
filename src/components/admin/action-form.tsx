'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { IDLE, type ActionState } from '@/components/admin/action-state';
import { SubmitButton } from '@/components/admin/submit-button';
import type { ButtonProps } from '@/components/ui/button';
import { Form, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

/**
 * Форма админ-панели: `<form action={серверное действие}>` + `useActionState`.
 *
 * Одна обёртка на все формы раздела. Поля приходят готовой разметкой из
 * серверного компонента — в бандл едет только эта обвязка, а не сами экраны.
 *
 * Ни `onSubmit` с `preventDefault`, ни ручного `fetch`, ни флага занятости:
 * всё это React 19 умеет сам (CLAUDE.md). Проверку полей, пузырьки ошибок и
 * возврат набранного после отказа сервера берёт на себя `Form`. Результат —
 * пузырёк со значком и словами: цвет здесь не единственный носитель смысла (§12).
 */
export type ActionFormProps = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  /** Дополнительные кнопки отправки — например, «Распределить поровну» (§4.2). */
  extraActions?: ReactNode;
};

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant,
  size,
  className,
  extraActions,
}: ActionFormProps): ReactNode {
  const [state, formAction] = useActionState(action, IDLE);

  return (
    <Form action={formAction} state={state} className={cn('flex flex-col gap-3', className)}>
      {children}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
        {extraActions}
      </div>

      {state.status !== 'idle' && state.message !== '' && (
        <FormMessage tone={state.status === 'error' ? 'error' : 'success'}>{state.message}</FormMessage>
      )}
    </Form>
  );
}
