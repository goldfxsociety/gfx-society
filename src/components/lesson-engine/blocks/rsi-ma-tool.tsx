"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tone = "bullish" | "bearish" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  bullish: "text-emerald-600 dark:text-emerald-400",
  bearish: "text-red-600 dark:text-red-400",
  neutral: "text-amber-600 dark:text-amber-400",
};

function rsiVerdict(val: number): { verdict: string; desc: string; tone: Tone } {
  if (val < 30) {
    return {
      verdict: "Oversold",
      desc: "Watch for a possible bounce — not a guaranteed buy signal.",
      tone: "bullish",
    };
  }
  if (val > 70) {
    return {
      verdict: "Overbought",
      desc: "Watch for a possible pullback — not a guaranteed sell signal.",
      tone: "bearish",
    };
  }
  return {
    verdict: "Neutral Zone",
    desc: "No extreme reading — RSI alone isn't giving a strong signal here.",
    tone: "neutral",
  };
}

function crossVerdict(ma50: number, ma200: number): { verdict: string; desc: string; tone: Tone } {
  if (ma50 > ma200) {
    return {
      verdict: "Golden Cross",
      desc: "50 MA is above the 200 MA — generally read as bullish.",
      tone: "bullish",
    };
  }
  if (ma50 < ma200) {
    return {
      verdict: "Death Cross",
      desc: "50 MA is below the 200 MA — generally read as bearish.",
      tone: "bearish",
    };
  }
  return {
    verdict: "Right at the Cross",
    desc: "The two MAs are equal — watch closely for which way it breaks.",
    tone: "neutral",
  };
}

export function RsiMaTool() {
  const [rsiInput, setRsiInput] = useState("");
  const [rsiError, setRsiError] = useState("");
  const [rsiResult, setRsiResult] = useState<
    (ReturnType<typeof rsiVerdict> & { value: number }) | null
  >(null);

  const [ma50Input, setMa50Input] = useState("");
  const [ma200Input, setMa200Input] = useState("");
  const [crossError, setCrossError] = useState("");
  const [crossResult, setCrossResult] = useState<ReturnType<typeof crossVerdict> | null>(null);

  function handleRsiCheck(presetVal?: number) {
    const val = presetVal ?? parseFloat(rsiInput);
    if (presetVal !== undefined) setRsiInput(String(presetVal));
    if (Number.isNaN(val)) {
      setRsiError("Enter an RSI value first.");
      setRsiResult(null);
      return;
    }
    if (val < 0 || val > 100) {
      setRsiError("RSI must be between 0 and 100.");
      setRsiResult(null);
      return;
    }
    setRsiError("");
    setRsiResult({ ...rsiVerdict(val), value: val });
  }

  function handleCrossCheck(preset?: { ma50: number; ma200: number }) {
    const ma50 = preset ? preset.ma50 : parseFloat(ma50Input);
    const ma200 = preset ? preset.ma200 : parseFloat(ma200Input);
    if (preset) {
      setMa50Input(String(preset.ma50));
      setMa200Input(String(preset.ma200));
    }
    if ([ma50, ma200].some((v) => Number.isNaN(v))) {
      setCrossError("Enter both MA values first.");
      setCrossResult(null);
      return;
    }
    if (ma50 <= 0 || ma200 <= 0) {
      setCrossError("MA values must be greater than 0.");
      setCrossResult(null);
      return;
    }
    setCrossError("");
    setCrossResult(crossVerdict(ma50, ma200));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="text-sm font-semibold">📉 RSI Reader</p>
        <p className="text-xs text-zinc-500">Tap an example, or enter an RSI value.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleRsiCheck(25)}>
            RSI 25
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleRsiCheck(50)}>
            RSI 50
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleRsiCheck(75)}>
            RSI 75
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rsi-input">RSI Value (0–100)</Label>
          <Input
            id="rsi-input"
            type="number"
            value={rsiInput}
            onChange={(e) => setRsiInput(e.target.value)}
            placeholder="50"
          />
        </div>
        {rsiError && <p className="text-sm text-red-600">{rsiError}</p>}
        {rsiResult && (
          <div className="flex flex-col gap-2">
            <div className="relative h-3 w-full overflow-hidden rounded-full">
              <div className="absolute inset-y-0 left-0 w-[30%] bg-red-400" />
              <div className="absolute inset-y-0 left-[30%] w-[40%] bg-zinc-300 dark:bg-zinc-700" />
              <div className="absolute inset-y-0 left-[70%] w-[30%] bg-emerald-400" />
              <div
                className="absolute top-[-3px] h-[18px] w-0.5 bg-zinc-900 dark:bg-white"
                style={{ left: `calc(${Math.max(0, Math.min(100, rsiResult.value))}% - 1px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>0</span>
              <span>30</span>
              <span>70</span>
              <span>100</span>
            </div>
            <p className={`text-sm font-semibold ${TONE_CLASS[rsiResult.tone]}`}>
              {rsiResult.verdict} ({rsiResult.value})
            </p>
            <p className="text-xs text-zinc-500">{rsiResult.desc}</p>
          </div>
        )}
        <Button onClick={() => handleRsiCheck()} className="self-start">
          Check RSI
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="text-sm font-semibold">🔀 Golden / Death Cross Checker</p>
        <p className="text-xs text-zinc-500">Tap an example, or enter your own MA values.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCrossCheck({ ma50: 2350, ma200: 2300 })}
          >
            Golden Cross
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCrossCheck({ ma50: 2280, ma200: 2320 })}
          >
            Death Cross
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="cross-50">50 MA Value</Label>
            <Input
              id="cross-50"
              type="number"
              value={ma50Input}
              onChange={(e) => setMa50Input(e.target.value)}
              placeholder="2350"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cross-200">200 MA Value</Label>
            <Input
              id="cross-200"
              type="number"
              value={ma200Input}
              onChange={(e) => setMa200Input(e.target.value)}
              placeholder="2300"
            />
          </div>
        </div>
        {crossError && <p className="text-sm text-red-600">{crossError}</p>}
        {crossResult && (
          <div>
            <p className={`text-sm font-semibold ${TONE_CLASS[crossResult.tone]}`}>
              {crossResult.verdict}
            </p>
            <p className="text-xs text-zinc-500">{crossResult.desc}</p>
          </div>
        )}
        <Button onClick={() => handleCrossCheck()} className="self-start">
          Check Cross
        </Button>
      </div>
    </div>
  );
}
