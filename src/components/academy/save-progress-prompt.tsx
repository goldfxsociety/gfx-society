import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

/** Logged-out prompt under quizzes/lessons (UX audit #8): signup first, login secondary. */
export function SaveProgressPrompt() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">Create a free account para ma-save ang quiz results at progress mo.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full text-base sm:w-auto")}>
          Create free account
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center justify-center text-sm underline">
          May account ka na? Log in para ma-save
        </Link>
      </div>
    </div>
  );
}
