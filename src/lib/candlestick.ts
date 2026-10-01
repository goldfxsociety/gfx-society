export type CandleTone = "doji" | "bullish" | "bearish";

export type CandleClassification = {
  type: string;
  tone: CandleTone;
  explanation: string;
  color: string;
};

export type OHLC = { o: number; h: number; l: number; c: number };

/** Ported from the original app's drawCandle() classification thresholds. */
export function classifyCandle(O: number, H: number, L: number, C: number): CandleClassification {
  const range = H - L || 1;
  const isBull = C >= O;
  const isDoji = Math.abs(C - O) / range < 0.05;
  const color = isDoji ? "#D4A017" : isBull ? "#3DCB8A" : "#E05555";
  const wr = (H - Math.max(O, C)) / range;
  const lwr = (Math.min(O, C) - L) / range;

  if (isDoji) {
    return {
      type: "Doji",
      tone: "doji",
      explanation: "Open equals Close. Indecision — neither bulls nor bears won.",
      color,
    };
  }

  if (isBull) {
    const isHammer = lwr > 0.4 && (C - O) / range > 0.25;
    return {
      type: isHammer ? "Hammer / Bullish Pin Bar" : "Bullish Candle",
      tone: "bullish",
      explanation: isHammer
        ? "Long lower wick — buyers took control at support."
        : "Close greater than Open. Buyers dominated.",
      color,
    };
  }

  const isStar = wr > 0.4 && (O - C) / range > 0.25;
  return {
    type: isStar ? "Shooting Star" : "Bearish Candle",
    tone: "bearish",
    explanation: isStar
      ? "Long upper wick — sellers took over at resistance."
      : "Close less than Open. Sellers dominated.",
    color,
  };
}

type Category =
  | "bullish-strong"
  | "bearish-strong"
  | "bullish-small"
  | "bearish-small"
  | "doji"
  | "hammer"
  | "shooting-star";

const CATEGORIES: Category[] = [
  "bullish-strong",
  "bearish-strong",
  "bullish-small",
  "bearish-small",
  "doji",
  "hammer",
  "shooting-star",
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Generates a random OHLC candle, picking a shape category first so the
 * full range of patterns (doji, hammer, shooting star, strong/small
 * bodies) actually shows up during practice instead of being left to
 * pure chance. Fractions are chosen to stay clear of classifyCandle's
 * thresholds in the intended direction (e.g. "small" bodies never
 * accidentally read as a hammer).
 */
export function generateRandomCandle(): OHLC {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const base = 2280 + Math.random() * 40;
  const range = 10 + Math.random() * 20;
  const L = base;
  const H = base + range;

  let bodyFrac: number;
  let upperFrac: number;
  let lowerFrac: number;
  let bullish: boolean;

  switch (category) {
    case "doji":
      bodyFrac = Math.random() * 0.04;
      upperFrac = Math.random() * (1 - bodyFrac);
      lowerFrac = 1 - bodyFrac - upperFrac;
      bullish = Math.random() < 0.5;
      break;
    case "hammer":
      upperFrac = 0.03 + Math.random() * 0.05;
      bodyFrac = 0.26 + Math.random() * 0.1;
      lowerFrac = 1 - upperFrac - bodyFrac;
      bullish = true;
      break;
    case "shooting-star":
      lowerFrac = 0.03 + Math.random() * 0.05;
      bodyFrac = 0.26 + Math.random() * 0.1;
      upperFrac = 1 - lowerFrac - bodyFrac;
      bullish = false;
      break;
    case "bullish-strong":
    case "bearish-strong":
      bodyFrac = 0.6 + Math.random() * 0.25;
      upperFrac = (1 - bodyFrac) / 2;
      lowerFrac = (1 - bodyFrac) / 2;
      bullish = category === "bullish-strong";
      break;
    default: // bullish-small / bearish-small
      bodyFrac = 0.22 + Math.random() * 0.18; // keeps wick fractions safely under 0.4
      upperFrac = (1 - bodyFrac) / 2;
      lowerFrac = (1 - bodyFrac) / 2;
      bullish = category === "bullish-small";
      break;
  }

  const bodyTop = H - range * upperFrac;
  const bodyBottom = bodyTop - range * bodyFrac;
  const o = bullish ? bodyBottom : bodyTop;
  const c = bullish ? bodyTop : bodyBottom;

  return { o: round2(o), h: round2(H), l: round2(L), c: round2(c) };
}
