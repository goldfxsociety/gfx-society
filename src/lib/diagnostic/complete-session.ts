import { createClient } from "@/lib/supabase/client";
import { logEvent } from "@/lib/analytics/log-event";
import { computeCompetencyScores, type DiagnosticAnswerRecord, type CompetencyScore } from "./scoring";
import { recommendStartingPoint, type LessonRow } from "./recommendation";

type CompleteResult = {
  competencyScores: Record<string, CompetencyScore>;
  recommendedLessonId: string | null;
};

/**
 * Computes competency scores + a starting-point recommendation from the
 * learner's own answers plus their real lesson_progress/assessment_attempts
 * (read-only), then writes the result back onto diagnostic_sessions.
 *
 * Never writes to lesson_progress, assessment_attempts, or lessons —
 * only ever updates the caller's own diagnostic_sessions row.
 *
 * Idempotent: if the session is already completed, returns the stored
 * result instead of recomputing/re-logging (replay safety — this isn't
 * a security boundary, just correctness, since re-running this can only
 * ever affect the caller's own non-authoritative baseline record).
 */
export async function completeDiagnosticSession(sessionId: string): Promise<CompleteResult> {
  const supabase = createClient();

  const { data: session, error: sessionError } = await supabase
    .from("diagnostic_sessions")
    .select("id, status, competency_scores, recommended_lesson_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    throw sessionError ?? new Error("Diagnostic session not found");
  }

  if (session.status === "completed") {
    return {
      competencyScores: (session.competency_scores ?? {}) as Record<string, CompetencyScore>,
      recommendedLessonId: (session.recommended_lesson_id as string | null) ?? null,
    };
  }

  const { data: answersRaw } = await supabase
    .from("diagnostic_answers")
    .select("competency_key, selected_index, correct")
    .eq("session_id", sessionId);

  const answers: DiagnosticAnswerRecord[] = (answersRaw ?? []).map((a) => ({
    competencyKey: a.competency_key as string,
    selectedIndex: a.selected_index as number | null,
    correct: a.correct as boolean | null,
  }));

  const competencyScores = computeCompetencyScores(answers);

  const [{ data: lessonsRaw }, { data: progressRaw }, { data: attemptsRaw }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, level_id, order_index, competency_key, prerequisite_lesson_id, levels(order_index)")
      .eq("is_published", true),
    supabase.from("lesson_progress").select("lesson_id"),
    supabase
      .from("assessment_attempts")
      .select("lesson_id, passed, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const lessons: LessonRow[] = (lessonsRaw ?? []).map((l) => {
    const levelInfo = Array.isArray(l.levels) ? l.levels[0] : l.levels;
    return {
      id: l.id as string,
      levelId: l.level_id as string,
      levelOrderIndex: (levelInfo as { order_index: number } | undefined)?.order_index ?? 0,
      orderIndex: l.order_index as number,
      competencyKey: (l.competency_key as string | null) ?? null,
      prerequisiteLessonId: (l.prerequisite_lesson_id as string | null) ?? null,
    };
  });

  const completedLessonIds = new Set((progressRaw ?? []).map((p) => p.lesson_id as string));

  // "Struggling" = the most recent attempt for that lesson failed (ascending
  // order means the last write into the map is the most recent attempt).
  const latestPassedByLesson = new Map<string, boolean>();
  for (const a of attemptsRaw ?? []) {
    latestPassedByLesson.set(a.lesson_id as string, a.passed as boolean);
  }
  const strugglingLessonIds = new Set(
    [...latestPassedByLesson.entries()].filter(([, passed]) => !passed).map(([lessonId]) => lessonId),
  );

  const competencyTiers: Record<string, CompetencyScore["tier"]> = {};
  for (const [key, score] of Object.entries(competencyScores)) {
    competencyTiers[key] = score.tier;
  }

  const recommendation = recommendStartingPoint({
    lessons,
    completedLessonIds,
    strugglingLessonIds,
    competencyTiers,
  });

  const recommendedLessonId = recommendation.kind === "lesson" ? recommendation.lessonId : null;
  const recommendedLevelId = recommendedLessonId
    ? (lessons.find((l) => l.id === recommendedLessonId)?.levelId ?? null)
    : null;

  await supabase
    .from("diagnostic_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      competency_scores: competencyScores,
      recommended_lesson_id: recommendedLessonId,
      recommended_level_id: recommendedLevelId,
    })
    .eq("id", sessionId);

  await logEvent("diagnostic_completed", sessionId, { competency_scores: competencyScores });

  return { competencyScores, recommendedLessonId };
}
