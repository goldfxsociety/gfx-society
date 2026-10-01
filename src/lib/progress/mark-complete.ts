import { createClient } from "@/lib/supabase/client";

export async function markLessonComplete(lessonId: string) {
  const supabase = createClient();
  return supabase
    .from("lesson_progress")
    .upsert({ lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
}
