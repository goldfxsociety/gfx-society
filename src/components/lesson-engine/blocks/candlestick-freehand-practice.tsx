"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { classifyCandle, generateRandomCandle, type OHLC } from "@/lib/candlestick";

const PEN_COLORS: { label: string; value: string }[] = [
  { label: "Black", value: "#111111" },
  { label: "Red", value: "#E05555" },
  { label: "Blue", value: "#1E88E5" },
  { label: "Green", value: "#3DCB8A" },
];

const W = 320;
const HT = 260;
const LEFT_PAD = 38;
const TOP_PAD = 16;
const BOTTOM_PAD = 16;
const USER_CX = LEFT_PAD + (W - LEFT_PAD) * 0.3;
const ANSWER_CX = LEFT_PAD + (W - LEFT_PAD) * 0.72;

export function CandlestickFreehandPractice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const drawingRef = useRef(false);

  const [ohlc, setOhlc] = useState<OHLC>(() => generateRandomCandle());
  const [showAnswer, setShowAnswer] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pad = (ohlc.h - ohlc.l) * 0.2 || 1;
    const gridMin = ohlc.l - pad;
    const gridMax = ohlc.h + pad;
    const toY = (price: number) =>
      TOP_PAD + ((gridMax - price) / (gridMax - gridMin)) * (HT - TOP_PAD - BOTTOM_PAD);

    ctx.clearRect(0, 0, W, HT);

    // price grid
    ctx.strokeStyle = "#E5E7EB";
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.lineWidth = 1;
    const lines = 8;
    for (let i = 0; i <= lines; i++) {
      const price = gridMin + ((gridMax - gridMin) * i) / lines;
      const y = toY(price);
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(price.toFixed(2), LEFT_PAD - 6, y + 3);
    }

    // column labels
    ctx.textAlign = "center";
    ctx.fillStyle = "#9CA3AF";
    ctx.fillText("Your drawing", USER_CX, 10);
    if (showAnswer) ctx.fillText("Answer", ANSWER_CX, 10);

    // user's freehand strokes
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = penColor;
    strokesRef.current.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    // revealed answer candle
    if (showAnswer) {
      const { o, h, l, c } = ohlc;
      const { color } = classifyCandle(o, h, l, c);
      const isBull = c >= o;
      const bTop = toY(Math.max(o, c));
      const bBot = toY(Math.min(o, c));
      const bH = Math.max(bBot - bTop, 2);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ANSWER_CX, toY(h));
      ctx.lineTo(ANSWER_CX, bTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ANSWER_CX, bBot);
      ctx.lineTo(ANSWER_CX, toY(l));
      ctx.stroke();
      ctx.fillStyle = isBull ? color : "transparent";
      ctx.beginPath();
      ctx.rect(ANSWER_CX - 16, bTop, 32, bH);
      ctx.fill();
      ctx.stroke();
    }
  }, [ohlc, showAnswer, penColor]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function pointerPos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current.push([pointerPos(e)]);
    redraw();
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    strokesRef.current[strokesRef.current.length - 1].push(pointerPos(e));
    redraw();
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function handleNewExample() {
    strokesRef.current = [];
    setShowAnswer(false);
    setOhlc(generateRandomCandle());
  }

  function handleClear() {
    strokesRef.current = [];
    redraw();
  }

  const result = showAnswer ? classifyCandle(ohlc.o, ohlc.h, ohlc.l, ohlc.c) : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-semibold">✏️ Practice: Draw the Candle Yourself</p>
      <p className="text-xs text-muted-foreground">
        Given these OHLC values, sketch what you think the candlestick looks
        like on the left side of the chart — then tap &quot;Show Answer&quot;
        to see the real one drawn next to it.
      </p>

      <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        <span>Open: {ohlc.o.toFixed(2)}</span>
        <span>High: {ohlc.h.toFixed(2)}</span>
        <span>Low: {ohlc.l.toFixed(2)}</span>
        <span>Close: {ohlc.c.toFixed(2)}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={HT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: "none", width: "100%", maxWidth: W, height: "auto" }}
        className="cursor-crosshair rounded-md border border-border bg-white"
      />

      {result && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-semibold">{result.type}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.explanation}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleNewExample}>New Example</Button>
        <Button variant="outline" onClick={handleClear}>
          Clear Drawing
        </Button>
        <Button variant="outline" onClick={() => setShowAnswer(true)}>
          Show Answer
        </Button>
        <select
          value={penColor}
          onChange={(e) => setPenColor(e.target.value)}
          className="rounded-md border border-border bg-white px-2 py-1 text-xs text-zinc-900"
          aria-label="Pen color"
        >
          {PEN_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
