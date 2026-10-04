/**
 * One-off manual verification for Phase 2B's pure logic (evidence.ts).
 * Same approach as scripts/verify-diagnostic-logic.ts — run directly:
 *
 *   npx tsx scripts/verify-competency-evidence.ts
 *
 * Not a test framework. Re-run any time evidence.ts changes.
 */
import {
  computeCompetencyEvidence,
  selectLatestCompletedSession,
  describeEvidence,
  type EvidenceLessonInput,
  type AssessmentAttemptInput,
  type DiagnosticSessionSummary,
} from "../src/lib/competency/evidence";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  OK  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("=== Demonstrated-competency model ===");

// No Evidence: 0 completed, 0 attempts at all
{
  const lessons: EvidenceLessonInput[] = [
    { id: "A1", competencyKey: "gold", hasScoredAssessment: false },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(), []);
  check("No Evidence: 0 completed, 0 attempts", evidence.gold.status, "No Evidence");
}

// Developing: struggling overrides a positive completion ratio elsewhere in
// the same competency
{
  const lessons: EvidenceLessonInput[] = [
    { id: "B1", competencyKey: "risk_management", hasScoredAssessment: true },
    { id: "B2", competencyKey: "risk_management", hasScoredAssessment: true },
    { id: "B3", competencyKey: "risk_management", hasScoredAssessment: true },
  ];
  const completed = new Set(["B1", "B2"]); // 2/3 complete — would be Familiar on ratio alone
  const attempts: AssessmentAttemptInput[] = [
    { lessonId: "B3", passed: false, createdAt: "2026-01-01T00:00:00Z" }, // B3 struggling, never passed
  ];
  const evidence = computeCompetencyEvidence(lessons, completed, attempts);
  check("struggling overrides 2/3 (66%) completion -> Developing, not Familiar", evidence.risk_management.status, "Developing");
  check("struggling flag is true", evidence.risk_management.struggling, true);
}

// Developing: thin partial completion, no struggling (<50%)
{
  const lessons: EvidenceLessonInput[] = [
    { id: "C1", competencyKey: "setups", hasScoredAssessment: true },
    { id: "C2", competencyKey: "setups", hasScoredAssessment: true },
    { id: "C3", competencyKey: "setups", hasScoredAssessment: true },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["C1"]), []);
  check("1/3 (33%) completed, no struggling -> Developing", evidence.setups.status, "Developing");
}

// Familiar: 50-99%, no struggling
{
  const lessons: EvidenceLessonInput[] = [
    { id: "D1", competencyKey: "market_structure", hasScoredAssessment: true },
    { id: "D2", competencyKey: "market_structure", hasScoredAssessment: true },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["D1"]), []);
  check("1/2 (50%) completed, no struggling -> Familiar", evidence.market_structure.status, "Familiar");
}

// Strong Foundation: 100%
{
  const lessons: EvidenceLessonInput[] = [
    { id: "E1", competencyKey: "psychology", hasScoredAssessment: true },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["E1"]), [
    { lessonId: "E1", passed: true, createdAt: "2026-01-01T00:00:00Z" },
  ]);
  check("1/1 (100%) completed -> Strong Foundation", evidence.psychology.status, "Strong Foundation");
}

// Failed then later passed -> NOT struggling (latest attempt wins)
{
  const lessons: EvidenceLessonInput[] = [
    { id: "F1", competencyKey: "platform", hasScoredAssessment: true },
  ];
  const attempts: AssessmentAttemptInput[] = [
    { lessonId: "F1", passed: false, createdAt: "2026-01-01T00:00:00Z" },
    { lessonId: "F1", passed: true, createdAt: "2026-01-02T00:00:00Z" },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["F1"]), attempts);
  check("failed then later passed -> struggling=false", evidence.platform.struggling, false);
  check("failed then later passed, 1/1 complete -> Strong Foundation", evidence.platform.status, "Strong Foundation");
}

console.log("\n=== Assessment coverage (thin-competency honesty) ===");

// Thin competency, 0 scored lessons (gold/journaling-style)
{
  const lessons: EvidenceLessonInput[] = [
    { id: "G1", competencyKey: "gold", hasScoredAssessment: false },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["G1"]), []);
  check("0 scored lessons -> coverage 'none'", evidence.gold.coverage, "none");
  check(
    "copy for 0 scored lessons mentions no assessment exists",
    describeEvidence(evidence.gold),
    "1/1 lesson completed — no scored assessment exists for this topic yet",
  );
}

// Partial coverage (risk_management/technical_tools/price_action-style: 1 of 3 scored)
{
  const lessons: EvidenceLessonInput[] = [
    { id: "H1", competencyKey: "risk_management", hasScoredAssessment: false },
    { id: "H2", competencyKey: "risk_management", hasScoredAssessment: false },
    { id: "H3", competencyKey: "risk_management", hasScoredAssessment: true },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(["H1", "H2", "H3"]), []);
  check("1 of 3 scored -> coverage 'partial'", evidence.risk_management.coverage, "partial");
  check(
    "copy for partial coverage mentions partial assessment coverage",
    describeEvidence(evidence.risk_management),
    "3/3 lessons completed — assessment coverage is partial",
  );
}

// Full coverage
{
  const lessons: EvidenceLessonInput[] = [
    { id: "I1", competencyKey: "psychology", hasScoredAssessment: true },
  ];
  const evidence = computeCompetencyEvidence(lessons, new Set(), []);
  check("all lessons scored -> coverage 'full'", evidence.psychology.coverage, "full");
}

console.log("\n=== Diagnostic session selection (latest COMPLETED only) ===");

function session(id: string, status: string, completedAt: string | null): DiagnosticSessionSummary {
  return { id, status, completedAt, competencyScores: null };
}

check("no sessions at all -> null", selectLatestCompletedSession([]), null);

check(
  "only an in-progress session -> null (ignored)",
  selectLatestCompletedSession([session("s1", "in_progress", null)]),
  null,
);

check(
  "only an abandoned session -> null (ignored)",
  selectLatestCompletedSession([session("s1", "abandoned", "2026-01-01T00:00:00Z")]),
  null,
);

check(
  "exactly one completed session -> that one",
  selectLatestCompletedSession([session("s1", "completed", "2026-01-01T00:00:00Z")])?.id,
  "s1",
);

check(
  "multiple completed sessions -> latest by completed_at wins",
  selectLatestCompletedSession([
    session("old", "completed", "2026-01-01T00:00:00Z"),
    session("newest", "completed", "2026-03-01T00:00:00Z"),
    session("middle", "completed", "2026-02-01T00:00:00Z"),
  ])?.id,
  "newest",
);

check(
  "completed + a later in-progress retake -> completed one still wins (in-progress ignored even if newer)",
  selectLatestCompletedSession([
    session("done", "completed", "2026-01-01T00:00:00Z"),
    session("retake", "in_progress", null),
  ])?.id,
  "done",
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
