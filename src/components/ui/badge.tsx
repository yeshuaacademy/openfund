import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/helpers/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-[#2970FF]/40 bg-[#2970FF]/15 px-2.5 py-0.5 text-xs font-semibold text-[#5B9CFF] transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[#2970FF]/40 bg-[#2970FF]/15 text-[#5B9CFF]",
        secondary:
          "border-white/10 bg-white/5 text-white/80",
        destructive:
          "border-rose-400/40 bg-rose-500/15 text-rose-200",
        outline: "border-white/20 bg-transparent text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
