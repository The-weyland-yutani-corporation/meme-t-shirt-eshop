import * as appInsights from "applicationinsights";
import { hasAnalyticsConsent } from "./consent.ts";

/**
 * Deployment SHA used to correlate telemetry with the revision that produced it.
 * Resolved once at module load from environment variables commonly populated by
 * CI/CD (GitHub Actions) or App Service deployment tooling. Falls back to
 * "unknown" so telemetry is never silently dropped when unset.
 */
export const deploymentSha: string =
  process.env.DEPLOYMENT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.WEBSITE_SHA ||
  process.env.SCM_COMMIT_ID ||
  "unknown";

let client: appInsights.TelemetryClient | undefined;

/**
 * Lazily initializes (once per process) and returns the Application Insights
 * telemetry client, or `undefined` when no connection string is configured
 * (e.g. local development). Safe to call from any server-side code path.
 */
export function getTelemetryClient(): appInsights.TelemetryClient | undefined {
  if (client) {
    return client;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    return undefined;
  }

  if (!appInsights.defaultClient) {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(false, false)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(false)
      .setSendLiveMetrics(false)
      .start();
  }

  client = appInsights.defaultClient;
  client.context.tags[client.context.keys.applicationVersion] = deploymentSha;
  client.commonProperties = {
    ...client.commonProperties,
    deploymentSha,
  };

  return client;
}

/**
 * Emits a custom event tagged with the deployment SHA, gated on the
 * visitor's analytics consent (read from the request's `Cookie` header).
 * No-ops when telemetry is not configured, or when the visitor has not
 * granted analytics consent — this event is visitor-attributable, so
 * consent is required before anything is sent (privacy-conscious
 * analytics, R-privacy).
 */
export function trackEvent(
  name: string,
  properties: Record<string, string> = {},
  cookieHeader: string | null | undefined
): void {
  if (!hasAnalyticsConsent(cookieHeader)) {
    return;
  }

  const telemetryClient = getTelemetryClient();
  if (!telemetryClient) {
    return;
  }

  telemetryClient.trackEvent({
    name,
    properties: {
      ...properties,
      deploymentSha,
    },
  });
}

/**
 * Emits a custom event for non-visitor-attributable operational signals
 * (e.g. health checks), which carry no personal/visitor data and are
 * therefore not subject to analytics consent gating.
 */
export function trackSystemEvent(
  name: string,
  properties: Record<string, string> = {}
): void {
  const telemetryClient = getTelemetryClient();
  if (!telemetryClient) {
    return;
  }

  telemetryClient.trackEvent({
    name,
    properties: {
      ...properties,
      deploymentSha,
    },
  });
}
