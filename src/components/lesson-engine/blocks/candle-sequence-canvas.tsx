"use client";

import { useEffect, useRef } from "react";
import { drawCandleSequence, type OHLC } from "@/lib/candlestick";

export function CandleSequenceCanvas({
  candles,
  width = 140,
  height = 110,
  small = false,
}: {
  candles: OHLC[];
  width?: number;
  height?: number;
  small?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawCandleSequence(ctx, canvas.width, canvas.height, candles, small);
  }, [candles, small]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
