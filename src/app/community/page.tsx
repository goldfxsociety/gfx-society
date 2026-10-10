import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the GFX Society community of Filipino gold traders learning with demo-first discipline.",
  alternates: { canonical: "/community" },
  openGraph: { title: "Community", description: "Join the GFX Society community of Filipino gold traders learning with demo-first discipline.", url: "/community", images: ["/opengraph-image"] },
};


export default function CommunityPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Community
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Join the GFX Community</h1>
        <p className="text-sm text-muted-foreground">
          Connect with fellow traders — ask questions, share setups, and learn together.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-semibold">What you&apos;ll find here</p>
        <ul className="mt-2 list-inside list-disc text-muted-foreground">
          <li>Beginner Q&A and walkthroughs</li>
          <li>A place to ask questions as you go through the Academy</li>
          <li>Other traders at the same stage as you</li>
        </ul>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
        <p className="font-semibold">Community guidelines</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Be respectful, no spam, and no selling signals or guaranteed-profit
          schemes. This is an education space — trading involves risk, and no
          one here can promise you a result.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href="https://m.me/cm/DT8JPfkzsMUWMvYy/"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "default" })}
        >
          Join Messenger Community →
        </a>
      </div>

      <Link href="/" className="text-sm text-muted-foreground underline">
        ← Back to home
      </Link>
    </div>
  );
}
