/** Where a verified member lands after consent (Design Addendum C, F1). /system/members redirects here. */
export const MEMBERS_HOME = "/training";

/** /system/join for a logged-out visitor: log in with the Academy account, then come back to consent. */
export const JOIN_LOGIN_PATH = "/login?next=%2Fsystem%2Fjoin";
/** No Academy account yet: sign up, confirm the email, then land back on /system/join. */
export const JOIN_SIGNUP_PATH = "/signup?next=%2Fsystem%2Fjoin";
