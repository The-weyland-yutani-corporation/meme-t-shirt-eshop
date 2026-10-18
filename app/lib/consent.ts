/**
 * Consent-aware analytics gating (R-privacy).
 *
 * The storefront must not emit visitor-attributable analytics events
 * before the visitor has explicitly opted in. State is tracked with a
 * single first-party cookie (`consent-analytics`), readable both
 * server-side (from a request's `Cookie` header string) and client-side
 * (from `document.cookie`), so the same `hasAnalyticsConsent` /
 * `readConsentCookie` helpers work in Server Components, Route Handlers,
 * and the client-side banner.
 */

export const CONSENT_COOKIE_NAME = "consent-analytics";
const CONSENT_GRANTED = "granted";
const CONSENT_DENIED = "denied";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ConsentState = "granted" | "denied" | "unset";

/** Parses a raw `Cookie` header string into a name->value map. */
function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[name] = decodeURIComponent(value);
  }
  return result;
}

/** Reads the consent cookie's value from a raw `Cookie` header string. */
export function readConsentCookie(cookieHeader: string | null | undefined): ConsentState {
  if (!cookieHeader) return "unset";
  const value = parseCookieHeader(cookieHeader)[CONSENT_COOKIE_NAME];
  if (value === CONSENT_GRANTED) return "granted";
  if (value === CONSENT_DENIED) return "denied";
  return "unset";
}

/** Whether analytics events may be emitted for this visitor, per their cookie. */
export function hasAnalyticsConsent(cookieHeader: string | null | undefined): boolean {
  return readConsentCookie(cookieHeader) === "granted";
}

/** Builds a `Set-Cookie`-ready string for writing the consent decision. */
export function buildConsentCookieString(state: "granted" | "denied"): string {
  const value = state === "granted" ? CONSENT_GRANTED : CONSENT_DENIED;
  return `${CONSENT_COOKIE_NAME}=${value}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax; Secure`;
}

/** Client-side: reads the consent cookie from `document.cookie`. */
export function readConsentFromDocument(): ConsentState {
  if (typeof document === "undefined") return "unset";
  return readConsentCookie(document.cookie);
}

/** Client-side: writes the visitor's consent decision to `document.cookie`. */
export function writeConsentToDocument(state: "granted" | "denied"): void {
  if (typeof document === "undefined") return;
  document.cookie = buildConsentCookieString(state);
}
