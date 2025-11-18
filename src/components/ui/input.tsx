import * as React from "react"

import { cn } from "@/helpers/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-white/10 bg-[#050B18] px-3 py-2 text-sm text-white placeholder:text-white/40 transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2970FF] focus-visible:ring-offset-0 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
