import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center px-6">
        <Link href="/" className="font-heading text-lg font-bold tracking-tight text-primary">
          GFX <span className="text-foreground">Society</span>
        </Link>
      </div>
    </header>
  );
}
