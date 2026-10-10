export type CompetencyTier =
  | "No Data"
  | "Not Enough Data"
  | "Developing"
  | "Familiar"
  | "Strong Foundation";

/** A competency needs at least this many answered questions to get a rating (QA L5). */
export const MIN_ANSWERS_FOR_TIER = 3;
export type ConfidenceLevel = "Limited data" | "Standard";

export type DiagnosticAnswerRecord = {
  competencyKey: string;
  selectedIndex: number | null; // null = explicitly skipped
  correct: boolean | null; // null = skipped
};

export type CompetencyScore = {
  competencyKey: string;
  answered: number;
  correct: number;
  tier: CompetencyTier;
  confidence: ConfidenceLevel;
};

/**
 * Tier is computed from answered questions only — skipped questions never
 * enter the denominator, and are never treated as incorrect. 0% of 1+
 * answered lands in "Developing", never "No Data" — only a fully-skipped
 * competency (0 answered) is "No Data".
 */
export function computeTier(answered: number, correct: number): CompetencyTier {
  if (answered === 0) return "No Data";
  if (answered < MIN_ANSWERS_FOR_TIER) return "Not Enough Data";
  const pct = (correct / answered) * 100;
  if (pct < 50) return "Developing";
  if (pct < 80) return "Familiar";
  return "Strong Foundation";
}

/**
 * Confidence is independent of tier and evaluated per-session, not
 * hardcoded to any specific competency — any competency can land on
 * "Limited data" if the learner answered 0-1 of its questions this time.
 */
export function computeConfidence(answered: number): ConfidenceLevel {
  return answered < MIN_ANSWERS_FOR_TIER ? "Limited data" : "Standard";
}

/**
 * Tier to show/use for a stored score. Sessions completed before the
 * minimum-answers rule may have stored e.g. "Strong Foundation" from 1
 * answer, so recompute from the stored counts.
 */
export function effectiveTier(score: { answered: number; correct: number; tier: string }): string {
  if (typeof score.answered === "number" && typeof score.correct === "number") {
    return computeTier(score.answered, score.correct);
  }
  return score.tier;
}

export function computeCompetencyScores(
  answers: DiagnosticAnswerRecord[],
): Record<string, CompetencyScore> {
  const byCompetency = new Map<string, DiagnosticAnswerRecord[]>();
  for (const a of answers) {
    const list = byCompetency.get(a.competencyKey) ?? [];
    list.push(a);
    byCompetency.set(a.competencyKey, list);
  }

  const result: Record<string, CompetencyScore> = {};
  for (const [competencyKey, records] of byCompetency) {
    const answered = records.filter((r) => r.selectedIndex !== null).length;
    const correct = records.filter((r) => r.correct === true).length;
    result[competencyKey] = {
      competencyKey,
      answered,
      correct,
      tier: computeTier(answered, correct),
      confidence: computeConfidence(answered),
    };
  }
  return result;
}
