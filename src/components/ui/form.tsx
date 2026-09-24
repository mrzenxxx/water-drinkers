'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';
import { validityMessage } from '@/lib/view/validity';

/**
 * Форма приложения: обычный `<form action>` плюс три вещи, которых у него нет.
 *
 * **Свои слова вместо окошка браузера.** Проверку `required`, `type="email"`,
 * `max` по-прежнему делает браузер — отправку с пустым обязательным полем он
 * не пропустит и без нас. Мы гасим только его всплывающее окошко (событие
 * `invalid` отменяемо) и показываем ошибку пузырьком под полем, своими
 * словами (`validityMessage`). Слушатель стоит на фазе перехвата: `invalid`
 * не всплывает, и до формы иначе не доходит.
 *
 * **Введённое не пропадает после отказа.** React 19 после любого действия
 * формы сбрасывает её поля, и отказ сервера — тоже «действие закончилось».
 * Человек, ошибившийся в одной цифре, терял всё набранное. Форма запоминает
 * отправленный `FormData` и, если ответ — ошибка, возвращает значения в поля,
 * включая выбранные файлы (через `DataTransfer`). Сброс после успеха остаётся:
 * там пустая форма и есть знак «принято».
 *
 * **Ошибка сервера у своего поля.** Если сервер знает, какое поле виновато
 * (`fieldError`), пузырёк встаёт под этим полем, а фокус переходит в него.
 *
 * Ни `onSubmit` с `preventDefault`, ни ручного `fetch` (CLAUDE.md): отправку
 * по-прежнему ведёт React. Обработчик `submit` здесь только стирает старые
 * пузырьки, ничего не отменяя.
 */

type FieldErrors = ReadonlyMap<string, string>;

const FieldErrorsContext = createContext<FieldErrors>(new Map());

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isControl(target: EventTarget | null): target is Control {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

/** Ключ ошибки — `id` поля: по нему её находит подпись (`Field htmlFor`). */
function keyOf(control: Control): string {
  return control.id || control.name;
}

function errorId(key: string): string {
  return `${key}-error`;
}

/**
 * Пометить поле ошибочным для читалки экрана. Атрибуты ставятся прямо на
 * элемент: поле могло прийти готовой разметкой из серверного компонента, и
 * протянуть в него проп отсюда нельзя.
 */
function markInvalid(control: Control, invalid: boolean): void {
  const id = errorId(keyOf(control));
  const described = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const rest = described.filter((item) => item !== id);

  if (invalid) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', [id, ...rest].join(' '));
  } else {
    control.removeAttribute('aria-invalid');
    if (rest.length > 0) control.setAttribute('aria-describedby', rest.join(' '));
    else control.removeAttribute('aria-describedby');
  }
}

function messageFor(control: Control): string {
  const validity = control.validity;
  return validityMessage(
    {
      valueMissing: validity.valueMissing,
      typeMismatch: validity.typeMismatch,
      patternMismatch: validity.patternMismatch,
      tooLong: validity.tooLong,
      tooShort: validity.tooShort,
      rangeUnderflow: validity.rangeUnderflow,
      rangeOverflow: validity.rangeOverflow,
      stepMismatch: validity.stepMismatch,
      badInput: validity.badInput,
      customError: validity.customError,
    },
    {
      tag: control.tagName.toLowerCase(),
      type: control instanceof HTMLInputElement ? control.type : '',
      min: control instanceof HTMLInputElement ? control.min : '',
      max: control instanceof HTMLInputElement ? control.max : '',
      minLength: control instanceof HTMLSelectElement ? -1 : control.minLength,
      maxLength: control instanceof HTMLSelectElement ? -1 : control.maxLength,
      customMessage: control.dataset.error ?? null,
      browserMessage: control.validationMessage,
    },
  );
}

const SKIPPED_INPUTS = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/**
 * Вернуть в поля то, что было отправлено.
 *
 * Скрытые поля не трогаем: их значения задаёт разметка, и после ответа
 * сервера они могли законно поменяться. Выключенные — тоже: в отправку они
 * не попадали, значит и возвращать нечего.
 */
