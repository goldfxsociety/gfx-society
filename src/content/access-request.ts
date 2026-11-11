/**
 * Access journey v2 copy (GFX Design spec access-journey-spec.md §5, §7, §9; v2 final, 11 Nov 2026). Verbatim.
 * PH routes use REQUEST_COPY / TRANSFER_COPY (Taglish). The *_EN objects are the spec's EN strings for /en only;
 * there is no /en join route yet, so they are not rendered in this build.
 * Waiting copy names only the next 1st (§12.1 option A: monthly refresh only, no faster check is live).
 */

/** Consent version stored on access_requests.consent_version (SQL: submit_access_request). */
export const REQUEST_CONSENT_VERSION = "request-v1";

export const REQUEST_COPY = {
  openLink: "Hindi pa naka-verify? I-request dito.",
  heading: "Request access",
  intro:
    "Kung ACCM client ka sa ilalim ng GFX Society o ng sub-IB nito, i-request dito. Automatic namin itong iche-check sa susunod na monthly update ng member list (every 1st of the month).",
  academyEmailLabel: "Academy email mo",
  accmEmailLabel: "ACCM email (kung iba sa Academy email)",
  accmEmailHelper: "Kailangan naming i-confirm ang email na ito, kaya may ipapadala kaming link.",
  ibNameLabel: "IB o sub-IB name (optional)",
  consent:
    "Pumapayag ako na i-check ng GFX Society ang email(s) na ito sa ACCM member data sa bawat monthly update. Email at IB name lang ang sine-save namin, para i-check ang membership sa bawat refresh. Kung gusto mong burahin ang data na ito, mag-email sa goldfx.society@gmail.com.",
  privacyLink: "Privacy Policy",
  submit: "I-submit ang request",
  submittedPending:
    "Natanggap na ang request mo. Iche-check namin ito sa susunod na monthly update (every 1st of the month), at sa bawat update pagkatapos nito hanggang ma-match. Pag na-match, automatic kang maa-add, at makikita mo na ang Trading System pag nag-log in ka. Wala ka nang kailangang gawin.",
  submittedAwaiting:
    "Halos tapos na. I-click ang confirmation link na pinadala namin sa ACCM email mo (check din ang Spam o Promotions). Iche-check lang namin ang request pag na-confirm na ito.",
  confirmedLanding: "Na-confirm na ang ACCM email mo. Iche-check namin ito sa susunod na monthly update.",
  activeRequest: (submitted: string, nextFirst: string) =>
    `May active request ka na, submitted ${submitted}. Iche-check ito sa ${nextFirst}, at sa bawat monthly update hanggang ma-match.`,
  updateLink: "I-update ang request",
  invalidEmail: "Pakilagay ang tamang email address.",
  sameEmail: "Same ito sa Academy email mo. Iwanang blank kung pareho.",
  consentRequired: "I-tick muna ang consent box.",
  rateLimited: "Medyo marami nang tries. Maghintay muna nang kaunti, tapos subukan ulit.",
  noAccmLink: "Wala ka pang ACCM account?",
} as const;

