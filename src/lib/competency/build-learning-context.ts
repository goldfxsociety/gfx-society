import { createClient } from "@/lib/supabase/server";
import { effectiveTier, type CompetencyTier, type CompetencyScore } from "@/lib/diagnostic/scoring";
import type { AssessmentAttemptInput } from "@/lib/competency/evidence";

/**
 * Superset of what recommendStartingPoint() and computeCompetencyEvidence()
 * each need, plus the display fields /learning and /dashboard both want
 * (slug/title/level info) — structurally compatible with both functions'
 * narrower input shapes, so this can be passed straight into either without
 * remapping.
 */
export type LearningLesson = {
  id: string;
  slug: string;
  title: string;
  learningObjective: string | null;
  levelId: string;
  levelSlug: string;
  levelTitle: string;
  levelOrderIndex: number;
  orderIndex: number;
  competencyKey: string | null;
  prerequisiteLessonId: string | null;
  hasScoredAssessment: boolean;
};

export type LearningContext = {
  lessons: LearningLesson[];
  completedLessonIds: Set<string>;
  strugglingLessonIds: Set<string>;
  competencyTiers: Record<string, CompetencyTier>;
  baselineScores: Record<string, CompetencyScore> | null;
  /** Raw attempts, exposed for callers (e.g. the Dashboard) that also need
   * to feed computeCompetencyEvidence(), which derives its own struggling
   * set internally rather than accepting a pre-computed one. */
  attempts: AssessmentAttemptInput[];
};

type LevelRow = {
  id: string;
  slug: string;
  title: string;
  order_index: number;
  lessons: {
    id: string;
    slug: string;
    title: string;
    learning_objective: string | null;
    order_index: number;
    competency_key: string | null;
    prerequisite_lesson_id: string | null;
    passing_score: number | null;
  }[];
};

/**
 * Assembles the one shared context both /learning and /dashboard need.
 * Read-only — never writes to lesson_progress, assessment_attempts, or
 * diagnostic_sessions. Mirrors the data-gathering already proven in
 * src/lib/diagnostic/complete-session.ts (left untouched intentionally)
 * and the dashboard's own prior inline version (now replaced by this).
 */
export async function buildLearningContext(): Promise<LearningContext> {
  const supabase = await createClient();

  const [{ data: levelsData }, { data: progress }, { data: attemptsRaw }, { data: latestDiagnostic }] =
    await Promise.all([
      supabase
        .from("levels")
        .select(
          "id, slug, title, order_index, lessons(id, slug, title, learning_objective, order_index, competency_key, prerequisite_lesson_id, passing_score)",
        )
        .eq("is_published", true)
        .order("order_index"),
      supabase.from("lesson_progress").select("lesson_id"),
      supabase.from("assessment_attempts").select("lesson_id, passed, created_at"),
      supabase
        .from("diagnostic_sessions")
        .select("competency_scores")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const levels = (levelsData as LevelRow[] | null) ?? [];

  const lessons: LearningLesson[] = levels.flatMap((lvl) =>
    lvl.lessons.map((les) => ({
      id: les.id,
      slug: les.slug,
      title: les.title,
      learningObjective: les.learning_objective,
      levelId: lvl.id,
      levelSlug: lvl.slug,
      levelTitle: lvl.title,
      levelOrderIndex: lvl.order_index,
      orderIndex: les.order_index,
      competencyKey: les.competency_key,
      prerequisiteLessonId: les.prerequisite_lesson_id,
      hasScoredAssessment: les.passing_score != null,
    })),
  );

  const completedLessonIds = new Set((progress ?? []).map((p) => p.lesson_id as string));

  const rawAttempts = (attemptsRaw ?? []) as { lesson_id: string; passed: boolean; created_at: string }[];
  const attempts: AssessmentAttemptInput[] = rawAttempts.map((a) => ({
    lessonId: a.lesson_id,
    passed: a.passed,
    createdAt: a.created_at,
  }));

  const sortedAttempts = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestPassedByLesson = new Map<string, boolean>();
  for (const a of sortedAttempts) {
    latestPassedByLesson.set(a.lessonId, a.passed);
  }
  const strugglingLessonIds = new Set(
    [...latestPassedByLesson.entries()].filter(([, passed]) => !passed).map(([id]) => id),
  );

  const baselineScores = (latestDiagnostic?.competency_scores ?? null) as Record<
    string,
    CompetencyScore
  > | null;

  const competencyTiers: Record<string, CompetencyTier> = {};
  if (baselineScores) {
    for (const [key, score] of Object.entries(baselineScores)) {
      competencyTiers[key] = effectiveTier(score) as CompetencyTier;
    }
  }

  return { lessons, completedLessonIds, strugglingLessonIds, competencyTiers, baselineScores, attempts };
}
