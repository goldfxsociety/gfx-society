import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Muted native <details> card (simplicity spec v2 §4: no accordion component). Used for "Learn more",
 * "May problema?" / "Having trouble?". 44px summary target; closed by default.
 */
export function Expander({
  summary,
  children,
  className,
  testId,
  open,
  heading,
}: {
  summary: string;
  children: ReactNode;
  className?: string;
  testId?: string;
  /** Initial state only (the visitor can still toggle it). */
  open?: boolean;
  /** Render the summary text as an <h2> (valid inside <summary>) so heading navigation still finds the section. */
  heading?: boolean;
}) {
  return (
    <details open={open || undefined} data-testid={testId} className={cn("group rounded-lg border border-border bg-card", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {heading ? <h2 className="text-sm font-medium">{summary}</h2> : summary}
        <span aria-hidden className="text-muted-foreground group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
