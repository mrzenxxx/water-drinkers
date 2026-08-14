import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addParticipantAction } from '@/lib/actions/admin';

/**
 * Добавление участника (§6.7).
 *
 * Полей ровно три, и среди них нет ни имени, ни фамилии: их человек вводит сам
 * при первом входе, приложение не выдумывает персональные данные (§6.7, §7).
 *
 * Начальное сальдо необязательно. Заполненное, оно той же транзакцией поднимает
 * начальное сальдо фонда (§4.2) — иначе `Σ балансов` немедленно разошлась бы
 * с остатком кассы.
 */
export function AddParticipantForm({ today, domain }: { today: string; domain: string }): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить участника</CardTitle>
        <CardDescription>
          Адрес рабочей почты и дата вступления. Имя и фамилию человек введёт сам при первом входе.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={addParticipantAction} submitLabel="Добавить">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-email">Рабочая почта</Label>
              <Input
                id="participant-email"
                name="email"
                type="email"
                required
                placeholder={`i.ivanov@${domain}`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-joined">Дата вступления</Label>
              <Input
                id="participant-joined"
                name="joinedAt"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-opening">Начальное сальдо, ₽</Label>
              <Input
                id="participant-opening"
                name="openingBalance"
                inputMode="decimal"
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Ненулевое начальное сальдо увеличит и начальное сальдо фонда: остаток у человека есть
            потому, что его деньги уже лежат в кассе (§4.2).
          </p>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
