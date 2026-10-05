/**
 * Learner-facing stage grouping — presentation only, no database column.
 * Maps the existing competency_key values onto the approved 8 stage names.
 */
const STAGE_LABELS: Record<string, string> = {
  foundations: "Foundation",
  platform: "Foundation",
  price_action: "Reading Price",
  market_structure: "Reading Price",
  technical_tools: "Tools",
  gold: "Gold",
  risk_management: "Risk",
  setups: "Setups",
  psychology: "Psychology",
  journaling: "Journaling",
};

export function stageLabelFor(competencyKey: string | null): string {
  if (!competencyKey) return "GFX Academy";
  return STAGE_LABELS[competencyKey] ?? "GFX Academy";
}
