'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export type DepartmentOption = { id: string; name: string };

/** Значение списка «Новый отдел…»: не id, поэтому серверу не уходит. */
const NEW = '__new__';

/**
 * Отдел: выбор из справочника или новый прямо здесь. Поле необязательное.
 * В форму уходит либо `departmentId`, либо `newDepartment`.
 */
export function DepartmentField({
  departments,
  idPrefix,
  defaultId,
  defaultNew,
}: {
  departments: readonly DepartmentOption[];
  idPrefix: string;
  defaultId?: string;
  defaultNew?: string;
}): ReactNode {
  const [choice, setChoice] = useState(defaultNew ? NEW : (defaultId ?? ''));

  return (
    <Field htmlFor={`${idPrefix}-department`} label="Отдел" note="необязательно">
      <NativeSelect
        id={`${idPrefix}-department`}
        name={choice === NEW ? undefined : 'departmentId'}
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
      >
        <option value="">Не указан</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
        <option value={NEW}>Новый отдел…</option>
      </NativeSelect>
      {choice === NEW && (
        <Input
          aria-label="Название нового отдела"
          name="newDepartment"
          defaultValue={defaultNew}
          placeholder="Например, Бухгалтерия"
          required
          autoFocus
          className="mt-2"
        />
      )}
    </Field>
  );
}
