import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ levelSlug: string; lessonSlug: string }>;
}) {
  const { levelSlug, lessonSlug } = await params;
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("levels")
    .select("id, slug, title")
    .eq("slug", levelSlug)
    .eq("is_published", true)
    .single();

  if (!level) notFound();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("title, learning_objective, content, key_takeaways")
    .eq("level_id", level.id)
    .eq("slug", lessonSlug)
    .eq("is_published", true)
    .single();

  if (!lesson) notFound();

  const keyTakeaways = Array.isArray(lesson.key_takeaways)
    ? (lesson.key_takeaways as string[])
    : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link
        href={`/academy/${level.slug}`}
        className="text-sm text-zinc-500 underline"
      >
        ← Back to {level.title}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>

      {lesson.learning_objective && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <span className="font-semibold">Learning objective: </span>
          {lesson.learning_objective}
        </div>
      )}

      <div className="whitespace-pre-line text-sm leading-7 text-zinc-700 dark:text-zinc-300">
        {lesson.content}
      </div>

      {keyTakeaways.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-semibold">Key takeaways</p>
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
            {keyTakeaways.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
