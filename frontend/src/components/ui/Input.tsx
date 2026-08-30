import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Text input styled from VERDA tokens only — thin border, flat
 * surface, focus ring in the trace green. `invalid` drives the error
 * border; pair it with `aria-invalid` and `aria-describedby` at the
 * call site so assistive tech announces the association.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-10 w-full rounded-verda-sm border bg-verda-surface px-3 text-verda-body text-verda-ink",
          "placeholder:text-verda-ink-3",
          "transition-colors duration-(--verda-motion-fast) ease-verda",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid
            ? "border-verda-danger"
            : "border-verda-line hover:border-verda-line-strong",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
