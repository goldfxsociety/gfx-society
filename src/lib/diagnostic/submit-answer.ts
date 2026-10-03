import { createClient } from "@/lib/supabase/client";

/**
 * Grading happens entirely server-side inside submit_diagnostic_answer —
 * this just calls the RPC and returns the boolean it computed. The
 * client never sends or receives correct_index.
 */
export async function submitDiagnosticAnswer(
  sessionId: string,
  questionId: string,
  selectedIndex: number,
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_diagnostic_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_selected_index: selectedIndex,
  });
  if (error) throw error;
  return data as boolean;
}

export async function skipDiagnosticQuestion(sessionId: string, questionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("skip_diagnostic_question", {
    p_session_id: sessionId,
    p_question_id: questionId,
  });
  if (error) throw error;
}
