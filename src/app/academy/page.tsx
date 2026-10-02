import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AcademyPage() {
  const supabase = await createClient();
  const { data: levels } = await supabase
    .from("levels")
    .select("id, slug, title, description, order_index, lessons(count)")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          GFX Academy
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Your Learning Path
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        {(levels ?? []).map((level) => {
          const lessonCount = Array.isArray(level.lessons)
            ? (level.lessons[0] as { count: number } | undefined)?.count ?? 0
            : 0;
          return (
            <Link key={level.id} href={`/academy/${level.slug}`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle>{level.title}</CardTitle>
                  <CardDescription>{level.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(!levels || levels.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No levels published yet — check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
