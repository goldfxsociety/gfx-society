/**
 * Member shell and course-list labels. No lesson titles and no sales or price changes.
 * `closed` is content-ready with sales shut (buy-locked copy). `coming_soon` is no published set.
 */

export type SurfaceMembership = "active" | "grace" | "none";

export type SurfacePay =
  | "not_member"
  | "not_found"
  | "free"
  | "coming_soon"
  | "locked"
  | "closed"
  | "pending"
  | "approved"
  | "rejected"
  | "open";

export type SurfaceCard =
  | "verify"
  | "free_new"
  | "free_progress"
  | "free_done"
  | "not_owned"
  | "pending"
  | "rejected"
  | "owned"
  | "coming_soon"
  | "locked"
  | "sales_closed";

/**
 * Home · Courses · Account for Linked (active / grace) and, since Sprint 3, for Explorers (signed in, confirmed email).
 * Logged-out and unconfirmed visitors keep the Academy tabs.
 */
export function showMembersNav(membership: SurfaceMembership, explorer = false): boolean {
  return membership === "active" || membership === "grace" || explorer;
}

export function memberCourseState(
  membership: SurfaceMembership,
  pay: SurfacePay,
  lessonCount: number,
  done: number,
): SurfaceCard {
  if (membership === "none") {
    // S8: a delisted owner keeps a bought course. Sprint 3: the DB answers 'free' for Gold Reset to a consented
    // Explorer only; everything else is the join door ("verify": consent for Gold Reset, "Link" for paid courses).
    if (pay === "approved") return "owned";
    if (pay !== "free") return "verify";
  }
  switch (pay) {
    case "approved":
      return "owned";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "locked":
      return "locked";
    case "open":
      return "not_owned";
    case "closed":
      return "sales_closed";
    case "free":
      if (lessonCount === 0) return "coming_soon";
      if (done === 0) return "free_new";
      return done >= lessonCount ? "free_done" : "free_progress";
    default:
      return "coming_soon";
  }
}

/** Spec §5. Buy-locked when the course exists but is not open to buy. Preparing copy only with no content. */
export function courseLockCopy(state: SurfaceCard): "buy_locked" | "no_content" | null {
  if (state === "sales_closed" || state === "not_owned") return "buy_locked";
  if (state === "coming_soon") return "no_content";
  return null;
}
