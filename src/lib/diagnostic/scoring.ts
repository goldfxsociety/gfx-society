export type CompetencyTier = "No Data" | "Developing" | "Familiar" | "Strong Foundation";
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
  return answered <= 1 ? "Limited data" : "Standard";
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
