import type { Metadata } from "next";
import { JoinView } from "./join-view";

export const metadata: Metadata = {
  title: "Join | GFX Trading System",
  robots: { index: false, follow: false },
  alternates: { languages: { en: "/en/system/join", "fil-PH": "/system/join", "x-default": "/system/join" } },
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  return <JoinView lang="tl" nextParam={typeof sp.next === "string" ? sp.next : null} />;
}
