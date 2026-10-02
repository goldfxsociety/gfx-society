"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { label: "40% · 1:2 RR", winRate: 40, rr: 2, risk: 10, trades: 10 },
  { label: "35% · 1:3 RR", winRate: 35, rr: 3, risk: 10, trades: 100 },
  { label: "40% · 1:1 RR", winRate: 40, rr: 1, risk: 10, trades: 10 },
];

function fmtUSD(n: number) {
  return (n < 0 ? "-$" : "+$") + Math.abs(n).toFixed(2);
}

export function RiskRewardCalculator() {
  const [winRate, setWinRate] = useState("");
  const [rrMultiple, setRrMultiple] = useState("");
  const [riskAmount, setRiskAmount] = useState("");
  const [trades, setTrades] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    verdict: string;
    tone: "bullish" | "bearish" | "neutral";
    expectancyR: number;
    expectancyUSD: number;
    projectedTotal: number;
    breakevenWinRate: number;
    warning: string | null;
  } | null>(null);

  function compute(preset?: (typeof PRESETS)[number]) {
    const wr = preset ? preset.winRate : parseFloat(winRate);
    const rr = preset ? preset.rr : parseFloat(rrMultiple);
    const risk = preset ? preset.risk : parseFloat(riskAmount);
    const n = preset ? preset.trades : parseFloat(trades);

    if (preset) {
      setWinRate(String(preset.winRate));
      setRrMultiple(String(preset.rr));
      setRiskAmount(String(preset.risk));
      setTrades(String(preset.trades));
    }

    if ([wr, rr, risk, n].some((v) => Number.isNaN(v))) {
      setError("Enter all 4 values first.");
      setResult(null);
      return;
    }
    if (wr < 0 || wr > 100) {
      setError("Win rate must be between 0 and 100.");
      setResult(null);
      return;
    }
    if (rr <= 0) {
      setError("Reward multiple must be greater than 0.");
      setResult(null);
      return;
    }
    if (risk <= 0) {
      setError("Risk per trade must be greater than 0.");
      setResult(null);
      return;
    }
    if (n <= 0) {
      setError("Number of trades must be greater than 0.");
      setResult(null);
      return;
    }
    setError("");

    const winRateFrac = wr / 100;
    const expectancyR = winRateFrac * rr - (1 - winRateFrac);
    const expectancyUSD = expectancyR * risk;
    const projectedTotal = expectancyUSD * n;
    const breakevenWinRate = 100 / (rr + 1);

    let verdict: string;
    let tone: "bullish" | "bearish" | "neutral";
    if (expectancyR > 0) {
      verdict = "Net Profit";
      tone = "bullish";
    } else if (expectancyR < 0) {
      verdict = "Net Loss";
      tone = "bearish";
    } else {
      verdict = "Break Even";
      tone = "neutral";
    }

    setResult({
      verdict,
      tone,
      expectancyR,
      expectancyUSD,
      projectedTotal,
      breakevenWinRate,
      warning: rr < 1 ? "⚠️ Reward smaller than risk — you'll need a high win rate just to survive." : null,
    });
  }

  const toneClass =
    result?.tone === "bullish"
      ? "text-emerald-600 dark:text-emerald-400"
      : result?.tone === "bearish"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-semibold">🧮 Risk-Reward Calculator</p>
      <p className="text-xs text-muted-foreground">Tap an example, or enter your own numbers.</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => compute(p)}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="rr-winrate">Win Rate (%)</Label>
          <Input id="rr-winrate" type="number" value={winRate} onChange={(e) => setWinRate(e.target.value)} placeholder="40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rr-multiple">Reward Multiple</Label>
          <Input id="rr-multiple" type="number" step="0.1" value={rrMultiple} onChange={(e) => setRrMultiple(e.target.value)} placeholder="2" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rr-risk">Risk per Trade ($)</Label>
          <Input id="rr-risk" type="number" step="0.01" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} placeholder="10" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rr-trades">Number of Trades</Label>
          <Input id="rr-trades" type="number" value={trades} onChange={(e) => setTrades(e.target.value)} placeholder="10" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className={`text-lg font-semibold ${toneClass}`}>{result.verdict}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expectancy: {result.expectancyR >= 0 ? "+" : ""}
            {result.expectancyR.toFixed(2)}R per trade ({fmtUSD(result.expectancyUSD)}).
            <br />
            Projected over trades entered: {fmtUSD(result.projectedTotal)}.
            <br />
            Break-even win rate at this RR: {result.breakevenWinRate.toFixed(1)}%.
          </p>
          {result.warning && <p className="mt-2 text-xs text-primary">{result.warning}</p>}
        </div>
      )}

      <Button onClick={() => compute()} className="self-start">
        Calculate
      </Button>
    </div>
  );
}
