/**
 * One-off manual verification script for the diagnostic's pure logic
 * (scoring.ts, recommendation.ts). Not a test framework — run directly:
 *
 *   npx tsx scripts/verify-diagnostic-logic.ts
 *
 * Covers the Phase 2A scoring test cases (Section 30) and recommendation
 * scenarios (Section 31). Re-run any time scoring.ts/recommendation.ts
 * change; no CI wiring, no new dependency.
 */
import {
  computeTier,
  computeConfidence,
  computeCompetencyScores,
  type DiagnosticAnswerRecord,
} from "../src/lib/diagnostic/scoring";
import { recommendStartingPoint, type LessonRow } from "../src/lib/diagnostic/recommendation";

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

console.log("=== Section 29: skip handling ===");
{
  const answers: DiagnosticAnswerRecord[] = [
    { competencyKey: "risk_management", selectedIndex: 0, correct: true },
    { competencyKey: "risk_management", selectedIndex: null, correct: null }, // skipped
    { competencyKey: "risk_management", selectedIndex: 2, correct: false },
  ];
  const scores = computeCompetencyScores(answers);
  check("3 questions, 1 skipped -> answered=2 (skip excluded from denominator)", scores.risk_management.answered, 2);
  check("3 questions, 1 skipped -> correct=1", scores.risk_management.correct, 1);
  check("score = 50% (1/2), not 33% (1/3)", scores.risk_management.tier, "Familiar");
}

console.log("\n=== Section 30: scoring test cases ===");
check("0 answered -> No Data", computeTier(0, 0), "No Data");
check("1 answered, 0 correct (lone wrong guess) -> Developing, not No Data", computeTier(1, 0), "Developing");
check("1 answered, 1 correct -> Strong Foundation", computeTier(1, 1), "Strong Foundation");
check("2 answered, 1 correct (50%) -> Familiar", computeTier(2, 1), "Familiar");
check("3 answered, 2 correct (66.7%) -> Familiar", computeTier(3, 2), "Familiar");
check("3 answered, 3 correct (100%) -> Strong Foundation", computeTier(3, 3), "Strong Foundation");

check("confidence: 0 answered -> Limited data", computeConfidence(0), "Limited data");
check("confidence: 1 answered -> Limited data", computeConfidence(1), "Limited data");
check("confidence: 2 answered -> Standard", computeConfidence(2), "Standard");
check("confidence: 5 answered -> Standard", computeConfidence(5), "Standard");

console.log("\n=== Section 31: recommendation scenarios ===");

// A tiny fake curriculum: 2 levels, 2 competencies, with one prerequisite
// link (B requires A), mirroring the real market_structure example from
// the blueprint review.
const L1_A: LessonRow = { id: "L1_A", levelId: "lvl1", levelOrderIndex: 0, orderIndex: 0, competencyKey: "foundations", prerequisiteLessonId: null };
const L1_B: LessonRow = { id: "L1_B", levelId: "lvl1", levelOrderIndex: 0, orderIndex: 1, competencyKey: "foundations", prerequisiteLessonId: null };
const L2_A: LessonRow = { id: "L2_A", levelId: "lvl2", levelOrderIndex: 1, orderIndex: 0, competencyKey: "market_structure", prerequisiteLessonId: null };
const L2_B: LessonRow = { id: "L2_B", levelId: "lvl2", levelOrderIndex: 1, orderIndex: 1, competencyKey: "market_structure", prerequisiteLessonId: "L2_A" };
const allLessons = [L1_A, L1_B, L2_A, L2_B];

// 1. No progress — everything untouched, no diagnostic taken
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: {},
  });
  check("1. no progress, no diagnostic -> recommend earliest lesson (L1_A)", rec, { kind: "lesson", lessonId: "L1_A", reason: "continue" });
}

// 2. Partial progress + learner skipped ahead: L1 done, diagnostic shows
//    foundations is fine but market_structure is Developing -> should
//    recommend market_structure's lesson, not blindly "continue" past it
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation", market_structure: "Developing" },
  });
  check("2. partial progress, diagnostic flags market_structure -> recommend L2_A", rec, { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" });
}

// 3. Skipped-ahead scenario stated explicitly: L1 incomplete but diagnostic
//    says foundations is already Strong (e.g. real-world trader with no
//    app history) while market_structure is weak -> still recommend L1
//    first since nothing there is complete and foundations' own tier is
//    strong so it's not a "meaningful gap" -> should jump straight to the
//    meaningful gap (market_structure) even though L1 lessons are earlier
//    and incomplete
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation", market_structure: "Developing" },
  });
  check("3. foundations tests strong despite 0 lessons done -> jump to market_structure gap (L2_A)", rec, { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" });
}

// 4. Failed assessment without a later pass -> struggling, no diagnostic data at all
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(["L2_A"]),
    competencyTiers: {},
  });
  check("4. no diagnostic, but L2_A struggling -> recommend L2_A", rec, { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" });
}

// 5. Failed assessment followed by a later pass -> NOT struggling, not completed
//    either (lesson_progress only gets written on a pass; here pretend they
//    failed once on L2_A then the lesson somehow isn't marked complete, e.g.
//    non-quiz follow-up) -> should fall through to the general fallback
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(), // the later pass means it's no longer "struggling"
    competencyTiers: {},
  });
  check("5. failed-then-passed is not struggling -> falls back to continue (L2_A)", rec, { kind: "lesson", lessonId: "L2_A", reason: "continue" });
}

