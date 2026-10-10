/**
 * /go/<code> attribution links — see GFX Intelligence "UTM convention + invite-link scheme".
 * Post codes: <platformcode><yymmdd>_<slug>, platform codes fb/ig/tt/x  (e.g. fb261012_lotsize)
 * Bio codes:  <platformcode>_bio                                         (e.g. ig_bio)
 * Referrals:  ref_<membercode>                                           (e.g. ref_m0042) — member codes, never names.
 */
export const DEFAULT_CAMPAIGN = "gold_pilot_2026q4";

/** TODO(founder): the GFX Society Messenger community invite link. Null = button hidden. */
export const MESSENGER_INVITE_URL: string | null = null;

const SOURCES: Record<string, string> = {
  fb: "facebook",
  ig: "instagram",
  tt: "tiktok",
  x: "x",
};

export type GoTarget = {
  code: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  /** Internal landing path with UTMs applied. */
  href: string;
};

const CODE_RE = /^[a-z0-9_]{2,40}$/;

export function resolveGoCode(raw: string): GoTarget | null {
  const code = raw.toLowerCase();
  if (!CODE_RE.test(code)) return null;

  let source: string;
  let medium: string;
  if (code.startsWith("ref_")) {
    source = "referral";
    medium = "member";
  } else {
    const m = /^(fb|ig|tt|x)(\d{6})?_/.exec(code);
    if (!m) return null;
    source = SOURCES[m[1]];
    medium = m[2] ? "organic_post" : code.endsWith("_bio") ? "bio" : "organic_post";
  }

  const qs = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: DEFAULT_CAMPAIGN,
    utm_content: code,
  });
  return { code, source, medium, campaign: DEFAULT_CAMPAIGN, content: code, href: `/academy?${qs}` };
}
