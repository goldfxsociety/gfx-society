"use client";

import { useEffect, useRef } from "react";

export function CandlestickAnatomyDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const Ht = canvas.height;
    const pad = 30;
    // Fixed illustrative bullish candle (arbitrary units), not real price data.
    const O = 45,
      H = 75,
      L = 20,
      C = 62;
    const range = H - L;
    const toY = (v: number) => pad + ((H - v) / range) * (Ht - pad * 2);
    const color = "#3DCB8A";
    const cx = W / 2;
    const bTop = toY(C);
    const bBot = toY(O);
    const bH = Math.max(bBot - bTop, 2);

    ctx.clearRect(0, 0, W, Ht);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, toY(H));
    ctx.lineTo(cx, bTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, bBot);
    ctx.lineTo(cx, toY(L));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(cx - 22, bTop, 44, bH);
    ctx.fill();

    ctx.strokeStyle = "#8A7AAA";
    ctx.fillStyle = "#8A7AAA";
    ctx.font = "11px sans-serif";
    ctx.lineWidth = 1;

    function label(text: string, y: number, side: "l" | "r") {
      if (!ctx) return;
      const lx = side === "r" ? cx + 34 : cx - 34;
      ctx.textAlign = side === "r" ? "left" : "right";
      ctx.beginPath();
      ctx.moveTo(side === "r" ? cx + 24 : cx - 24, y);
      ctx.lineTo(lx - 4, y);
      ctx.stroke();
      ctx.fillText(text, lx, y + 3);
    }

    label("High (wick)", toY(H), "r");
    label("Body", (bTop + bBot) / 2, "r");
    label("Close", toY(C), "l");
    label("Open", toY(O), "l");
    label("Low (wick)", toY(L), "r");
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
      <canvas ref={canvasRef} width={240} height={180} />
      <p className="text-center text-xs text-muted-foreground">
        This is a <strong>bullish</strong> candle — Close is above Open, so
        the body is green. The thin lines above and below are the{" "}
        <strong>wicks</strong> (High and Low).
      </p>
    </div>
  );
}
