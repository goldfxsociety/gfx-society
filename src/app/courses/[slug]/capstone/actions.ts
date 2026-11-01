"use server";

import { createClient } from "@/lib/supabase/server";

export async function setCapstoneItems(courseId: string, ticked: number[]): Promise<{ ok: boolean; done?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_capstone_items", { p_course_id: courseId, p_ticked: ticked });
  if (error) return { ok: false };
  return { ok: true, done: Boolean((data as { done?: boolean })?.done) };
}
