import { readFileSync } from "node:fs";
import path from "node:path";
import { LEGAL_DRAFT } from "@/config/legal";
import { Markdown } from "./markdown";

export function DraftBanner() {
  if (!LEGAL_DRAFT) return null;
  return (
    <div role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold">
      DRAFT — pending legal review. This text is not final and may change.
    </div>
  );
}

/** Renders src/content/legal/<file>.md. When LEGAL_DRAFT is off, internal [VERIFY] notes still show — remove them from the .md before going final. */
export function LegalPage({ file }: { file: string }) {
  const source = readFileSync(path.join(process.cwd(), "src/content/legal", file), "utf8");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <DraftBanner />
      <Markdown source={source} />
    </div>
  );
}
