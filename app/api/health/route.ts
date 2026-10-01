import { NextResponse } from "next/server";
import { deploymentSha, trackEvent } from "@/app/lib/telemetry";

export function GET() {
  trackEvent("HealthCheck", { route: "/api/health" });

  return NextResponse.json({ status: "ok", deploymentSha });
}
