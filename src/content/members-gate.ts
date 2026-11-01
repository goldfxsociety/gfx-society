/**
 * Copy for the GFX Trading System members gate (proposal v5 §2). PH page = Taglish.
 * Consent + no-match strings are verbatim from the proposal. Everything else is minimal
 * placeholder copy: needs Design.
 */
export const SYSTEM_COPY = {
  title: "GFX Trading System",
  intro:
    "Members-only area ng GFX Society para sa mas malalim na Gold education: self-paced training, trade ideas for education, at group chat. Bukas pa rin sa lahat ang free Academy lessons.",
  whoTitle: "Sino ang puwedeng mag-join?",
  who: "Mga ACCM client na naka-register sa ilalim ng IB line ng GFX Society. Walang minimum deposit.",
  joinCta: "Join as member",
  risk: "Trading involves real risk of loss. Max 1% risk per trade, laging may stop loss. Education lang, not financial advice.",
} as const;

export const JOIN_COPY = {
  title: "Join the GFX Trading System",
  loginFirst: "Mag-log in muna gamit ang email mo para ma-verify ka.",
  loginCta: "Log in",
  verifyEmailFirst:
    "I-confirm muna ang email mo (check your inbox para sa confirmation link), tapos bumalik dito.",
  consentLead: "Members-only ang GFX Trading System.",
  consentBody:
    "Para ma-verify ka, iche-check namin kung ang email mo ay naka-register sa ACCM sa ilalim ng IB line ng GFX Society. Email lang ang gagamitin namin para dito; hindi namin nakikita o sine-save ang balance, deposit, o trades mo. Walang minimum deposit para maging member.",
  consentCheckbox: "Pumapayag ako sa email check na ito.",
  consentAfter: "Optional ang ACCM, at bukas pa rin sa lahat ang free Academy lessons.",
  privacyLink: "Privacy Policy",
  submit: "I-check ang email ko",
  consentRequired: "I-tick muna ang consent box para ma-check namin ang email mo.",
  matched: "Welcome, member ka na!",
  matchedCta: "Pumunta sa members area",
  noMatch: "Hindi pa namin ma-verify ang email na ito.",
  noMatchLearn: "Ituloy ang free Academy lessons",
  noMatchContact: "Iba ang email mo sa ACCM? Contact goldfx.society@gmail.com",
  noMatchMonthly: "Just registered? Monthly ina-update ang member list.",
  noMatchPartner: "Tungkol sa ACCM (optional)",
  rateLimited: "Masyadong maraming try. Subukan ulit after 1 hour.",
  error: "May error sa pag-check. Try ulit mamaya, o mag-email sa goldfx.society@gmail.com.",
} as const;

export const MEMBERS_COPY = {
  title: "Members area",
  body: "Verified member ka na. Dito ilalagay ang training, trade ideas for education, at group chat kapag ready na.",
  grace:
    "Hindi na namin ma-verify ang ACCM registration mo, contact us kung mali: goldfx.society@gmail.com",
} as const;
