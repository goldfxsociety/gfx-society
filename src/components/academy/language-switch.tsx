"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { gfxEvent } from "@/lib/analytics/events";

const EN = "/en/academy/gold-starter";
const TL = "/academy/gold-starter";

type Props = { current: "en" | "tl"; enHref?: string; tlHref?: string; location?: string };

function Segments({ current, qs, enHref = EN, tlHref = TL, location = "gold_starter" }: Props & { qs: string }) {
  const seg = (lang: "en" | "tl", href: string, label: string, name: string, hrefLang: string) => {
    const active = current === lang;
    return (
      <Link
        href={href + qs}
        hrefLang={hrefLang}
        aria-label={name}
        aria-current={active ? "page" : undefined}
        onClick={() => !active && gfxEvent("lang_switch", { to: lang, location })}
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
      {seg("en", enHref, "EN", "English", "en")}
      <span aria-hidden className="w-px bg-[#c4b5d4]/50" />
      {seg("tl", tlHref, "TL", "Tagalog / Taglish", "fil-PH")}
    </nav>
  );
}

const noSubscribe = () => () => {};

/**
 * EN | TL switch for pages with both versions. Keeps the query string (UTMs). Defaults to the Gold Starter Kit pair;
 * /accm, /broker and /system/join pass their own `enHref` / `tlHref` (simplicity spec v2).
 */
export function LanguageSwitch(props: Props) {
  // Read the query string after hydration (server snapshot ""), so the switch renders in place on static pages
  // instead of bailing out to a client-only Suspense boundary (useSearchParams).
  const qs = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return <Segments {...props} qs={qs} />;
}
