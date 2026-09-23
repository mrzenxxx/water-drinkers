import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { House } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BookHelp } from '@/components/guide-icon';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { pageTitle } from '@/lib/view/app';
import { parseGuide, type GuideBlock, type GuideInline } from '@/lib/view/guide';

/**
 * Руководство пользователя: правила учёта и расчёта простым языком.
 *
 * Текст живёт в `docs/USER_GUIDE.md` и читается с диска при отрисовке — тот
 * же приём, что у SDL в `src/graphql/schema.ts`, и так же файл объявлен в
 * `outputFileTracingIncludes`. Копии текста в разметке нет: правило,
 * исправленное в документе, исправлено и на странице.
 *
 * Серверный компонент без единого обработчика: оглавление и ссылки на
 * разделы — обычные якоря, ссылки на экраны — `Link`.
 */
export default async function GuidePage(): Promise<ReactNode> {
  const source = await readFile(join(process.cwd(), 'docs/USER_GUIDE.md'), 'utf8');
  const guide = parseGuide(source);

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Руководство')}</title>

      <PageHeader icon={BookHelp} title={guide.title}>
        {guide.lead.map((content, index) => (
          <Inline key={index} content={content} />
        ))}
      </PageHeader>

      <nav aria-label="Содержание руководства">
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg leading-none font-semibold">Содержание</h2>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {guide.sections.map((section) => (
                <li key={section.id ?? section.title}>
                  <a
                    href={`#${section.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </nav>

      {guide.sections.map((section) => (
        // Отступ якоря — под липкую шапку высотой 4rem: без него заголовок
        // раздела при переходе по оглавлению уезжал бы под стекло.
        <section
          key={section.id ?? section.title}
          id={section.id ?? undefined}
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </CardContent>
          </Card>
        </section>
      ))}

      <Link
        href="/"
        className="text-primary focus-visible:ring-ring flex items-center gap-2 self-start rounded-lg text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        <House aria-hidden className="size-4" />
        На главную
      </Link>
    </div>
  );
}

// Ключи по позиции ниже безопасны: блоки не переставляются и не удаляются
// поодиночке — документ целиком пересобирается из файла при каждой отрисовке.

function Block({ block }: { block: GuideBlock }): ReactNode {
  switch (block.kind) {
    case 'heading':
      return (
        <h3 id={block.id ?? undefined} className="mt-2 scroll-mt-20 text-base font-semibold">
          {block.text}
        </h3>
      );

    case 'paragraph':
      return (
        <p>
          <Inline content={block.content} />
        </p>
      );

    case 'bullets':
    case 'steps': {
      const items = block.items.map((item, index) => (
        <li key={index}>
          <Inline content={item} />
        </li>
      ));
      return block.kind === 'steps' ? (
        <ol className="ml-5 flex list-decimal flex-col gap-1.5">{items}</ol>
      ) : (
        <ul className="ml-5 flex list-disc flex-col gap-1.5">{items}</ul>
      );
    }

    case 'table':
      // Своя таблица, а не `ui/table`: там ячейки не переносят строки, а
      // здесь в ячейках предложения. На узком экране таблица едет вбок
      // внутри своей рамки, а не растягивает страницу.
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                {block.head.map((cell, index) => (
                  <th key={index} scope="col" className="px-2 py-2 align-bottom font-medium">
                    <Inline content={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-border border-b last:border-0">
                  {row.map((cell, index) => (
                    <td key={index} className="px-2 py-2 align-top">
                      <Inline content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'code':
      return (
        <pre className="glass-soft overflow-x-auto rounded-lg px-4 py-3 font-mono text-xs leading-relaxed">
          {block.text}
        </pre>
      );

    case 'rule':
      return <hr className="border-border" />;
  }
}

function Inline({ content }: { content: readonly GuideInline[] }): ReactNode {
  return content.map((piece, index) => {
    switch (piece.kind) {
      case 'text':
        return piece.text;
      case 'strong':
        return (
          <strong key={index} className="font-semibold">
            {piece.text}
          </strong>
        );
      case 'code':
        return (
          <code key={index} className="bg-secondary/70 rounded px-1 py-0.5 font-mono text-xs">
            {piece.text}
          </code>
        );
      case 'link': {
        const className = 'text-primary font-medium underline underline-offset-2';
        // Адрес экрана — через `Link`, чтобы переход шёл без перезагрузки.
        // Что такой экран есть, проверяет тест руководства, а не `typedRoutes`:
        // адрес пришёл из текста документа, и компилятор его не видит.
        return piece.href.startsWith('/') ? (
          <Link key={index} href={piece.href as Route} className={className}>
            {piece.text}
          </Link>
        ) : (
          <a key={index} href={piece.href} className={className}>
            {piece.text}
          </a>
        );
      }
    }
  });
}
