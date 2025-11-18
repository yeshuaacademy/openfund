import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/helpers/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9CFF] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#2970FF] text-white shadow-[0_18px_55px_-30px_rgba(41,112,255,0.9)] transition hover:bg-[#5B9CFF]",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-500",
        outline:
          "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
        secondary:
          "bg-white/10 text-white hover:bg-white/20",
        ghost: "text-white/70 hover:bg-white/10",
        link: "text-[#5B9CFF] underline-offset-4 hover:text-white",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-4 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
