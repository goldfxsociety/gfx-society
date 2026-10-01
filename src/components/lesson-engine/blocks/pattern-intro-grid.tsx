import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { OHLC } from "@/lib/candlestick";

export type PatternDef = {
  id: string;
  name: string;
  type: "bullish" | "bearish" | "neutral";
  signal: string;
  desc: string;
  tip: string;
  ohlc: OHLC[];
};

const TYPE_STYLE: Record<PatternDef["type"], string> = {
  bullish:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  bearish:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  neutral:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export function PatternIntroGrid({ patterns }: { patterns: PatternDef[] }) {
  return (
    <div className="flex flex-col gap-3">
      {patterns.map((p) => (
        <div
          key={p.id}
          className="flex gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex-shrink-0">
            <CandleSequenceCanvas candles={p.ohlc} width={70} height={60} small />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{p.name}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLE[p.type]}`}
              >
                {p.signal}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                What it looks like:{" "}
              </span>
              {p.desc}
            </p>
            <p className="mt-1 text-xs text-zinc-400">💡 {p.tip}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
