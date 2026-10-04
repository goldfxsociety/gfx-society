"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { logEvent } from "@/lib/analytics/log-event";

export function ContinueLearningLink({
  href,
  lessonId,
  className,
  children,
}: {
  href: string;
  lessonId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => void logEvent("continue_learning_clicked", lessonId)}>
      {children}
    </Link>
  );
}
