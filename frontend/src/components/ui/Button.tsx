import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-verda-forest-800 text-verda-canvas hover:bg-verda-forest-700 disabled:bg-verda-idle",
  secondary:
    "bg-verda-surface-2 text-verda-ink border border-verda-line hover:border-verda-line-strong hover:bg-verda-sage-wash",
  ghost: "bg-transparent text-verda-ink-2 hover:bg-verda-sage-wash hover:text-verda-ink",
  danger: "bg-verda-danger text-verda-canvas hover:brightness-110 disabled:bg-verda-idle",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-verda-caption gap-1.5",
  md: "h-9 px-4 text-verda-body gap-2",
};

/**
 * A real <button>, styled from VERDA tokens only. No hover lift, no
 * scale — motion is border/background tint on the fast (150ms)
 * curve. Not yet wired into any page; components/common/Button.tsx
 * keeps driving the existing PumpControl UI unchanged.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-verda-sm font-medium",
          "transition-colors duration-(--verda-motion-fast) ease-verda",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
