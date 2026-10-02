"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { label: "$500 · 1%", bal: 500, risk: 1, sl: 30 },
  { label: "$1,000 · 2%", bal: 1000, risk: 2, sl: 50 },
  { label: "$5,000 · 0.5%", bal: 5000, risk: 0.5, sl: 20 },
];

const PIP_VALUE_PER_STANDARD_LOT = 1.0; // XAUUSD: 1 pip = $0.01, 1.0 lot = 100oz -> $1.00/pip

export function LotSizeCalculator() {
  const [balance, setBalance] = useState("");
  const [riskPct, setRiskPct] = useState("");
  const [slPips, setSlPips] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    lotSize: number;
    riskAmount: number;
    warnings: string[];
  } | null>(null);

  function compute(presetBal?: number, presetRisk?: number, presetSl?: number) {
    const bal = presetBal ?? parseFloat(balance);
    const risk = presetRisk ?? parseFloat(riskPct);
    const sl = presetSl ?? parseFloat(slPips);
    if (presetBal !== undefined) {
      setBalance(String(presetBal));
      setRiskPct(String(presetRisk));
      setSlPips(String(presetSl));
    }

    if ([bal, risk, sl].some((v) => Number.isNaN(v))) {
      setError("Enter all 3 values first.");
      setResult(null);
      return;
    }
    if (bal <= 0) {
      setError("Account balance must be greater than 0.");
      setResult(null);
      return;
    }
    if (risk <= 0) {
      setError("Risk % must be greater than 0.");
      setResult(null);
      return;
    }
    if (sl <= 0) {
      setError("Stop loss pips must be greater than 0.");
      setResult(null);
      return;
    }
    setError("");

    const riskAmount = bal * (risk / 100);
    const lotSize = Math.round((riskAmount / (sl * PIP_VALUE_PER_STANDARD_LOT)) * 100) / 100;

    const warnings: string[] = [];
    if (risk > 2) warnings.push(`⚠️ ${risk}% risk is above the recommended 1–2% max — consider lowering it.`);
    if (lotSize < 0.01) warnings.push("⚠️ Your risk is too small for this stop loss — it rounds to a 0.00 lot. Try a smaller SL or a higher risk %.");
    else if (lotSize > 10) warnings.push("⚠️ This is an unusually large position — double-check your numbers before using this in real trading.");

    setResult({ lotSize, riskAmount, warnings });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-semibold">🧮 Lot Size Calculator</p>
      <p className="text-xs text-muted-foreground">Tap an example, or enter your own account numbers.</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => compute(p.bal, p.risk, p.sl)}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lc-balance">Account Balance ($)</Label>
          <Input id="lc-balance" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="1000" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lc-risk">Risk per Trade (%)</Label>
          <Input id="lc-risk" type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="1" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lc-sl">Stop Loss (pips)</Label>
          <Input id="lc-sl" type="number" step="1" value={slPips} onChange={(e) => setSlPips(e.target.value)} placeholder="50" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-lg font-semibold">{result.lotSize.toFixed(2)} lot</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Risking ${result.riskAmount.toFixed(2)} on this stop loss.
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="mt-2 text-xs text-primary">
              {w}
            </p>
          ))}
        </div>
      )}

      <Button onClick={() => compute()} className="self-start">
        Calculate Lot Size
      </Button>
    </div>
  );
}
