import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 disabled:shadow-none dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-200 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-[#0B3A75] bg-[#0B3A75] text-white shadow-sm hover:border-[#082E5F] hover:bg-[#082E5F] hover:text-white",
        destructive: "border border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border-2 border-[#0B3A75]/45 bg-white text-[#071326] shadow-sm hover:border-[#0B3A75] hover:bg-[#EAF2FF] hover:text-[#071326] dark:bg-slate-950 dark:text-white dark:hover:bg-[#10284A] dark:hover:text-white",
        secondary: "border border-[#B8C7DC] bg-[#EAF2FF] text-[#071326] shadow-sm hover:border-[#7EA2D4] hover:bg-[#DCEAFF] hover:text-[#071326] dark:border-[#31557F] dark:bg-[#10284A] dark:text-white dark:hover:bg-[#173962]",
        ghost: "text-[#071326] hover:bg-[#EAF2FF] hover:text-[#071326] dark:text-white dark:hover:bg-[#10284A] dark:hover:text-white",
        link: "text-[#0B3A75] underline-offset-4 hover:text-[#082E5F] hover:underline dark:text-[#7FB2FF]",
        hero: "border border-[#F5B32F] bg-[#F5B32F] text-[#071326] shadow-lg hover:border-[#FFC64D] hover:bg-[#FFC64D] hover:text-[#071326] hover:shadow-xl font-black text-lg",
        accent: "border border-[#F5B32F] bg-[#F5B32F] text-[#071326] shadow-sm hover:bg-[#FFC64D] hover:text-[#071326]",
        premium: "border border-[#F5B32F] bg-[#071326] text-white shadow-lg hover:bg-[#10284A] hover:text-white hover:shadow-xl font-black",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
