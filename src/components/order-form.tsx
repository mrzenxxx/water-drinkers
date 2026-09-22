import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { ReceiptField } from '@/components/receipt-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createWaterOrderAction } from '@/lib/actions/orders';

/**
 * Отметить поставку (§6.5).
 *
 * Серверный компонент: разметка полей в бандл не едет, клиентской остаётся
 * только обвязка формы и поле чека. Карточка стоит на странице «Заказы», а не
 * в админ-панели, потому что так думает человек: привезли воду — иду в
 * «Заказы». Права от места не зависят — их проверяет резолвер.
 */
export function OrderForm({ today }: { today: string }): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Отметить поставку</CardTitle>
        <CardDescription>
          Деньги уходят из общего фонда сразу и раскладываются по участникам за период
          потребления (§4.4). Чек обязателен: по нему любой участник проверит трату.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ActionForm action={createWaterOrderAction} submitLabel="Отметить поставку">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-ordered-at">Дата поставки</Label>
              <Input id="order-ordered-at" name="orderedAt" type="date" defaultValue={today} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-amount">Сумма, ₽</Label>
              <Input
                id="order-amount"
                name="amount"
                inputMode="decimal"
                placeholder="3000"
                required
                aria-describedby="order-amount-hint"
              />
              <p id="order-amount-hint" className="text-muted-foreground text-xs">
                Рубли и копейки: 3000 или 3000,50.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-bottles">Бутылей</Label>
              <Input id="order-bottles" name="bottlesCount" inputMode="numeric" placeholder="10" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-supplier">Поставщик</Label>
              <Input id="order-supplier" name="supplier" placeholder="Аквафор Доставка" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-note">Примечание</Label>
              <Input id="order-note" name="note" placeholder="Привезли на два дня позже" />
            </div>

            <ReceiptField />
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