function restoreValues(form: HTMLFormElement, data: FormData): void {
  for (const element of Array.from(form.elements)) {
    if (!isControl(element) || element.name === '' || element.disabled) continue;
    const values = data.getAll(element.name);

    if (element instanceof HTMLInputElement) {
      if (SKIPPED_INPUTS.has(element.type)) continue;

      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = values.includes(element.value);
        continue;
      }

      if (element.type === 'file') {
        // Пустое поле файла приходит в `FormData` безымянным файлом нулевого размера.
        const files = values.filter((value): value is File => value instanceof File && value.name !== '');
        if (files.length === 0) continue;
        const transfer = new DataTransfer();
        for (const file of files) transfer.items.add(file);
        element.files = transfer.files;
        continue;
      }
    }

    if (element instanceof HTMLSelectElement && element.multiple) {
      for (const option of Array.from(element.options)) option.selected = values.includes(option.value);
      continue;
    }

    const value = values[0];
    if (typeof value === 'string') element.value = value;
  }
}

export type FormFeedback = {
  status: string;
};

type FormProps = Omit<ComponentProps<'form'>, 'action'> & {
  action?: string | ((data: FormData) => void | Promise<void>);
  /**
   * Состояние последнего ответа. Новый объект со статусом `error` — сигнал
   * вернуть отправленные значения в поля.
   */
  state?: FormFeedback;
  /** Ошибка, которую сервер привязал к конкретному полю (по его `name`). */
  fieldError?: { name: string; message: string } | null;
};

export function Form({
  action,
  state,
  fieldError = null,
  children,
  onInvalidCapture,
  onInputCapture,
  onChangeCapture,
  onSubmitCapture,
  ref,
  ...props
}: FormProps): ReactNode {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitted = useRef<FormData | null>(null);
  const focusedThisRound = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>(() => new Map());

  const submit =
    typeof action === 'function'
      ? (data: FormData) => {
          submitted.current = data;
          return action(data);
        }
      : action;

  /*
    Возврат значений — в `useLayoutEffect`, а не в обычном эффекте: сброс
    формы React делает при фиксации того же обновления, что приносит новое
    состояние, и до отрисовки. Успей мы только после неё, человек увидел бы
    мигание пустой формы.
  */
  useLayoutEffect(() => {
    const form = formRef.current;
    const data = submitted.current;
    if (state?.status !== 'error' || form === null || data === null) return;
    restoreValues(form, data);
  }, [state]);

  const serverFieldName = fieldError?.name ?? null;
  const serverFieldMessage = fieldError?.message ?? null;

  useLayoutEffect(() => {
    const form = formRef.current;
    if (form === null || serverFieldName === null || serverFieldMessage === null) return;
    const control = form.elements.namedItem(serverFieldName);
    if (!(control instanceof Element) || !isControl(control)) return;

    const key = keyOf(control);
    setErrors((previous) => new Map(previous).set(key, serverFieldMessage));
    markInvalid(control, true);
    control.focus();
  }, [serverFieldName, serverFieldMessage]);

  function handleInvalid(event: FormEvent<HTMLFormElement>): void {
    onInvalidCapture?.(event);
    const control = event.target;
    if (!isControl(control)) return;

    // Своё сообщение вместо окошка браузера. Отправка всё равно не состоится.
    event.preventDefault();
    const key = keyOf(control);
    const message = messageFor(control);
    setErrors((previous) => new Map(previous).set(key, message));
    markInvalid(control, true);

    // Браузер ставил фокус в первое неверное поле сам — вместе с окошком.
    // Окошко погашено, фокус переводим сами. События одной проверки идут
    // подряд в порядке полей, поэтому «первое» — это первое за один проход.
    // Проход отмеряется задачей, а не микрозадачей: очередь микрозадач
    // браузер опустошает после каждого слушателя, то есть между полями.
    if (!focusedThisRound.current) {
      focusedThisRound.current = true;
      control.focus();
      setTimeout(() => {
        focusedThisRound.current = false;
      }, 0);
    }
  }

  function clearFor(target: EventTarget | null): void {
    if (!isControl(target)) return;
    const key = keyOf(target);
    // Радиокнопки и флажки одной группы делят ошибку по имени, а не по id.
    const keys = [key, target.name];
    setErrors((previous) => {
      if (!keys.some((item) => previous.has(item))) return previous;
      const next = new Map(previous);
      for (const item of keys) next.delete(item);
      return next;
    });
    markInvalid(target, false);
  }

  return (
    <FieldErrorsContext value={errors}>
      <form
        ref={(node) => {
          formRef.current = node;
          if (typeof ref === 'function') return ref(node);
          if (ref) ref.current = node;
        }}
        action={submit}
        onInvalidCapture={handleInvalid}
        onInputCapture={(event) => {
          onInputCapture?.(event);
          clearFor(event.target);
        }}
        onChangeCapture={(event) => {
          onChangeCapture?.(event);
          clearFor(event.target);
        }}
        onSubmitCapture={(event) => {
          onSubmitCapture?.(event);
          const form = formRef.current;
          if (form !== null) {
            for (const element of Array.from(form.elements)) {
              if (isControl(element) && element.getAttribute('aria-invalid') === 'true') {
                markInvalid(element, false);
              }
            }
          }
          setErrors(new Map());
        }}
        {...props}
      >
        {children}
      </form>
    </FieldErrorsContext>
  );
}

