/**
 * Members ecosystem Phase 1 MVP copy (spec v2.1 §5, Ben-approved 2 Nov 2026). Members pages are Taglish.
 * Copy rules (§3.4): no dates beyond the grace badge, no IB/partner line (D3), no performance claims. Counts only.
 */
export const ME = {
  eyebrow: "GFX Trading System",
  welcome: (first: string | null) => (first ? `Welcome back, ${first}.` : "Welcome back."),
  badgeActive: "Active member",
  badgeGrace: (date: string) => `Member hanggang ${date}`,
  heroLabel: "Ituloy ang lesson mo",
  heroCta: "Ituloy →",
  heroEmpty: "Simulan sa Gold Reset. Libre ito.",
  chipLessons: (n: number, m: number) => `${n}/${m} lessons`,
  // Spec §6 A1 + Jarvis: no pass mark is set, so the chip counts quizzes done, not passed.
  chipQuiz: (n: number) => `${n} quiz done`,
  chipCapstone: (done: boolean) => `Capstone: ${done ? "tapos" : "hindi pa"}`,
  railTitle: "Curriculum",
  railDone: (n: number, m: number) => `${n} / ${m} lessons tapos`,
  current: "Current",
  states: { done: "Tapos", in_progress: "Ginagawa pa", not_started: "Hindi pa nasisimulan" },
  legend: { done: "Tapos", in_progress: "Ginagawa", not_started: "Hindi pa" },
  lockedUnpaid: "🔒 Bilhin para mabuksan ang course na ito.",
  lockedNoContent: "🔒 Inaayos pa ang lessons nito.",
  prereq: (course: string) => `Tapusin muna ang ${course} o ipasa ang placement quiz.`,
  quizTag: "Quiz",
  capstoneRow: "Capstone",
  nav: { home: "Home", courses: "Courses", account: "Account", tools: "Tools", navigate: "Navigate", modules: "Modules", later: "Paparating pa" },
} as const;

export const STATE_ICON = { done: "✓", in_progress: "◐", not_started: "○" } as const;