// 6. Existing prerequisite incomplete -> must resolve backward to the prerequisite
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(),
    competencyTiers: { market_structure: "Developing" },
  });
  check("6. L2_B targeted but prerequisite L2_A incomplete -> recommend L2_A, not L2_B", rec, { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" });
}

// 7. Existing prerequisite completed -> should recommend the actual target lesson
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B", "L2_A"]),
    strugglingLessonIds: new Set(),
    competencyTiers: { market_structure: "Developing" },
  });
  check("7. prerequisite L2_A done -> recommend L2_B directly", rec, { kind: "lesson", lessonId: "L2_B", reason: "meaningful_gap" });
}

// 8. All lessons completed -> Academy complete, no lesson recommendation
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B", "L2_A", "L2_B"]),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation", market_structure: "Strong Foundation" },
  });
  check("8. everything complete -> {kind: complete}", rec, { kind: "complete" });
}

// 9. Diagnostic with all questions skipped -> competencyTiers empty/No Data,
//    no struggling lessons either -> falls back to "continue"
{
  const scores = computeCompetencyScores([
    { competencyKey: "foundations", selectedIndex: null, correct: null },
    { competencyKey: "market_structure", selectedIndex: null, correct: null },
  ]);
  check("9a. all skipped -> No Data tiers", Object.values(scores).map((s) => s.tier), ["No Data", "No Data"]);
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "No Data", market_structure: "No Data" },
  });
  check("9b. No Data everywhere, no progress -> earliest lesson (L1_A)", rec, { kind: "lesson", lessonId: "L1_A", reason: "meaningful_gap" });
}

// 10. Limited-data competency (gold/journaling-style, single question)
{
  const scores = computeCompetencyScores([{ competencyKey: "gold", selectedIndex: 0, correct: true }]);
  check("10. single-question competency -> Strong Foundation + Limited data", scores.gold, {
    competencyKey: "gold",
    answered: 1,
    correct: 1,
    tier: "Strong Foundation",
    confidence: "Limited data",
  });
}

// 11. Substantial existing progress — only one lesson left anywhere
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B", "L2_A"]),
    strugglingLessonIds: new Set(),
    competencyTiers: {},
  });
  check("11. 3 of 4 lessons done, no diagnostic -> recommend the one remaining (L2_B)", rec, { kind: "lesson", lessonId: "L2_B", reason: "continue" });
}

// 12. Multiple possible competency gaps -> earliest-appearing one wins deterministically
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Developing", market_structure: "Developing" },
  });
  check("12. both competencies weak -> earliest-appearing (foundations/L1_A) wins", rec, { kind: "lesson", lessonId: "L1_A", reason: "meaningful_gap" });
}

console.log("\n=== Phase 2C-B: Strong Foundation acceleration + fresh-struggle-overrides-stale-diagnostic ===");

// A. No diagnostic -> behavior must be byte-identical to before this change
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: {},
  });
  check("A. no diagnostic, no progress -> unchanged (L1_A, continue)", rec, { kind: "lesson", lessonId: "L1_A", reason: "continue" });
}

// B. Developing competency -> meaningful gap still prioritized (unaffected by this phase's changes)
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Developing" },
  });
  check("B. foundations Developing -> recommend L1_A (meaningful_gap)", rec, { kind: "lesson", lessonId: "L1_A", reason: "meaningful_gap" });
}

// C. Every remaining competency Strong Foundation -> fallback still returns the earliest incomplete lesson (rule 4, old behavior preserved)
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation", market_structure: "Strong Foundation" },
  });
  check("C. all Strong Foundation, nothing complete -> falls through to L1_A anyway", rec, { kind: "lesson", lessonId: "L1_A", reason: "continue" });
}

// C2. Partial Strong Foundation -> skip past the Strong-Foundation competency's incomplete lessons during fallback
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation" }, // market_structure untested (undefined)
  });
  check("C2. foundations Strong Foundation, market_structure untested -> skip to L2_A", rec, { kind: "lesson", lessonId: "L2_A", reason: "continue" });
}

// D. Struggling lesson with no diagnostic tier at all -> still prioritized (unaffected regression check)
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(["L2_A"]),
    competencyTiers: {},
  });
  check("D. struggling L2_A, no diagnostic -> still recommend L2_A", rec, { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" });
}

// D2. REQUIRED: diagnostic says Strong Foundation, but there is a current
// unresolved struggle in that same competency -> the struggle must win.
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B"]),
    strugglingLessonIds: new Set(["L2_A"]),
    competencyTiers: { market_structure: "Strong Foundation" },
  });
  check(
    "D2. market_structure diagnosed Strong Foundation BUT L2_A currently struggling -> struggle overrides stale diagnostic, recommend L2_A",
    rec,
    { kind: "lesson", lessonId: "L2_A", reason: "meaningful_gap" },
  );
}

