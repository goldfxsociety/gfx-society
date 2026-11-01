import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";

/**
 * Optional ACCM step (copy approved Oct 27, recruitment/accm-bridge.md, site/DM section).
 * Secondary section only: H2, never a page headline. Disclosure always visible under the button.
 * Starts with the partner-broker line from the partner config, then the approved bridge copy.
 */
export const ACCM_BRIDGE_DISCLOSURE =
  `Disclosure: ${IB_DISCLOSURE_TEXT} Hindi nito binabago ang presyo o fees mo. Hindi kami financial adviser at walang guaranteed profit. Mag-research ka muna at i-check ang regulatory status ng broker bago mag-deposit.`;

export function AccmBridge() {
  return (
    <section aria-labelledby="accm-bridge-heading" className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 id="accm-bridge-heading" className="text-lg font-semibold">
        Ready na mag-practice with real, small money?
      </h2>
      <p className="text-sm text-muted-foreground">
        Hindi required ang broker account para matuto sa GFX Academy, free lahat ng lessons. Pero kung ready ka nang
        mag-practice live, pwede kang mag-open ng <strong>cents account</strong> with small money na kaya mong mawala,
        max 1% risk per trade, laging may stop loss.
      </p>
      <p className="text-sm text-muted-foreground">
        Kung pipiliin mo ang ACCM through our link, makakasali ka rin sa GFX Society Discord para sa trainings at
        Q&amp;A with the community. Optional ito.
      </p>
      <Link
        href="/accm"
        className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 w-full whitespace-normal py-2 text-sm")}
      >
        Open ACCM account (optional)
      </Link>
      <p className="text-sm text-muted-foreground">{ACCM_BRIDGE_DISCLOSURE}</p>
      <p className="text-sm text-muted-foreground">
        Max 1% risk, laging may stop loss. Cents account? Pera lang na kaya mong mawala. Education lang, not financial
        advice.
      </p>
    </section>
  );
}
