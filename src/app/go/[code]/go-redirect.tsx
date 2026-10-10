"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Short delay lets the analytics page view for /go/<code> fire before moving on. */
export function GoRedirect({ href, delayMs = 1500 }: { href: string; delayMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(href), delayMs);
    return () => clearTimeout(t);
  }, [href, delayMs, router]);
  return null;
}
