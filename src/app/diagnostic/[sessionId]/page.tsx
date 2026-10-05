import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiagnosticFlow } from "@/components/diagnostic/diagnostic-flow";

export default async function DiagnosticQuestionsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[diagnostic/[sessionId]] no authenticated user", { sessionId, userError });
    notFound();
  }

  const { data: session, error: sessionError } = await supabase
    .from("diagnostic_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    console.error("[diagnostic/[sessionId]] session lookup failed", {
      sessionId,
      userId: user.id,
      sessionError,
    });
    notFound();
  }

  if (session.status === "completed") {
    redirect(`/diagnostic/${sessionId}/results`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from("diagnostic_questions")
    .select("id, question_key, competency_key, question, options, chart, question_type, difficulty, order_index")
    .eq("is_published", true)
    .order("order_index");

  if (!questions || questions.length === 0) {
    console.error("[diagnostic/[sessionId]] no published questions returned", {
      sessionId,
      userId: user.id,
      questionsError,
    });
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <DiagnosticFlow sessionId={sessionId} questions={questions} />
    </div>
  );
}
