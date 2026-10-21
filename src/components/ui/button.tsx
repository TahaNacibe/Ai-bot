import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:opacity-90",
        outline: "border border-input bg-background shadow-sm hover:bg-muted",
        destructive: "bg-destructive text-white shadow-sm hover:opacity-90",
        ghost: "hover:bg-muted",
      },
      size: {
        default: "h-9 px-3",
        small: "h-8 px-2.5",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={clsx(buttonStyles({ variant, size }), className)} {...props} />;
}
