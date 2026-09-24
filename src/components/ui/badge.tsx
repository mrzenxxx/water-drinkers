import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/*
  Бейджик — матовый: заливка градиентом или стекло карточки, без рамки,
  бликов и теней. Размер — компактный, по строке мелкого текста рядом:
  бейджик помечает, а не перетягивает внимание.
*/

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-[0.6875rem] leading-none font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-[image:var(--gradient-primary)] text-primary-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        secondary:
          "bg-[image:var(--gradient-secondary)] text-secondary-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        destructive:
          "bg-[image:var(--gradient-danger)] text-destructive-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        recorded:
          "bg-[image:var(--gradient-mint)] text-mint-foreground [a&]:hover:brightness-95 dark:[a&]:hover:brightness-110",
        outline:
          "glass-soft border-border rounded-full text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
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
