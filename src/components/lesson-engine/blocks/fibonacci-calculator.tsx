"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RATIOS = [0.382, 0.5, 0.618, 0.786];

export function FibonacciCalculator() {
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<{ ratio: number; price: number }[] | null>(null);

  function compute(presetLow?: number, presetHigh?: number) {
    const l = presetLow ?? parseFloat(low);
    const h = presetHigh ?? parseFloat(high);
    if (presetLow !== undefined && presetHigh !== undefined) {
      setLow(String(presetLow));
      setHigh(String(presetHigh));
    }
    if ([l, h].some((v) => Number.isNaN(v))) {
      setError("Enter both swing values first.");
      setLevels(null);
      return;
    }
    if (h <= l) {
      setError("Swing High must be greater than Swing Low.");
      setLevels(null);
      return;
    }
    setError("");
    const range = h - l;
    setLevels(RATIOS.map((ratio) => ({ ratio, price: h - range * ratio })));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-sm font-semibold">📐 Fibonacci Calculator</p>
      <p className="text-xs text-zinc-500">Tap an example, or enter a real swing.</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => compute(2300, 2350)}>
          $2,300 → $2,350
        </Button>
        <Button variant="outline" size="sm" onClick={() => compute(2250, 2380)}>
          $2,250 → $2,380
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fib-low">Swing Low ($)</Label>
          <Input
            id="fib-low"
            type="number"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            placeholder="2300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="fib-high">Swing High ($)</Label>
          <Input
            id="fib-high"
            type="number"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            placeholder="2350"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {levels && (
        <div className="flex flex-col gap-2">
          {levels.map((l) => (
            <div
              key={l.ratio}
              className={`rounded-md border p-3 text-sm ${
                l.ratio === 0.618
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <p className="font-semibold">
                {(l.ratio * 100).toFixed(1)}% — ${l.price.toFixed(2)}
              </p>
              {l.ratio === 0.618 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⭐ Golden Ratio — strongest level
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button onClick={() => compute()} className="self-start">
        Calculate Levels
      </Button>
    </div>
  );
}
