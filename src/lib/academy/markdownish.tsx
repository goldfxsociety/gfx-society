import { Fragment } from "react";

/**
 * Lesson content renderer. Lines starting with "## " become real <h2> section
 * headings (UX audit #4); everything else keeps the existing pre-line paragraph
 * rendering, so lessons without "## " look exactly as before.
 */
export function LessonContent({ content }: { content: string }) {
  const parts: { h?: string; body: string[] }[] = [{ body: [] }];
  for (const line of content.split("\n")) {
    if (line.startsWith("## ")) parts.push({ h: line.slice(3).trim(), body: [] });
    else parts[parts.length - 1].body.push(line);
  }
  return (
    <div className="flex flex-col gap-3 text-base leading-7 text-foreground/90">
      {parts.map((p, i) => {
        const body = p.body.join("\n").trim();
        return (
          <Fragment key={i}>
            {p.h && <h2 className="mt-3 font-heading text-lg font-semibold text-foreground sm:text-xl">{p.h}</h2>}
            {body && <div className="whitespace-pre-line">{body}</div>}
          </Fragment>
        );
      })}
    </div>
  );
}
