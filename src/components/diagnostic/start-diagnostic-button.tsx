"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startDiagnosticSession } from "@/lib/diagnostic/start-session";

export function StartDiagnosticButton({ previousSessionId }: { previousSessionId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const sessionId = await startDiagnosticSession(previousSessionId);
      router.push(`/diagnostic/${sessionId}`);
    } catch {
      setError("Couldn't start the diagnostic — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleStart} disabled={loading} className="self-start">
        {loading ? "Starting..." : previousSessionId ? "Retake the Diagnostic" : "Start the Diagnostic"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
