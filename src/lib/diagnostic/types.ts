import type { OHLC } from "@/lib/candlestick";

/**
 * Shape of a diagnostic question as the client is allowed to see it —
 * mirrors exactly the column-level GRANT in the Phase 2A migration.
 * correct_index/explanation are intentionally absent from this type.
 */
export type DiagnosticQuestionPublic = {
  id: string;
  question_key: string;
  competency_key: string;
  question: string;
  options: string[];
  chart: OHLC[] | null;
  question_type: string;
  difficulty: string;
  order_index: number;
};
