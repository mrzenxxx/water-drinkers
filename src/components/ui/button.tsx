import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Кнопка.
 *
 * Основное действие залито водным градиентом, второстепенные — стеклом.
 * Оба конца градиента проверены на контраст с текстом кнопки по отдельности
 * (`npm run check:contrast`): градиент — это не один цвет, и «в среднем
 * проходит» здесь не считается.
 *
 * Наведение меняет яркость в ту сторону, где контраст растёт: в светлой теме
 * заливка темнеет под светлым текстом, в тёмной — светлеет под тёмным.
 * Нажатие даёт отклик масштабом, а не смещением: соседи не съезжают.
 */

const buttonVariants = cva(
  "press inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-[image:var(--gradient-primary)] text-primary-foreground shadow-sm hover:brightness-95 hover:shadow-md dark:hover:brightness-110',
        secondary:
          'glass-soft text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:brightness-95 dark:hover:brightness-110',
        outline:
          'glass-soft text-foreground hover:border-primary/50 hover:text-primary',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Отрисовать стили кнопки на дочернем элементе (например, на ссылке). */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps): ReactNode {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
export type { ButtonProps };
