import Link from "next/link";
import type { ReactNode } from "react";

/** Minimal, dependency-free Markdown renderer for trusted, repo-owned legal texts. */
function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = key;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++}>{m[1]}</strong>);
    else {
      const href = m[3];
      out.push(
        href.startsWith("/") ? (
          <Link key={i++} href={href} className="underline">{m[2]}</Link>
        ) : (
          <a key={i++} href={href} className="underline" rel="noopener noreferrer">{m[2]}</a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={k++} className="text-2xl font-bold tracking-tight">{line.slice(2)}</h1>);
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={k++} className="mt-4 text-lg font-semibold">{line.slice(3)}</h2>);
      i++;
    } else if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++} className="border-l-2 border-primary pl-3 text-muted-foreground">{inline(buf.join(" "))}</blockquote>);
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      blocks.push(
        <div key={k++} className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead><tr>{cells(head).map((c, j) => <th key={j} className="border border-border p-2 text-left">{inline(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{cells(r).map((c, j) => <td key={j} className="border border-border p-2 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""));
      blocks.push(<ul key={k++} className="list-disc space-y-1 pl-5">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#|>|\||\s*[-*] )/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++}>{inline(buf.join(" "))}</p>);
    }
  }
  return <div className="flex flex-col gap-3 text-sm leading-relaxed">{blocks}</div>;
}
