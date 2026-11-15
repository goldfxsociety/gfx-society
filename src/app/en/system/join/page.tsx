import type { Metadata } from "next";
import { JoinView } from "@/app/system/join/join-view";

const DESC = "Members-only GFX Trading System: log in with your Academy account to verify your membership. Education only.";

export const metadata: Metadata = {
  title: "Join | GFX Trading System",
  description: DESC,
  openGraph: { title: "Join | GFX Trading System", description: DESC, url: "/en/system/join", locale: "en", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Join | GFX Trading System", description: DESC },
  robots: { index: false, follow: false },
  alternates: { languages: { en: "/en/system/join", "fil-PH": "/system/join", "x-default": "/system/join" } },
};

/** EN front door: same JoinView, JoinForm, actions (joinConsent / submitAccessRequest) and RPCs as /system/join. */
export default async function EnJoinPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  return <JoinView lang="en" nextParam={typeof sp.next === "string" ? sp.next : null} />;
}
