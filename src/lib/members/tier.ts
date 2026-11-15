/**
 * Explorer vs Linked tiers (Sprint 3, explorer-linked-tiers-spec.md v1.1 §1). Pure logic, no I/O, so the gate rules
 * are unit-tested offline (scripts/test-tiers.mjs). The DB (public.has_course_access / my_payment_info / RLS) enforces
 * the same rules; this only decides redirects and which screen to show.
 *
 *  - guest:    logged out, or signed in with an unconfirmed email. Not a tier: login / confirm-email screens.
 *  - explorer: signed in, confirmed email, my_membership() = 'none'. Free Academy + Gold Reset (after join-v2 consent).
 *  - linked:   my_membership() = 'active' | 'grace'. Explorer + the existing paid-course path.
 * Funding is never part of the gate (§6.4). Matching is email-only (§6.3).
 */
import type { Membership } from "@/lib/members/membership";

export type Tier = "guest" | "explorer" | "linked";

/** Courses an Explorer may open after join-v2 consent (§6.2). Paid courses stay Linked-only. */
export const EXPLORER_COURSES = ["gold-reset"] as const;
export const GOLD_RESET_PATH = "/courses/gold-reset";

export function tierFrom(s: { loggedIn: boolean; confirmed: boolean; membership: Membership }): Tier {
  if (s.membership === "active" || s.membership === "grace") return "linked";
  return s.loggedIn && s.confirmed ? "explorer" : "guest";
}

export function isExplorerCourse(slug: string): boolean {
  return (EXPLORER_COURSES as readonly string[]).includes(slug);
}

/**
 * A Gold Reset learning path: the course page, a lesson, or its capstone. Never /pay or /placement.
 * Used for the post-consent `next` (§2.2: a no_match after consent still opens Gold Reset).
 */
export function isGoldResetPath(p: string | null | undefined): boolean {
  const m = /^\/courses\/gold-reset(?:\/([^/?#]+))?\/?(?:[?#].*)?$/.exec(p ?? "");
  return Boolean(m) && m![1] !== "pay" && m![1] !== "placement";
}

export type CourseRoute = "allow" | "login" | "join";

/**
 * HTTP gate for /courses/<slug>/<sub> (lesson, capstone, pay, placement), before S8 (bought-course) checks.
 * Linked: allow (the DB still requires a purchase for paid lessons). Consented Explorer: Gold Reset lessons + capstone
 * only. Everyone else signed in: the join door (consent first for Gold Reset; "Link" for paid courses).
 */
export function courseRouteAccess(
  s: { loggedIn: boolean; membership: Membership; consented: boolean },
  slug: string,
  sub: string,
): CourseRoute {
  if (!s.loggedIn) return "login";
  if (s.membership === "active" || s.membership === "grace") return "allow";
  if (isExplorerCourse(slug) && sub !== "pay" && sub !== "placement" && s.consented) return "allow";
  return "join";
}

/** /training: any signed-in, confirmed account (Explorer or Linked). Logged out -> login; unconfirmed -> join door. */
export function trainingRouteAccess(s: { loggedIn: boolean; confirmed: boolean; membership: Membership }): CourseRoute {
  if (!s.loggedIn) return "login";
  return tierFrom(s) === "guest" ? "join" : "allow";
}

export type HomeGold =
  | { kind: "lesson" }        // "Ituloy →" to the current lesson (Gold Reset or an owned course)
  | { kind: "finished" }      // course end action (capstone / review) of a course that is not Gold Reset
  | { kind: "consent" }       // Explorer without join-v2: "Ituloy →" to /system/join?next=Gold Reset
  | { kind: "link" }          // Explorer who finished Gold Reset with nothing else unlocked: gold "I-link ..."
  | { kind: "none" };

/**
 * The one gold CTA on the /training home (§2.1). `action` is the resolved continue action of the current course.
 * Explorer outline "Link" shows whenever the gold is not itself the Link button and there is no active request.
 */
export function homeGold(s: {
  tier: Tier;
  consented: boolean;
  action: "lesson" | "capstone" | "review" | "empty";
}): { gold: HomeGold; outlineLink: boolean } {
  if (s.tier === "explorer" && !s.consented) return { gold: { kind: "consent" }, outlineLink: true };
  if (s.action === "lesson") return { gold: { kind: "lesson" }, outlineLink: s.tier === "explorer" };
  if (s.tier === "explorer" && (s.action === "review" || s.action === "empty")) return { gold: { kind: "link" }, outlineLink: false };
  if (s.action === "capstone" || s.action === "review") return { gold: { kind: "finished" }, outlineLink: s.tier === "explorer" };
  return { gold: { kind: "none" }, outlineLink: s.tier === "explorer" };
}
