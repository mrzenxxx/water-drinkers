import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: ComponentProps<'div'>): ReactNode {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<'div'>): ReactNode {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<'h3'>): ReactNode {
  return <h3 className={cn('text-lg leading-none font-semibold', className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<'p'>): ReactNode {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<'div'>): ReactNode {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<'div'>): ReactNode {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
