import type { CompetencyScore } from "@/lib/diagnostic/scoring";

export type DemonstratedStatus = "No Evidence" | "Developing" | "Familiar" | "Strong Foundation";
export type AssessmentCoverage = "none" | "partial" | "full";

export type EvidenceLessonInput = {
  id: string;
  competencyKey: string | null;
  hasScoredAssessment: boolean; // lessons.passing_score !== null
};

export type AssessmentAttemptInput = {
  lessonId: string;
  passed: boolean;
  createdAt: string;
};

export type CompetencyEvidence = {
  competencyKey: string;
  total: number;
  completed: number;
  scoredTotal: number;
  struggling: boolean;
  status: DemonstratedStatus;
  coverage: AssessmentCoverage;
};

/**
 * Demonstrated-competency model, locked per the Phase 2B approval:
 *
 *   No Evidence        completed === 0 AND no assessment attempts exist at all
 *   Developing         struggling (latest attempt on some lesson failed, no
 *                       later pass) overrides everything else, OR
 *                       0 < completed/total < 50% with no struggling
 *   Familiar           50% <= completed/total < 100%, no struggling
 *   Strong Foundation  completed/total === 100%
 *
 * This is lesson_progress + assessment_attempts only — never the diagnostic.
 * `coverage` separately flags how much of this evidence is backed by a real
 * scored assessment vs. plain lesson completion, so thin competencies (0 or
 * partial scored lessons) can be presented honestly rather than implying the
 * same strength of evidence as a fully quiz-backed competency.
 */
export function computeCompetencyEvidence(
  lessons: EvidenceLessonInput[],
  completedLessonIds: Set<string>,
  attempts: AssessmentAttemptInput[],
): Record<string, CompetencyEvidence> {
  const sortedAttempts = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestPassedByLesson = new Map<string, boolean>();
  const anyAttemptByLesson = new Set<string>();
  for (const a of sortedAttempts) {
    latestPassedByLesson.set(a.lessonId, a.passed);
    anyAttemptByLesson.add(a.lessonId);
  }
  const strugglingLessonIds = new Set(
    [...latestPassedByLesson.entries()].filter(([, passed]) => !passed).map(([id]) => id),
  );

  const byCompetency = new Map<string, EvidenceLessonInput[]>();
  for (const l of lessons) {
    if (!l.competencyKey) continue;
    const list = byCompetency.get(l.competencyKey) ?? [];
    list.push(l);
    byCompetency.set(l.competencyKey, list);
  }

  const result: Record<string, CompetencyEvidence> = {};
  for (const [competencyKey, competencyLessons] of byCompetency) {
    const total = competencyLessons.length;
    const completed = competencyLessons.filter((l) => completedLessonIds.has(l.id)).length;
    const scoredTotal = competencyLessons.filter((l) => l.hasScoredAssessment).length;
    const struggling = competencyLessons.some((l) => strugglingLessonIds.has(l.id));
    const hasAnyAttempt = competencyLessons.some((l) => anyAttemptByLesson.has(l.id));

    const pct = total > 0 ? completed / total : 0;

    let status: DemonstratedStatus;
    if (completed === 0 && !hasAnyAttempt) {
      status = "No Evidence";
    } else if (struggling) {
      status = "Developing";
    } else if (pct >= 1) {
      status = "Strong Foundation";
    } else if (pct >= 0.5) {
      status = "Familiar";
    } else {
      status = "Developing";
    }

    const coverage: AssessmentCoverage =
      scoredTotal === 0 ? "none" : scoredTotal === total ? "full" : "partial";

    result[competencyKey] = { competencyKey, total, completed, scoredTotal, struggling, status, coverage };
  }
  return result;
}

/** Learner-friendly evidence line — no database terminology. */
export function describeEvidence(e: CompetencyEvidence): string {
  const lessonWord = e.total === 1 ? "lesson" : "lessons";
  if (e.coverage === "none") {
    return `${e.completed}/${e.total} ${lessonWord} completed — no scored assessment exists for this topic yet`;
  }
  if (e.coverage === "partial") {
    return `${e.completed}/${e.total} ${lessonWord} completed — assessment coverage is partial`;
  }
  return `${e.completed}/${e.total} ${lessonWord} completed`;
}

export type DiagnosticSessionSummary = {
  id: string;
  status: string;
  completedAt: string | null;
  competencyScores: Record<string, CompetencyScore> | null;
};

/**
 * Latest COMPLETED diagnostic session only — in_progress and abandoned
 * sessions are never eligible, regardless of how recent they are. Historical
 * sessions are never modified by this; it only ever picks which one to read.
 */
export function selectLatestCompletedSession(
  sessions: DiagnosticSessionSummary[],
): DiagnosticSessionSummary | null {
  const completed = sessions.filter((s) => s.status === "completed" && s.completedAt);
  if (completed.length === 0) return null;
  return [...completed].sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
  )[0];
}
