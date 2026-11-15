"use client";

import { buttonVariants } from "@/components/ui/button";
import { ME } from "@/config/members-home";
import { cn } from "cn";

/** /training load error (explorer-linked-tiers-spec §2.1): neutral line + outline retry. No gold, no details. */
export default function TrainingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div lang="fil" className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 pt-8 pb-24">
      <p role="alert" className="text-sm">
        {ME.home.loadError}
      </p>
      <button type="button" onClick={reset} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full sm:w-auto sm:self-start")}>
        {ME.home.retry}
      </button>
    </div>
  );
}
