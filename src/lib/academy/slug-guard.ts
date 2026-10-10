// Real 404s for unknown Academy slugs (QA B4).
//
// The Academy routes have loading.tsx, so Next.js streams the page and commits
// HTTP 200 before the page's notFound() runs (documented Next.js behaviour).
// The proxy checks the slug first, using a small per-instance cache of
// published level/lesson slugs (one anon-key REST call per 5 minutes).
// On any lookup error it fails open (the page's own notFound() still renders).

type SlugIndex = { levels: Set<string>; lessons: Set<string> };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; index: SlugIndex } | null = null;

async function loadIndex(): Promise<SlugIndex | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const [lv, ls] = await Promise.all([
      fetch(`${url}/rest/v1/levels?select=slug&is_published=eq.true`, { headers, cache: "no-store" }),
      fetch(
        `${url}/rest/v1/lessons?select=slug,levels!inner(slug)&is_published=eq.true&levels.is_published=eq.true`,
        { headers, cache: "no-store" },
      ),
    ]);
    if (!lv.ok || !ls.ok) return null;
    const levels = (await lv.json()) as { slug: string }[];
    const lessons = (await ls.json()) as { slug: string; levels: { slug: string } | { slug: string }[] }[];
    const index: SlugIndex = {
      levels: new Set(levels.map((l) => l.slug)),
      lessons: new Set(
        lessons.flatMap((l) =>
          (Array.isArray(l.levels) ? l.levels : [l.levels]).map((lv2) => `${lv2.slug}/${l.slug}`),
        ),
      ),
    };
    if (index.levels.size === 0) return null; // don't cache an empty/odd result
    cache = { at: Date.now(), index };
    return index;
  } catch {
    return null;
  }
}

/** Returns true only when we're sure the /academy/... path doesn't exist. */
export async function isUnknownAcademyPath(pathname: string): Promise<boolean> {
  const m = pathname.match(/^\/academy\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!m) return false;
  const index = await loadIndex();
  if (!index) return false;
  const [, level, lesson] = m;
  if (!index.levels.has(decodeURIComponent(level))) return true;
  if (lesson && !index.lessons.has(`${decodeURIComponent(level)}/${decodeURIComponent(lesson)}`)) return true;
  return false;
}
