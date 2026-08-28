import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-65 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-[#0B3A75] bg-[#0B3A75] text-white shadow-sm hover:border-[#082E5F] hover:bg-[#082E5F] hover:text-white",
        destructive: "border border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border-2 border-[#0B3A75]/35 bg-background text-[#071326] shadow-sm hover:border-[#0B3A75] hover:bg-[#EAF2FF] hover:text-[#071326] dark:bg-card dark:text-foreground dark:hover:bg-primary/15",
        secondary: "border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:text-secondary-foreground",
        ghost: "text-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "border border-[#F5B32F] bg-[#F5B32F] text-[#071326] shadow-lg hover:border-[#FFC64D] hover:bg-[#FFC64D] hover:text-[#071326] hover:shadow-xl font-black text-lg",
        accent: "border border-accent bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 hover:text-accent-foreground",
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
