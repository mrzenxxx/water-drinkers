import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const READY: ReadonlyArray<{ title: string; detail: string }> = [
  { title: 'Next.js + TypeScript', detail: 'App Router, строгий режим' },
  { title: 'GraphQL Yoga', detail: '/api/graphql, схема §10.2, резолверы-заглушки' },
  { title: 'Prisma', detail: 'schema.prisma по §11, ручная начальная миграция' },
  { title: 'Tailwind + shadcn/ui', detail: 'токены темы в CSS-переменных' },
  { title: 'Codegen', detail: 'схема → типы в src/graphql/generated' },
  { title: 'Vitest', detail: 'npm test, npm run test:watch' },
];

export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">WaterDrinkers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Каркас проекта, этап 0. Данных пока нет — только проверка, что всё поднялось.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Обе темы живы</CardTitle>
          <CardDescription>
            Тема определяется по системной настройке, переключатель сохраняет выбор.
            Цвет никогда не единственный носитель смысла: рядом со знаком стоит подпись.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Пример: пора скидываться</p>
            <p className="tabular mt-1 text-3xl font-semibold text-owes">−340,00 ₽</p>
            <p className="mt-1 text-sm text-owes">Должен фонду</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Пример: всё внесено</p>
            <p className="tabular mt-1 text-3xl font-semibold text-credit">+1 250,00 ₽</p>
            <p className="mt-1 text-sm text-credit">Остаток в фонде</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Что уже собрано</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {READY.map((item) => (
              <li key={item.title} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <span className="font-medium">{item.title}</span>
                <span className="text-sm text-muted-foreground sm:before:mr-2 sm:before:content-['—']">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href="/api/graphql">Открыть GraphQL</a>
        </Button>
        <span className="text-sm text-muted-foreground">
          Спецификация — в <code className="font-mono">docs/SPEC.md</code>
        </span>
      </div>
    </main>
  );
}
