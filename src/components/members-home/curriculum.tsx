import Link from "next/link";
import { ME, STATE_ICON } from "@/config/members-home";
import { groupByModule, lessonState, type LessonRow } from "@/lib/training/courses";
import { ProgressBar } from "./progress-bar";

export function StateIcon({ state }: { state: keyof typeof STATE_ICON }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <span aria-hidden className={state === "done" ? "text-green-300" : state === "in_progress" ? "text-primary" : ""}>
        {STATE_ICON[state]}
      </span>
      <span>{ME.states[state]}</span>
    </span>
  );
}

export function Legend() {
  return (
    <p className="text-xs text-muted-foreground">
      {STATE_ICON.done} {ME.legend.done} · {STATE_ICON.in_progress} {ME.legend.in_progress} · {STATE_ICON.not_started} {ME.legend.not_started}
    </p>
  );
}

/**
 * Curriculum rail (spec §4.5): modules as accordions, the current module expanded with a gold border + "Current".
 * `collapsed` = the 360px accordion variant (whole rail collapsed, summary shows n/m).
 */
export function Curriculum({
  slug,
  lessons,
  hasCapstone,
  currentLessonId,
  collapsed = false,
  idPrefix,
}: {
  slug: string;
  lessons: LessonRow[];
  hasCapstone: boolean;
  currentLessonId?: string;
  collapsed?: boolean;
  /** Set on the instance that owns the #mod-N anchors (only one per page). */
  idPrefix?: string;
}) {
  const groups = groupByModule(lessons);
  const done = lessons.filter((l) => l.completed).length;
  const currentSort = lessons.find((l) => l.id === currentLessonId)?.moduleSort;
  const last = groups.at(-1);
  const body = (
    <div className="flex flex-col gap-3">
      <ProgressBar value={done} max={lessons.length} label={ME.railDone(done, lessons.length)} />
      <Legend />
      {groups.map((g) => {
        const current = g.sort === currentSort;
        return (
          <details
            key={g.sort}
            id={idPrefix ? `${idPrefix}${g.sort}` : undefined}
            open={current}
            className={current ? "rounded-lg border border-primary p-3" : "rounded-lg border border-border p-3"}
          >
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 font-medium">
              <span>{g.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {current && <span className="rounded-full border border-primary/60 px-2 py-0.5 text-primary">{ME.current}</span>}
                {g.done}/{g.lessons.length}
              </span>
            </summary>
            <ol className="mt-2 flex flex-col">
              {g.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={`/courses/${slug}/${l.slug}`}
                    aria-current={l.id === currentLessonId ? "step" : undefined}
                    className="flex min-h-11 items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 break-words underline">{l.title}</span>
                      <span className="shrink-0 rounded border border-border px-1.5 text-[11px] text-muted-foreground">{ME.quizTag}</span>
                    </span>
                    <StateIcon state={lessonState(l)} />
                  </Link>
                </li>
              ))}
              {hasCapstone && g === last && (
                <li>
                  <Link href={`/courses/${slug}/capstone`} className="flex min-h-11 items-center text-sm underline">
                    {ME.capstoneRow}
                  </Link>
                </li>
              )}
            </ol>
          </details>
        );
      })}
    </div>
  );
  if (!collapsed) return body;
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between font-semibold">
        <span>{ME.railTitle}</span>
        <span className="text-sm text-muted-foreground">
          {done}/{lessons.length}
        </span>
      </summary>
      <div className="mt-2">{body}</div>
    </details>
  );
}
