import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const STATIC = ["", "/start", "/academy", "/diagnostic", "/resources", "/community", "/broker", "/signup"]; // add "/privacy", "/terms", "/risk", "/disclosure" when PR #3 merges

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : p === "/academy" || p === "/start" ? 0.9 : 0.5,
  }));

  try {
    // Public, published content only (anon key, RLS: is_published = true).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: levels } = await supabase.from("levels").select("id, slug").eq("is_published", true);
    const { data: lessons } = await supabase
      .from("lessons")
      .select("slug, level_id, updated_at")
      .eq("is_published", true);
    const bySlug = new Map((levels ?? []).map((l) => [l.id, l.slug as string]));
    for (const l of levels ?? []) {
      entries.push({ url: `${SITE_URL}/academy/${l.slug}`, changeFrequency: "weekly", priority: 0.7 });
    }
    for (const ls of lessons ?? []) {
      const lv = bySlug.get(ls.level_id);
      if (!lv) continue;
      entries.push({
        url: `${SITE_URL}/academy/${lv}/${ls.slug}`,
        lastModified: ls.updated_at ?? undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Sitemap still serves static routes if Supabase is unreachable.
  }
  return entries;
}