/**
 * Поле с подписью-стёклышком над ним — та же подпись, что на странице входа.
 *
 * Подпись набрана приёмом выбранного раздела в шапке (`glass-soft nav-pill`):
 * одна идея на два места. Связь с полем — через `htmlFor`, а не объятием
 * `<label>`: внутри поля бывает кнопка (глаз у пароля), а кнопка внутри
 * подписи — второй нажимаемый элемент там, где браузер ждёт один.
 *
 * Пояснение (`hint`) получает `id` вида `<htmlFor>-hint` — на него поле
 * ссылается своим `aria-describedby`. Пока у поля ошибка, пояснение
 * уступает место пузырьку: два текста под одним полем читаются хуже одного.
 */
export function Field({
  htmlFor,
  label,
  note,
  hint,
  className,
  children,
}: {
  htmlFor: string;
  label: ReactNode;
  /** Приписка рядом с подписью: «необязательно», «для справки». */
  note?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const error = use(FieldErrorsContext).get(htmlFor);

  return (
    <div className={cn('field-chip-host', className)} data-invalid={error === undefined ? undefined : ''}>
      <div className="field-chip-row">
        <label htmlFor={htmlFor} className="field-chip glass-soft nav-pill">
          {label}
        </label>
        {note !== undefined && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>

      {/* Обёртка ровно по полю: кнопки внутри поля отмеряются от его краёв, не от подписи. */}
      <div className="relative">{children}</div>

      {error !== undefined ? (
        <FieldBubble id={errorId(htmlFor)}>{error}</FieldBubble>
      ) : (
        hint !== undefined && (
          <p id={`${htmlFor}-hint`} className="text-muted-foreground mt-1.5 text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Пузырёк ошибки под полем. Хвостик — две капли, поднимающиеся к полю, как
 * у облачка мысли: «Пузырик» и в ошибках остаётся пузыриком.
 *
 * `role="alert"`: пузырёк появляется в ответ на попытку отправки, и читалка
 * должна сказать о нём сразу, не дожидаясь, пока человек вернётся к полю.
 */
function FieldBubble({ id, children }: { id: string; children: ReactNode }): ReactNode {
  return (
    <p id={id} role="alert" className="bubble bubble-error">
      <CircleAlert aria-hidden className="bubble-icon" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Итог отправки: ошибка или успех. Тот же пузырёк, что у поля, только для
 * всей формы. Значок и слова несут смысл вместе с цветом (§12): цвет здесь
 * не единственный носитель.
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
  className?: string;
}): ReactNode {
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('bubble', `bubble-${tone}`, className)}
    >
      <Icon aria-hidden className="bubble-icon" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
