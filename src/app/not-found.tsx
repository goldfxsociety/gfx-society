import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t find that page. It may have moved, or the link may be wrong.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/academy" className={buttonVariants({ variant: "default" })}>
          Back to the Academy
        </Link>
        <Link href="/start" className={buttonVariants({ variant: "outline" })}>
          Start here
        </Link>
      </div>
    </div>
  );
}
