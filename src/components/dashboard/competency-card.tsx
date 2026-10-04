import Link from "next/link";
import { cn } from "cn";
import { describeEvidence, type CompetencyEvidence } from "@/lib/competency/evidence";
import type { CompetencyScore } from "@/lib/diagnostic/scoring";

const STATUS_CLASS: Record<string, string> = {
  "No Evidence": "text-muted-foreground",
  Developing: "text-primary",
  Familiar: "text-primary",
  "Strong Foundation": "text-emerald-500",
};

export function CompetencyCard({
  label,
  competencyKey,
  evidence,
  baseline,
}: {
  label: string;
  competencyKey: string;
  evidence: CompetencyEvidence;
  baseline: CompetencyScore | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold">{label}</p>

      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Demonstrated
        </span>
        <span className={cn("text-sm font-medium", STATUS_CLASS[evidence.status])}>
          {evidence.status}
        </span>
        <span className="text-xs text-muted-foreground">{describeEvidence(evidence)}</span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Baseline
        </span>
        {baseline ? (
          <>
            <span className="text-sm font-medium text-primary">{baseline.tier}</span>
            <span className="text-xs text-muted-foreground">
              {baseline.confidence === "Limited data"
                ? `Limited data — based on ${baseline.answered} question${baseline.answered === 1 ? "" : "s"}`
                : "Standard confidence"}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-muted-foreground">Not assessed</span>
            <Link href="/diagnostic" className="text-xs text-primary underline">
              Take the GFX Diagnostic
            </Link>
          </>
        )}
      </div>

      <Link
        href={`/dashboard/competency/${competencyKey}`}
        className="self-start text-xs font-medium text-primary underline"
      >
        View Lessons
      </Link>
    </div>
  );
}
