"use client";

import { Analytics } from "@vercel/analytics/next";
import { stripUrlFragment } from "@/lib/analytics-scrub";

/** <Analytics /> with a beforeSend that strips the URL fragment from every event (QA Q1). */
export function SiteAnalytics() {
  return <Analytics beforeSend={stripUrlFragment} />;
}
