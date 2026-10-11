"use client";
import { useEffect } from "react";
import { captureFirstTouchUtm } from "@/lib/analytics/events";

/** Captures utm_* on landing (sessionStorage only). Renders nothing. */
export function FirstTouch() {
  useEffect(() => {
    captureFirstTouchUtm();
  }, []);
  return null;
}
