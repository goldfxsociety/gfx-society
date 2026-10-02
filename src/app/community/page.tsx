import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function CommunityPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          Community
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Join the GFX Community</h1>
        <p className="text-sm text-zinc-500">
          Connect with fellow traders — ask questions, share setups, and learn together.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-semibold">What you&apos;ll find here</p>
        <ul className="mt-2 list-inside list-disc text-zinc-600 dark:text-zinc-400">
          <li>Live newbie training sessions and walkthroughs</li>
          <li>A place to ask questions as you go through the Academy</li>
          <li>Other traders at the same stage as you</li>
        </ul>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
        <p className="font-semibold">Community guidelines</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Be respectful, no spam, and no selling signals or guaranteed-profit
          schemes. This is an education space — trading involves risk, and no
          one here can promise you a result.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href="https://discord.gg/AZb5Gk9xNP"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "default" })}
        >
          Join Discord Community →
        </a>
        <a
          href="https://m.me/cm/DT8JPfkzsMUWMvYy/"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Join Messenger Community →
        </a>
      </div>

      <Link href="/" className="text-sm text-zinc-500 underline">
        ← Back to home
      </Link>
    </div>
  );
}
