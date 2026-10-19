import { Fragment } from "react";

/**
 * Lesson content renderer. Lines starting with "## " become real <h2> section
 * headings (UX audit #4); everything else keeps the existing pre-line paragraph
 * rendering, so lessons without "## " look exactly as before.
 */
export function LessonContent({ content }: { content: string }) {
  const parts: { h?: string; body: string[] }[] = [{ body: [] }];
  const lines = content.split("\n");
  const hasMarkers = lines.some((l) => l.startsWith("## "));
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) parts.push({ h: line.slice(3).trim(), body: [] });
    else if (!hasMarkers && isPlainTitle(lines, i)) parts.push({ h: line.trim(), body: [] });
    else parts[parts.length - 1].body.push(line);
  });
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

/**
 * Level 2+ lessons store section titles as plain lines (weekly 2026-10-19 #2).
 * A title is a short line with no end punctuation and no list number that
 * starts a block (first line or after a blank line) and is followed by text.
 * List items (no blank line before them) stay as body text.
 */
export function isPlainTitle(lines: string[], i: number): boolean {
  const line = lines[i].trim();
  if (!line || line.length > 70) return false;
  if (/[.?!:;,]$/.test(line) || /^(\d|[-*•]|Sa Taglish)/.test(line)) return false;
  if (i > 0 && lines[i - 1].trim() !== "") return false;
  const next = lines[i + 1];
  return next !== undefined && next.trim() !== "";
}
