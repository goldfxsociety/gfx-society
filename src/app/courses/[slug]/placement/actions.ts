"use server";

import { createClient } from "@/lib/supabase/server";

export type PlacementResult =
  | { score: number; total: number; passed: boolean; cooldown_until?: string | null }
  | { passed: true; already: true }
  | { cooldown_until: string }
  | { error: true };

export async function submitPlacement(slug: string, answers: number[]): Promise<PlacementResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_placement_quiz", { p_course_slug: slug, p_answers: answers });
  if (error || !data) return { error: true };
  return data as PlacementResult;
}
