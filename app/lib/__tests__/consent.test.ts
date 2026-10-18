import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConsentCookieString,
  hasAnalyticsConsent,
  readConsentCookie,
} from "../consent.ts";

test("readConsentCookie returns unset when no cookie header", () => {
  assert.equal(readConsentCookie(null), "unset");
  assert.equal(readConsentCookie(undefined), "unset");
  assert.equal(readConsentCookie(""), "unset");
});

test("readConsentCookie parses granted/denied/unknown values", () => {
  assert.equal(readConsentCookie("consent-analytics=granted"), "granted");
  assert.equal(readConsentCookie("consent-analytics=denied"), "denied");
  assert.equal(readConsentCookie("consent-analytics=garbage"), "unset");
});

test("readConsentCookie parses among multiple cookies", () => {
  assert.equal(
    readConsentCookie("foo=bar; consent-analytics=granted; baz=qux"),
    "granted"
  );
});

test("hasAnalyticsConsent is true only when granted", () => {
  assert.equal(hasAnalyticsConsent("consent-analytics=granted"), true);
  assert.equal(hasAnalyticsConsent("consent-analytics=denied"), false);
  assert.equal(hasAnalyticsConsent(null), false);
});

test("buildConsentCookieString encodes the decision with a 1-year Max-Age", () => {
  const granted = buildConsentCookieString("granted");
  assert.match(granted, /^consent-analytics=granted/);
  assert.match(granted, /Max-Age=31536000/);
  assert.match(granted, /SameSite=Lax/);
  assert.match(granted, /; Secure$/);

  const denied = buildConsentCookieString("denied");
  assert.match(denied, /^consent-analytics=denied/);
  assert.match(denied, /; Secure$/);
});
