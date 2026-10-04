import { NextResponse } from "next/server";
import { deploymentSha, trackSystemEvent } from "@/app/lib/telemetry";

export function GET() {
  trackSystemEvent("HealthCheck", { route: "/api/health" });

  return NextResponse.json({ status: "ok", deploymentSha });
}
