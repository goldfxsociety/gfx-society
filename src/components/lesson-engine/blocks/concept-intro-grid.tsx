import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { OHLC } from "@/lib/candlestick";

export type ConceptDef = {
  id: string;
  name: string;
  desc: string;
  ohlc: OHLC[];
};

export function ConceptIntroGrid({ concepts }: { concepts: ConceptDef[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {concepts.map((c) => (
        <div
          key={c.id}
          className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800"
        >
          <CandleSequenceCanvas candles={c.ohlc} width={70} height={60} small />
          <p className="text-xs font-semibold">{c.name}</p>
          <p className="text-[11px] text-zinc-500">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}
