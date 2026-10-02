"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { label: "9:00 PM", h: 21, m: 0 },
  { label: "3:30 PM", h: 15, m: 30 },
  { label: "1:00 PM", h: 13, m: 0 },
];

export function SessionCheckerBlock() {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ label: string; desc: string; newsNote: string | null } | null>(null);

  function check(presetH?: number, presetM?: number) {
    const h = presetH ?? parseFloat(hour);
    const m = presetM ?? parseFloat(minute);
    if (presetH !== undefined) {
      setHour(String(presetH));
      setMinute(String(presetM));
    }

    if ([h, m].some((v) => Number.isNaN(v))) {
      setError("Enter both hour and minute first.");
      setResult(null);
      return;
    }
    if (h < 0 || h > 23) {
      setError("Hour must be between 0 and 23.");
      setResult(null);
      return;
    }
    if (m < 0 || m > 59) {
      setError("Minute must be between 0 and 59.");
      setResult(null);
      return;
    }
    setError("");

    const t = h * 60 + m;
    let verdict: string;
    let desc: string;
    if (t >= 21 * 60 && t < 24 * 60) {
      verdict = "London–NY Overlap";
      desc = "The best window — highest volatility of the day.";
    } else if (t >= 15 * 60 && t < 16 * 60) {
      verdict = "London Open";
      desc = "Session beginning, volatility increasing.";
    } else {
      verdict = "Outside the key windows";
      desc = "Generally lower volatility — no major session is opening right now.";
    }

    const nearNews =
      Math.abs(t - (20 * 60 + 30)) <= 15 || Math.abs(t - (21 * 60 + 30)) <= 15;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");

    setResult({
      label: `${hh}:${mm} — ${verdict}`,
      desc,
      newsNote: nearNews
        ? "📰 Heads up — this is close to a scheduled US news release (8:30/9:30 PM PHT). Expect a possible spike."
        : null,
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-semibold">🕐 Session Checker</p>
      <p className="text-xs text-muted-foreground">Tap an example, or enter a Manila time.</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => check(p.h, p.m)}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sc-hour">Hour (0–23, Manila time)</Label>
          <Input id="sc-hour" type="number" value={hour} onChange={(e) => setHour(e.target.value)} placeholder="21" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sc-minute">Minute (0–59)</Label>
          <Input id="sc-minute" type="number" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="0" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-lg font-semibold">{result.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.desc}</p>
          {result.newsNote && <p className="mt-2 text-xs text-primary">{result.newsNote}</p>}
        </div>
      )}

      <Button onClick={() => check()} className="self-start">
        Check Session
      </Button>
    </div>
  );
}
