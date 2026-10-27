import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Optional ACCM step (copy approved Oct 27, recruitment/accm-bridge.md, site/DM section).
 * Secondary section only: H2, never a page headline. Disclosure always visible under the button.
 * The copy file's disclosure is longer than IB_DISCLOSURE_TEXT, so it is used verbatim here.
 */
export const ACCM_BRIDGE_DISCLOSURE =
  "Disclosure: GFX may earn a commission from ACCM if you sign up through our link. Hindi nito binabago ang presyo o fees mo. Hindi kami financial adviser at walang guaranteed profit. Mag-research ka muna at i-check ang regulatory status ng kahit anong broker bago mag-deposit.";

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
        Kung pipiliin mo ang ACCM through our link, makakasali ka rin sa PDE x GFX Society Discord para sa trainings at
        Q&amp;A with the community. Optional ito, at pwede ka namang gumamit ng ibang broker.
      </p>
      <a
        href="/accm"
        rel="sponsored noopener"
        className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 w-full whitespace-normal py-2 text-sm")}
      >
        Open ACCM account (optional)
      </a>
      <p className="text-sm text-muted-foreground">{ACCM_BRIDGE_DISCLOSURE}</p>
      <p className="text-sm text-muted-foreground">
        Max 1% risk, laging may stop loss. Cents account? Pera lang na kaya mong mawala. Education lang, not financial
        advice.
      </p>
    </section>
  );
}
