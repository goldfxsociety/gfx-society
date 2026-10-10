import { seededRandom } from "@/lib/candlestick";

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Stable per-session, per-question display order of a question's options
 * (QA L1). Returns the ORIGINAL option indexes in display order, so the
 * value sent to submit_diagnostic_answer is always the original index and
 * server-side grading (against correct_index) stays correct. The same
 * session always gets the same order (refresh/back-safe, SSR-safe).
 */
export function optionOrder(sessionId: string, questionId: string, count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const rand = seededRandom(hashSeed(`${sessionId}:${questionId}`));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
