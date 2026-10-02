import { createClient } from "@/lib/supabase/server";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string;
  icon: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  platform: "Must-Have Apps",
  news: "Market News & Calendar",
  calculator: "Calculators",
  journal: "Trade Journal",
  broker_verification: "Broker Verification",
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select("id, title, description, category, url, icon")
    .eq("is_published", true)
    .order("order_index");

  const resources = (data as Resource[] | null) ?? [];
  const byCategory = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Resources
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Trader Toolkit</h1>
        <p className="text-sm text-muted-foreground">
          Everything you need before you start — all free.
        </p>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          {items.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
            >
              <span className="text-xl">{r.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      ))}

      {resources.length === 0 && (
        <p className="text-sm text-muted-foreground">No resources published yet.</p>
      )}
    </div>
  );
}
