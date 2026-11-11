"use client";

import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { TRANSFER_COPY as T, TRANSFER_TEMPLATE as TPL, TRANSFER_TEMPLATE_TEXT } from "@/content/access-request";
import { cn } from "@/lib/utils";

/**
 * Journey 4 (spec §7): muted inline expander on no_match with Ben's IB-transfer email template. Not a chooser, not gold.
 * No transfer-timing promise, no second-account CTA.
 */
export function TransferHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // QA Q9: never leave the "Copied" timer running after unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = async () => {
    // QA N9: clear first so a second Copy changes the live region again and is re-announced.
    setCopied(false);
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(TRANSFER_TEMPLATE_TEXT);
      timer.current = setTimeout(() => setCopied(true), 50);
    } catch {
      setCopied(false);
    }
  };
  const field = "w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-base break-words";
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="j4-transfer-help"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center self-start py-2 text-left text-sm text-muted-foreground underline"
      >
        {T.link}
      </button>
      {open && (
        <div id="j4-transfer-help" className="flex flex-col gap-3 text-sm">
          <p>{T.step1}</p>
          <dl className="flex flex-col gap-2">
            <dt className="font-medium">{T.toLabel}</dt>
            <dd className={field}>{TPL.to}</dd>
            <dt className="font-medium">{T.subjectLabel}</dt>
            <dd className={field}>{TPL.subject}</dd>
            <dt className="font-medium">{T.bodyLabel}</dt>
            <dd className={cn(field, "whitespace-pre-line")}>{TPL.body}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">{T.caption}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={copy} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full sm:w-auto")}>
              {T.copy}
            </button>
            <a href={TPL.mailto} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full sm:w-auto")}>
              {T.mailtoLabel}
            </a>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm">
            {copied ? T.copied : ""}
          </p>
          <p className="text-muted-foreground">{T.timing}</p>
          <p>{T.step2}</p>
          <p className="text-muted-foreground">{T.clause54}</p>
        </div>
      )}
    </div>
  );
}
