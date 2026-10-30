"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { gfxEvent } from "@/lib/analytics/events";

const EN = "/en/academy/gold-starter";
const TL = "/academy/gold-starter";

function Segments({ current, qs }: { current: "en" | "tl"; qs: string }) {
  const seg = (lang: "en" | "tl", href: string, label: string, name: string, hrefLang: string) => {
    const active = current === lang;
    return (
      <Link
        href={href + qs}
        hrefLang={hrefLang}
        aria-label={name}
        aria-current={active ? "page" : undefined}
        onClick={() => !active && gfxEvent("lang_switch", { to: lang, location: "gold_starter" })}
        className={
          "flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f0ff] " +
          (active ? "bg-[#3a2460] text-[#f5f0ff]" : "text-[#c4b5d4] hover:text-[#f5f0ff]")
        }
      >
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Language" className="flex max-w-[120px] self-end overflow-hidden rounded-full border border-[#c4b5d4]/50">
      {seg("en", EN, "EN", "English", "en")}
      <span aria-hidden className="w-px bg-[#c4b5d4]/50" />
      {seg("tl", TL, "TL", "Tagalog / Taglish", "fil-PH")}
    </nav>
  );
}

function WithQuery({ current }: { current: "en" | "tl" }) {
  const qs = useSearchParams().toString();
  return <Segments current={current} qs={qs ? `?${qs}` : ""} />;
}

/** EN | TL switch for pages with both versions (Phase 1: Gold Starter Kit only). Keeps the query string (UTMs). */
export function LanguageSwitch({ current }: { current: "en" | "tl" }) {
  return (
    <Suspense fallback={<Segments current={current} qs="" />}>
      <WithQuery current={current} />
    </Suspense>
  );
}
