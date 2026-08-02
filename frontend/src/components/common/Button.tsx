import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-canopy-primary text-black font-medium hover:brightness-110 hover:shadow-glow-primary active:brightness-95",
  secondary:
    "border border-white/15 bg-white/[0.06] text-white/90 hover:bg-white/[0.10] backdrop-blur-glass",
  ghost: "text-white/60 hover:text-white/90 hover:bg-white/[0.06]",
  danger: "bg-canopy-error/90 text-black font-medium hover:brightness-110",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-canopy-sm transition-all duration-200 ease-canopy active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
