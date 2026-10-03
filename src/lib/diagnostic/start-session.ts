import { createClient } from "@/lib/supabase/client";
import { logEvent } from "@/lib/analytics/log-event";

export async function startDiagnosticSession(previousSessionId?: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diagnostic_sessions")
    .insert({})
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to start diagnostic session");
  }

  await logEvent("diagnostic_started", data.id);
  if (previousSessionId) {
    await logEvent("diagnostic_restarted", data.id, { previous_session_id: previousSessionId });
  }

  return data.id as string;
}
