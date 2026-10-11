import { createClient } from "@/lib/supabase/server";

/** Reading time from lesson metadata (lessons.estimated_minutes): the single source (UX audit #7). */
export async function getLessonMinutes(slug: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lessons")
      .select("estimated_minutes")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    return data?.estimated_minutes ?? null;
  } catch {
    return null;
  }
}
