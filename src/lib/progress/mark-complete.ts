import { createClient } from "@/lib/supabase/client";
import { logEvent } from "@/lib/analytics/log-event";

export async function markLessonComplete(lessonId: string) {
  const supabase = createClient();
  const result = await supabase
    .from("lesson_progress")
    .upsert({ lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });

  if (!result.error) {
    await logEvent("lesson_completed", lessonId);
    await checkAndLogLevelCompletion(supabase, lessonId);
  }

  return result;
}

async function checkAndLogLevelCompletion(
  supabase: ReturnType<typeof createClient>,
  lessonId: string,
) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("level_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) return;

  const { data: levelLessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("level_id", lesson.level_id);

  const levelLessonIds = (levelLessons ?? []).map((l) => l.id);
  if (levelLessonIds.length === 0) return;

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .in("lesson_id", levelLessonIds);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const allDone = levelLessonIds.every((id) => completedIds.has(id));
  if (allDone) {
    await logEvent("level_completed", lesson.level_id);
  }
}
