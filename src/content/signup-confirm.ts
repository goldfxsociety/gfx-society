/**
 * Signup "check your email" state (Confirm email ON). Balanced Taglish. Neutral: the same screen shows for a
 * new account and for an email that already has one, so it never says whether an account exists.
 * [Builder] new strings, need a GFX Design check.
 */
export const SIGNUP_CONFIRM_COPY = {
  title: "Check your email",
  body:
    "Kung bago ang account na ito, may confirmation link kaming pinadala sa email na inilagay mo. I-click ang link para ma-activate ang account mo. Check din ang Spam o Promotions folder.",
  existing: "May account ka na? Log in na lang.",
  loginLink: "Go to login",
} as const;
