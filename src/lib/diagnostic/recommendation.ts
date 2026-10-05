import type { CompetencyTier } from "./scoring";

export type LessonRow = {
  id: string;
  levelId: string;
  levelOrderIndex: number;
  orderIndex: number;
  competencyKey: string | null;
  prerequisiteLessonId: string | null;
};

export type RecommendationInput = {
  lessons: LessonRow[];
  completedLessonIds: Set<string>;
  strugglingLessonIds: Set<string>;
  competencyTiers: Record<string, CompetencyTier>;
};

export type Recommendation =
  | { kind: "lesson"; lessonId: string; reason: "meaningful_gap" | "prerequisite" | "continue" }
  | { kind: "complete" };

const TIERS_NEEDING_ATTENTION: CompetencyTier[] = ["No Data", "Developing"];

/**
 * Lowest meaningful learning gap -> prerequisite chain -> earliest
 * appropriate incomplete lesson -> recommended starting point.
 *
 * This never writes to lesson_progress/assessment_attempts/competency_key —
 * it only reads them (plus the diagnostic's own competency tiers) to pick
 * one lesson id to suggest.
 */
export function recommendStartingPoint(input: RecommendationInput): Recommendation {
  const { lessons, completedLessonIds, strugglingLessonIds, competencyTiers } = input;

  // Deterministic curriculum order. The competency_key ASC tertiary key is
  // a documented tie-break for the case where two lessons could otherwise
  // share an ordering position — unreachable with today's data (order_index
  // is unique per level) but kept explicit rather than left to incidental
  // array/sort order.
  const sorted = [...lessons].sort(
    (a, b) =>
      a.levelOrderIndex - b.levelOrderIndex ||
      a.orderIndex - b.orderIndex ||
      (a.competencyKey ?? "").localeCompare(b.competencyKey ?? ""),
  );

  const byCompetency = new Map<string, LessonRow[]>();
  const competencyOrder: string[] = [];
  for (const lesson of sorted) {
    if (!lesson.competencyKey) continue;
    if (!byCompetency.has(lesson.competencyKey)) {
      byCompetency.set(lesson.competencyKey, []);
      competencyOrder.push(lesson.competencyKey);
    }
    byCompetency.get(lesson.competencyKey)!.push(lesson);
  }

  for (const competencyKey of competencyOrder) {
    const competencyLessons = byCompetency.get(competencyKey)!;
    const allComplete = competencyLessons.every((l) => completedLessonIds.has(l.id));
    if (allComplete) continue;

    const tier = competencyTiers[competencyKey];
    const hasStruggling = competencyLessons.some((l) => strugglingLessonIds.has(l.id));
    // Current demonstrated struggle always counts as a meaningful gap,
    // regardless of what the diagnostic once said — fresh evidence from
    // actually attempting the material outranks a cold-start guess. This is
    // the one behavior change beyond the fallback-skip below: previously a
    // "Strong Foundation"/"Familiar" diagnostic tier could mask a real,
    // current failure in that same competency.
    const isMeaningfulGap = hasStruggling || (tier && TIERS_NEEDING_ATTENTION.includes(tier));
    if (!isMeaningfulGap) continue;

    const targetLesson = competencyLessons.find((l) => !completedLessonIds.has(l.id));
    if (!targetLesson) continue; // guarded by allComplete above, but keeps types honest

    const resolved = walkPrerequisiteChain(targetLesson, lessons, completedLessonIds, competencyTiers);
    return {
      kind: "lesson",
      lessonId: resolved.id,
      reason: resolved.id === targetLesson.id ? "meaningful_gap" : "prerequisite",
    };
  }

  // No meaningful gap found anywhere — fall back to "continue where you left off".
  // Prefer an incomplete lesson outside any competency already diagnosed
  // "Strong Foundation" first — an experienced learner shouldn't be funneled
  // through confirmed-strong material just because they haven't clicked it
  // yet. When competencyTiers is {} (no diagnostic taken), every lookup is
  // undefined, undefined !== "Strong Foundation" is always true, so this is
  // identical to the old behavior for anyone without a diagnostic. If every
  // remaining incomplete lesson belongs to a Strong Foundation competency,
  // this falls through to the original fallback unchanged.
  const nextIncompleteNonStrong = sorted.find(
    (l) => !completedLessonIds.has(l.id) && competencyTiers[l.competencyKey ?? ""] !== "Strong Foundation",
  );
  const nextIncomplete = nextIncompleteNonStrong ?? sorted.find((l) => !completedLessonIds.has(l.id));
  if (!nextIncomplete) {
    return { kind: "complete" };
  }
  const resolved = walkPrerequisiteChain(nextIncomplete, lessons, completedLessonIds, competencyTiers);
  return { kind: "lesson", lessonId: resolved.id, reason: "continue" };
}

/**
 * A prerequisite whose own competency is already diagnosed "Strong
 * Foundation" is treated as already-known — the walk stops and returns the
 * current lesson rather than routing the learner backward into confirmed
 * material. Mirrors the Strong-Foundation skip already applied in the
 * fallback branch above, but at the per-step prerequisite level.
 */
function walkPrerequisiteChain(
  lesson: LessonRow,
  allLessons: LessonRow[],
  completedLessonIds: Set<string>,
  competencyTiers: Record<string, CompetencyTier>,
  depth = 0,
): LessonRow {
  if (depth > 10) return lesson; // safety valve, not expected to ever trigger
  if (!lesson.prerequisiteLessonId) return lesson;
  if (completedLessonIds.has(lesson.prerequisiteLessonId)) return lesson;
  const prerequisite = allLessons.find((l) => l.id === lesson.prerequisiteLessonId);
  if (!prerequisite) return lesson;
  if (competencyTiers[prerequisite.competencyKey ?? ""] === "Strong Foundation") return lesson;
  return walkPrerequisiteChain(prerequisite, allLessons, completedLessonIds, competencyTiers, depth + 1);
}
