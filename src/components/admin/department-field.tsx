'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-department`}>Отдел</Label>
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
        />
      )}
    </div>
  );
}
