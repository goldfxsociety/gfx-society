/**
 * Next action on a course the member can already open.
 * Order: unfinished accessible lesson → applicable unfinished capstone → explicit review.
 * A finished lesson list never restarts at lesson one under a continue label.
 * `unpublished` and `absent` are not applicable: no curriculum row and no capstone CTA.
 */

export const CONTINUE_COPY = {
  capstone: "Lessons tapos na. Ituloy ang capstone.",
  review: "Course tapos na. Balikan ang lessons.",
} as const;

/** Wrap long Taglish CTAs inside 360px and keep a 44px target (button defaults are nowrap / h-8). */
export const CONTINUE_ACTION_CLASS =
  "h-auto min-h-11 w-full max-w-full whitespace-normal py-2 text-center break-words sm:w-auto sm:self-start";

export type ContinueLesson = {
  id: string;
  slug: string;
  title: string;
  completed: boolean;
};

export type CapstoneState = "absent" | "unpublished" | "unfinished" | "completed";

export type CapstoneAvailability = { state: CapstoneState };

/** DB read: a visible row is unfinished or completed. No row is absent. Unpublished is not a stored flag. */
export function capstoneAvailability(status: { exists: boolean; done: boolean }): CapstoneAvailability {
  if (!status.exists) return { state: "absent" };
  return { state: status.done ? "completed" : "unfinished" };
}

export type ContinueResolution<T extends ContinueLesson = ContinueLesson> =
  | { kind: "lesson"; lesson: T }
  | { kind: "capstone" }
  | { kind: "review"; lesson: T }
  | { kind: "empty" };

export function resolveContinue<T extends ContinueLesson>(
  lessons: readonly T[],
  capstone: CapstoneAvailability,
): ContinueResolution<T> {
  const unfinished = lessons.find((lesson) => !lesson.completed);
  if (unfinished) return { kind: "lesson", lesson: unfinished };
  if (lessons.length === 0) return { kind: "empty" };
  if (capstone.state === "unfinished") return { kind: "capstone" };
  const first = lessons[0];
  if (!first) return { kind: "empty" };
  return { kind: "review", lesson: first };
}

/** First accessible lesson still open. Undefined when every lesson is complete or the list is empty. */
export function unfinishedLesson<T extends ContinueLesson>(lessons: readonly T[]): T | undefined {
  const action = resolveContinue(lessons, { state: "absent" });
  return action.kind === "lesson" ? action.lesson : undefined;
}

export function continueHref<T extends ContinueLesson>(
  courseSlug: string,
  resolution: ContinueResolution<T>,
): string | null {
  switch (resolution.kind) {
    case "lesson":
    case "review":
      return `/courses/${courseSlug}/${resolution.lesson.slug}`;
    case "capstone":
      return `/courses/${courseSlug}/capstone`;
    case "empty":
      return null;
  }
}

/** Lesson states keep the caller's start/resume labels. Finished states use the approved sentences. */
export function continueLabel<T extends ContinueLesson>(
  resolution: ContinueResolution<T>,
  lessonsDone: number,
  labels: { start: string; resume: string },
): string | null {
  switch (resolution.kind) {
    case "lesson":
      return lessonsDone === 0 ? labels.start : labels.resume;
    case "capstone":
      return CONTINUE_COPY.capstone;
    case "review":
      return CONTINUE_COPY.review;
    case "empty":
      return null;
  }
}

/** Curriculum capstone row: only for a course that has lessons and a visible capstone. */
export function showCurriculumCapstone(lessonCount: number, capstone: CapstoneAvailability): boolean {
  return lessonCount > 0 && (capstone.state === "unfinished" || capstone.state === "completed");
}
