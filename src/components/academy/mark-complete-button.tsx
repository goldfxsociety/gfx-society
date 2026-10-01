"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/progress/mark-complete";
import { Button } from "@/components/ui/button";

export function MarkCompleteButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const { error } = await markLessonComplete(lessonId);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Saving..." : "Mark as Complete"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
