import * as React from "react"

import { cn } from "@/lib/utils"

/*
  Вид поля — лунка в стекле, фокус и ошибка — целиком в `.field-surface`
  (`globals.css`). Утилиты `ring-*` и `shadow-*` сюда не добавлять: они
  перезаписывают `box-shadow`, и лунка со свечением фокуса пропадают.
*/

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "field-surface h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
