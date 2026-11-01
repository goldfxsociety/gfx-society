"use server";

import { createClient } from "@/lib/supabase/server";

export type QuizResult = { score: number; total: number; passed: boolean; explains: string[] } | { error: true };

export async function submitQuiz(lessonId: string, answers: number[]): Promise<QuizResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lesson_quiz", { p_lesson_id: lessonId, p_answers: answers });
  if (error || !data) return { error: true };
  return data as QuizResult;
}

export async function setPracticeDone(lessonId: string, done: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_practice_done", { p_lesson_id: lessonId, p_done: done });
  return { ok: !error };
}
