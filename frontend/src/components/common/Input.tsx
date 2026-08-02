import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-white/56">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "rounded-canopy-sm border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/92",
            "placeholder:text-white/30 outline-none transition-all duration-200 ease-canopy",
            "focus:border-canopy-primary/60 focus:bg-white/[0.06] focus:shadow-glow-primary",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