// E. Fully completed Academy -> unchanged terminal state, no fabricated recommendation
{
  const rec = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: new Set(["L1_A", "L1_B", "L2_A", "L2_B"]),
    strugglingLessonIds: new Set(),
    competencyTiers: { foundations: "Strong Foundation", market_structure: "Strong Foundation" },
  });
  check("E. everything complete -> {kind: complete}", rec, { kind: "complete" });
}

console.log("\n=== UX Polish F4: Strong Foundation awareness in prerequisite walk ===");

// Cross-competency fixture: gold's lesson requires a setups lesson as its
// prerequisite — mirrors the real understanding-golds-market-behavior ->
// what-is-a-trading-plan relationship that surfaced this bug.
const L3_SETUPS: LessonRow = { id: "L3_SETUPS", levelId: "lvl3", levelOrderIndex: 2, orderIndex: 0, competencyKey: "setups", prerequisiteLessonId: null };
const L3_GOLD1: LessonRow = { id: "L3_GOLD1", levelId: "lvl3", levelOrderIndex: 2, orderIndex: 1, competencyKey: "gold", prerequisiteLessonId: "L3_SETUPS" };
const fixtureF4a = [L3_SETUPS, L3_GOLD1];

// F4-C/E. Target competency (gold) needs attention; its only prerequisite
// belongs to a competency (setups) already diagnosed Strong Foundation.
// Must NOT walk backward into setups, and must NOT invent a lesson --
// the target itself is the correct resolution (covers Case C and Case E:
// "every available prerequisite is Strong Foundation").
{
  const rec = recommendStartingPoint({
    lessons: fixtureF4a,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { setups: "Strong Foundation", gold: "Developing" },
  });
  check(
    "F4-C/E. gold needs attention, prerequisite (setups) is Strong Foundation -> stay on gold lesson, not routed backward",
    rec,
    { kind: "lesson", lessonId: "L3_GOLD1", reason: "meaningful_gap" },
  );
}

// F4-B (regression, explicit cross-competency form). Same fixture, but the
// prerequisite's competency is NOT Strong Foundation -> normal backward walk
// still applies exactly as before this change.
{
  const rec = recommendStartingPoint({
    lessons: fixtureF4a,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { setups: "Developing", gold: "Developing" },
  });
  check(
    "F4-B. prerequisite (setups) not Strong Foundation -> loop stops on setups itself as the earliest meaningful gap",
    rec,
    { kind: "lesson", lessonId: "L3_SETUPS", reason: "meaningful_gap" },
  );
}

// F4-D. Multi-level chain: gold -> risk_management (Familiar, pass through)
// -> setups (Strong Foundation, stop here). The rule must apply at every
// step, not just the first, and must land on the Familiar lesson (not the
// original target, not the Strong Foundation one, not skipping past both).
const L4_SETUPS: LessonRow = { id: "L4_SETUPS", levelId: "lvl4", levelOrderIndex: 3, orderIndex: 0, competencyKey: "setups", prerequisiteLessonId: null };
const L4_RISK: LessonRow = { id: "L4_RISK", levelId: "lvl4", levelOrderIndex: 3, orderIndex: 1, competencyKey: "risk_management", prerequisiteLessonId: "L4_SETUPS" };
const L4_GOLD: LessonRow = { id: "L4_GOLD", levelId: "lvl4", levelOrderIndex: 3, orderIndex: 2, competencyKey: "gold", prerequisiteLessonId: "L4_RISK" };
{
  const rec = recommendStartingPoint({
    lessons: [L4_SETUPS, L4_RISK, L4_GOLD],
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: { setups: "Strong Foundation", risk_management: "Familiar", gold: "Developing" },
  });
  check(
    "F4-D. gold -> risk_management (Familiar, pass through) -> setups (Strong Foundation, stop) -> recommend L4_RISK",
    rec,
    { kind: "lesson", lessonId: "L4_RISK", reason: "prerequisite" },
  );
}

// F4-A. No diagnostic at all -> competencyTiers = {} -> behavior byte-identical
// to pre-F4 (prerequisite.competencyKey lookup is always undefined, never
// "Strong Foundation", so the walk proceeds exactly as before).
{
  const rec = recommendStartingPoint({
    lessons: fixtureF4a,
    completedLessonIds: new Set(),
    strugglingLessonIds: new Set(),
    competencyTiers: {},
  });
  check(
    "F4-A. no diagnostic -> unaffected, earliest lesson (L3_SETUPS) via normal continue fallback",
    rec,
    { kind: "lesson", lessonId: "L3_SETUPS", reason: "continue" },
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
