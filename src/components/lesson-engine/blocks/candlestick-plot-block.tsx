"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CandlestickPreset = {
  label: string;
  o: number;
  h: number;
  l: number;
  c: number;
};

type Result = {
  type: string;
  tone: "doji" | "bullish" | "bearish";
  explanation: string;
  rangePips: number;
  bodyPips: number;
  color: string;
};

export function CandlestickPlotBlock({
  presets,
}: {
  presets: CandlestickPreset[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState("");
  const [high, setHigh] = useState("");
  const [low, setLow] = useState("");
  const [close, setClose] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function draw(O: number, H: number, L: number, C: number) {
    if ([O, H, L, C].some((v) => Number.isNaN(v))) {
      setError("Enter all 4 values first.");
      setResult(null);
      return;
    }
    if (H < Math.max(O, C)) {
      setError("High must be at or above Open and Close.");
      setResult(null);
      return;
    }
    if (L > Math.min(O, C)) {
      setError("Low must be at or below Open and Close.");
      setResult(null);
      return;
    }
    setError("");

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const Ht = canvas.height;
    const pad = 20;
    ctx.clearRect(0, 0, W, Ht);

    const range = H - L || 1;
    const toY = (v: number) => pad + ((H - v) / range) * (Ht - pad * 2);
    const isBull = C >= O;
    const isDoji = Math.abs(C - O) / range < 0.05;
    const color = isDoji ? "#D4A017" : isBull ? "#3DCB8A" : "#E05555";
    const cx = W / 2;
    const bTop = toY(Math.max(O, C));
    const bBot = toY(Math.min(O, C));
    const bH = Math.max(bBot - bTop, 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, toY(H));
    ctx.lineTo(cx, bTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, bBot);
    ctx.lineTo(cx, toY(L));
    ctx.stroke();

    ctx.fillStyle = isBull && !isDoji ? color : "transparent";
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.rect(cx - 17, bTop, 34, bH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8A7AAA";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("H", cx - 21, toY(H) + 4);
    ctx.fillText("L", cx - 21, toY(L) + 4);
    ctx.fillStyle = color;
    ctx.fillText(isBull ? "C" : "O", cx - 21, toY(Math.max(O, C)) + 4);
    ctx.fillText(isBull ? "O" : "C", cx - 21, toY(Math.min(O, C)) + 4);

    const wr = (H - Math.max(O, C)) / range;
    const lwr = (Math.min(O, C) - L) / range;
    let type: string;
    let tone: Result["tone"];
    let explanation: string;

    if (isDoji) {
      type = "Doji";
      tone = "doji";
      explanation = "Open equals Close. Indecision — neither bulls nor bears won.";
    } else if (isBull) {
      const isHammer = lwr > 0.4 && (C - O) / range > 0.25;
      type = isHammer ? "Hammer / Bullish Pin Bar" : "Bullish Candle";
      tone = "bullish";
      explanation = isHammer
        ? "Long lower wick — buyers took control at support."
        : "Close greater than Open. Buyers dominated.";
    } else {
      const isStar = wr > 0.4 && (O - C) / range > 0.25;
      type = isStar ? "Shooting Star" : "Bearish Candle";
      tone = "bearish";
      explanation = isStar
        ? "Long upper wick — sellers took over at resistance."
        : "Close less than Open. Sellers dominated.";
    }

    setResult({
      type,
      tone,
      explanation,
      rangePips: Math.round((H - L) * 100),
      bodyPips: Math.round(Math.abs(C - O) * 100),
      color,
    });
  }

  function fillPreset(p: CandlestickPreset) {
    setOpen(String(p.o));
    setHigh(String(p.h));
    setLow(String(p.l));
    setClose(String(p.c));
    draw(p.o, p.h, p.l, p.c);
  }

  function handleDrawClick() {
    draw(parseFloat(open), parseFloat(high), parseFloat(low), parseFloat(close));
  }

  const toneClass =
    result?.tone === "bullish"
      ? "border-emerald-500 text-emerald-600"
      : result?.tone === "bearish"
        ? "border-red-500 text-red-600"
        : "border-amber-500 text-amber-600";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-sm font-semibold">🕯️ Candlestick Plotter</p>
      <p className="text-xs text-zinc-500">
        Tap an example to see it plotted, or enter your own OHLC values.
      </p>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => fillPreset(p)}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ci-open">Open</Label>
          <Input id="ci-open" type="number" step="0.01" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="2300" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ci-high">High</Label>
          <Input id="ci-high" type="number" step="0.01" value={high} onChange={(e) => setHigh(e.target.value)} placeholder="2320" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ci-low">Low</Label>
          <Input id="ci-low" type="number" step="0.01" value={low} onChange={(e) => setLow(e.target.value)} placeholder="2290" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ci-close">Close</Label>
          <Input id="ci-close" type="number" step="0.01" value={close} onChange={(e) => setClose(e.target.value)} placeholder="2315" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <canvas
          ref={canvasRef}
          width={100}
          height={200}
          className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        />
        {result && (
          <div className={`flex-1 rounded-md border p-3 text-sm ${toneClass}`}>
            <p className="font-semibold">{result.type}</p>
            <p className="mt-1 text-xs text-zinc-500">{result.explanation}</p>
            <p className="mt-2 text-xs text-zinc-400">
              Range: <strong>{result.rangePips} pips</strong> · Body:{" "}
              <strong>{result.bodyPips} pips</strong>
            </p>
          </div>
        )}
      </div>

      <Button onClick={handleDrawClick} className="self-start">
        Draw Candlestick
      </Button>
    </div>
  );
}
