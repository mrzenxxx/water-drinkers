import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/*
  Бейджики залитых вариантов — бусины жидкого стекла (`.badge-bead` в
  `globals.css`): градиент, блик, ободок и тень цвета бейджика. Заливка и
  цвет тени задаются переменными `--badge-fill` и `--badge-tone`, поэтому
  вариант — это только пара «заливка — текст», а объём у всех один.
  Утилиты `shadow-*` сюда не ставить: они перезапишут тень бусины.
*/

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "badge-bead [--badge-fill:var(--gradient-primary)] text-primary-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        secondary:
          "badge-bead [--badge-fill:var(--gradient-secondary)] [--badge-tone:var(--secondary-foreground)] text-secondary-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        destructive:
          "badge-bead [--badge-fill:var(--gradient-danger)] [--badge-tone:var(--destructive)] text-destructive-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        recorded:
          "badge-bead [--badge-fill:var(--gradient-mint)] [--badge-tone:var(--mint-foreground)] text-mint-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        outline:
          "glass-soft badge-bead badge-bead-glass rounded-full text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "border-transparent [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
