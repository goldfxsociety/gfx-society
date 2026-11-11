import { safeNextPath } from "@/lib/auth/safe-next";

/** Where a verified member lands after consent (Design Addendum C, F1). /system/members redirects here. */
export const MEMBERS_HOME = "/training";

/** /system/join for a logged-out visitor: log in with the Academy account, then come back to consent. */
export const JOIN_LOGIN_PATH = "/login?next=%2Fsystem%2Fjoin";
/** No Academy account yet: sign up, confirm the email, then land back on /system/join. */
export const JOIN_SIGNUP_PATH = "/signup?next=%2Fsystem%2Fjoin";

/**
 * Journey 1 (spec §4.1): the safe deep link a member should land on after verify. Unsafe, missing, or another
 * /system/join URL (loop) -> MEMBERS_HOME. Same-site relative paths only (safeNextPath).
 */
export function memberNext(next: string | null | undefined): string {
  const p = safeNextPath(next, MEMBERS_HOME);
  return /^\/system\/join(?:[/?#]|$)/.test(p) ? MEMBERS_HOME : p;
}

/** /system/join carrying a safe `next` (omitted when it would just be MEMBERS_HOME). */
export function joinPath(next: string | null | undefined): string {
  const p = memberNext(next);
  return p === MEMBERS_HOME ? "/system/join" : `/system/join?next=${encodeURIComponent(p)}`;
}

/** Login / signup that come back to /system/join with the same safe `next`. */
export function joinLoginPath(next: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(joinPath(next))}`;
}
export function joinSignupPath(next: string | null | undefined): string {
  return `/signup?next=${encodeURIComponent(joinPath(next))}`;
}
