/**
 * Set to false ONLY after a qualified Philippine lawyer has approved the texts
 * in src/content/legal/ and the consent wording/version below.
 */
export const LEGAL_DRAFT = false;

/** Bump when the signup consent wording changes. Stored with each consent record. */
export const SIGNUP_CONSENT_VERSION = "signup-consent-v1";

/**
 * TODO(retention): Ben to set the retention period for data ACCM shares with
 * the IB (client agreement s.11) BEFORE MERGE, then add it to the privacy notice
 * retention table (§7). Not rendered anywhere while null.
 */
export const ACCM_SHARED_DATA_RETENTION: string | null = null;
