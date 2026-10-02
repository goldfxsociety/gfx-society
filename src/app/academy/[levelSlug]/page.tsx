import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LevelPage({
  params,
}: {
  params: Promise<{ levelSlug: string }>;
}) {
  const { levelSlug } = await params;
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("levels")
    .select("id, slug, title, description")
    .eq("slug", levelSlug)
    .eq("is_published", true)
    .single();

  if (!level) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, estimated_minutes, order_index")
    .eq("level_id", level.id)
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/academy" className="text-sm text-muted-foreground underline">
          ← Back to Academy
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{level.title}</h1>
        <p className="text-sm text-muted-foreground">{level.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {(lessons ?? []).map((lesson, i) => (
          <Link key={lesson.id} href={`/academy/${level.slug}/${lesson.slug}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">
                  {i + 1}. {lesson.title}
                </CardTitle>
                {lesson.estimated_minutes && (
                  <CardDescription>
                    {lesson.estimated_minutes} min
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