export const REQUEST_COPY_EN = {
  openLink: "Not verified yet? Request access here.",
  heading: "Request access",
  intro:
    "If you're an ACCM client under GFX Society or one of its sub-IBs, request access here. We'll check it automatically at the next monthly member-list update (on the 1st of each month).",
  academyEmailLabel: "Your Academy email",
  accmEmailLabel: "ACCM email (if different from your Academy email)",
  accmEmailHelper: "We'll send a link to confirm this email.",
  ibNameLabel: "IB or sub-IB name (optional)",
  consent:
    "I agree that GFX Society may check these email(s) against ACCM member data at each monthly update. We only save the email(s) and IB name, so we can check membership at each refresh. To ask us to delete this data, email goldfx.society@gmail.com.",
  privacyLink: "Privacy Policy",
  submit: "Submit request",
  submittedPending:
    "Request received. We'll check it at the next monthly update (on the 1st of each month), and at every update after that until it matches. If it matches, you'll be added automatically and can open the Trading System the next time you log in. Nothing else to do.",
  submittedAwaiting:
    "Almost done. Click the confirmation link we sent to your ACCM email (check Spam or Promotions too). We'll check your request once it's confirmed.",
  confirmedLanding: "Your ACCM email is confirmed. We'll check it at the next monthly update.",
  activeRequest: (submitted: string, nextFirst: string) =>
    `You already have an active request (submitted ${submitted}). It'll be checked on ${nextFirst}, and at every monthly update until it matches.`,
  updateLink: "Update request",
  invalidEmail: "Please enter a valid email address.",
  sameEmail: "That's your Academy email. Leave this blank if they're the same.",
  consentRequired: "Please tick the consent box first.",
  rateLimited: "Too many tries. Please wait a bit and try again.",
} as const;

/** Journey 4: ACCM client under a different IB. Template from Ben (via Jarvis, 11 Nov 2026), exactly. */
export const TRANSFER_TEMPLATE = {
  to: "csse@accmfx.com, roselle@accmfx.com",
  subject: "For Transfer IB",
  body: "Hi, please transfer my account to IB goldfx.society@gmail.com\n\nThank you.",
  mailto:
    "mailto:csse@accmfx.com,roselle@accmfx.com?subject=For%20Transfer%20IB&body=Hi%2C%20please%20transfer%20my%20account%20to%20IB%20goldfx.society%40gmail.com%0A%0AThank%20you.",
} as const;

/** Plain text the Copy button writes (labels included, spec §7). */
export const TRANSFER_TEMPLATE_TEXT = `To: ${TRANSFER_TEMPLATE.to}\nSubject: ${TRANSFER_TEMPLATE.subject}\n\n${TRANSFER_TEMPLATE.body}`;

export const TRANSFER_COPY = {
  link: "Naka-register ka na sa ACCM pero sa ibang IB?",
  step1: "I-email ang ACCM gamit ang template sa baba. Gamitin ang email na naka-register mo sa ACCM.",
  toLabel: "To",
  subjectLabel: "Subject",
  bodyLabel: "Body",
  caption: "Template mula sa GFX team. I-copy o i-open as is.",
  copy: "Copy",
  copied: "Copied",
  mailtoLabel: "Buksan sa email app",
  timing: "Hindi namin ma-promise kung gaano katagal ang transfer — naka-depende ito sa ACCM.",
  step2:
    "Kapag nai-move ka na ng ACCM under GFX, i-request ang access dito sa same request path. Iche-check ito sa susunod na monthly update (every 1st of the month).",
  clause54:
    "Huwag mag-open ng second account para magpalit ng IB. Kung naka-tag ka na sa ibang IB, pwede ring doon pa rin mapunta ang bagong account (ACCM IB Agreement, clause 5.4).",
} as const;

export const TRANSFER_COPY_EN = {
  link: "Already with ACCM under a different IB?",
  step1: "Email ACCM using the template below, from the email registered with ACCM.",
  toLabel: "To",
  subjectLabel: "Subject",
  bodyLabel: "Body",
  caption: "Template from the GFX team. Copy or open it as is.",
  copy: "Copy",
  copied: "Copied",
  mailtoLabel: "Open in your email app",
  timing: "We can't promise how long the transfer will take — timing depends on ACCM.",
  step2:
    "Once ACCM has moved you under GFX, request access here on the same request path. We'll check it at the next monthly update (on the 1st of each month).",
  clause54:
    "Don't open a second account to change IB. If you're already tagged to another IB, a new account may stay with that IB (ACCM IB Agreement, clause 5.4).",
} as const;

/** /accm and /broker post-registration next step (spec §6). */
export const JOIN_SYSTEM_CTA = "Join the Trading System";
