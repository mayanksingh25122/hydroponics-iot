import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type PageContainerProps = HTMLAttributes<HTMLDivElement>;

/**
 * Responsive page gutter per the blueprint: 32px desktop, 24px
 * tablet, 16px mobile. Wired into AppShell's main content region
 * as of Task 11.
 */
export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 tablet:px-6 desktop:px-8", className)} {...props}>
      {children}
    </div>
  );
}
