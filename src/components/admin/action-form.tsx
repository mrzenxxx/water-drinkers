'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { IDLE, type ActionState } from '@/components/admin/action-state';
import { SubmitButton } from '@/components/admin/submit-button';
import type { ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Форма админ-панели: `<form action={серверное действие}>` + `useActionState`.
 *
 * Одна обёртка на все формы раздела. Поля приходят готовой разметкой из
 * серверного компонента — в бандл едет только эта обвязка, а не сами экраны.
 *
 * Ни `onSubmit` с `preventDefault`, ни ручного `fetch`, ни флага занятости:
 * всё это React 19 умеет сам (CLAUDE.md). Результат показывается текстом
 * с `role="status"` — цвет здесь не единственный носитель смысла (§12).
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
    <form action={formAction} className={cn('flex flex-col gap-3', className)}>
      {children}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
        {extraActions}
      </div>

      {state.status !== 'idle' && (
        <p
          role="status"
          className={cn(
            'text-sm',
            state.status === 'error' ? 'text-destructive' : 'text-credit',
          )}
        >
          <span aria-hidden="true">{state.status === 'error' ? '✕ ' : '✓ '}</span>
          {state.message}
        </p>
      )}
    </form>
  );
}
