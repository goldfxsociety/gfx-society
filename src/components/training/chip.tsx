import { cn } from "cn";

const TONES = {
  neutral: "border-border text-muted-foreground",
  amber: "border-amber-500/60 text-amber-300",
  green: "border-green-500/60 text-green-300",
  red: "border-red-500/70 text-red-300",
  gold: "border-primary/60 text-primary",
} as const;

export function Chip({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>
      {children}
    </span>
  );
}
