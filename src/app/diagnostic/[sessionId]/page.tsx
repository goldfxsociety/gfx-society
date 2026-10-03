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
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: session } = await supabase
    .from("diagnostic_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  if (session.status === "completed") {
    redirect(`/diagnostic/${sessionId}/results`);
  }

  const { data: questions } = await supabase
    .from("diagnostic_questions")
    .select("id, question_key, competency_key, question, options, chart, question_type, difficulty, order_index")
    .eq("is_published", true)
    .order("order_index");

  if (!questions || questions.length === 0) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <DiagnosticFlow sessionId={sessionId} questions={questions} />
    </div>
  );
}
