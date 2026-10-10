import type { SupabaseClient } from "@supabase/supabase-js";

export type NavLesson = { slug: string; title: string; levelSlug: string; levelTitle: string };

/** All published lessons in Academy order (level order, then lesson order). */
export async function getLessonSequence(supabase: SupabaseClient): Promise<NavLesson[]> {
  const { data: levels } = await supabase
    .from("levels")
    .select("id, slug, title, order_index")
    .eq("is_published", true)
    .order("order_index");
  const { data: lessons } = await supabase
    .from("lessons")
    .select("slug, title, level_id, order_index")
    .eq("is_published", true)
    .order("order_index");
  const out: NavLesson[] = [];
  for (const lv of levels ?? []) {
    for (const l of (lessons ?? []).filter((x) => x.level_id === lv.id)) {
      out.push({ slug: l.slug, title: l.title, levelSlug: lv.slug, levelTitle: lv.title });
    }
  }
  return out;
}
