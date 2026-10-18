/**
 * Accessible, consent-gated analytics banner (R-privacy, R6).
 *
 * Shown until the visitor accepts/declines analytics cookies. Uses
 * `useSyncExternalStore` to read the consent cookie safely under
 * SSR/hydration (no mismatched client/server render), and writes the
 * visitor's choice back to the cookie via `app/lib/consent.ts` helpers.
 */
"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  readConsentFromDocument,
  writeConsentToDocument,
  type ConsentState,
} from "./consent.ts";

const CONSENT_CHANGED_EVENT = "consent-changed";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onStoreChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onStoreChange);
}

function getSnapshot(): ConsentState {
  return readConsentFromDocument();
}

function getServerSnapshot(): ConsentState {
  return "unset";
}

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const decide = useCallback((state: "granted" | "denied") => {
    writeConsentToDocument(state);
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }, []);

  if (consent !== "unset") {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "1rem",
        background: "#171717",
        color: "#ededed",
        zIndex: 1000,
      }}
    >
      <p style={{ margin: 0 }}>
        We use analytics cookies to understand how the storefront is used.
        You can accept or decline; declining disables analytics only.
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={() => decide("denied")}>
          Decline
        </button>
        <button type="button" onClick={() => decide("granted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
