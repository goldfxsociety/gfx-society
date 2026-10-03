import { createClient } from "@/lib/supabase/client";

export async function logEvent(
  eventName: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) {
  const supabase = createClient();
  try {
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Analytics is best-effort — never let a logging failure break the UI.
  }
}
