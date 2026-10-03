import { createClient } from "@/lib/supabase/client";

export async function recordAssessmentAttempt(
  lessonId: string,
  score: number,
  total: number,
  passed: boolean,
): Promise<number | null> {
  const supabase = createClient();

  const { count } = await supabase
    .from("assessment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);

  const attemptNumber = (count ?? 0) + 1;

  const { error } = await supabase.from("assessment_attempts").insert({
    lesson_id: lessonId,
    score,
    total,
    passed,
    attempt_number: attemptNumber,
  });

  return error ? null : attemptNumber;
}
