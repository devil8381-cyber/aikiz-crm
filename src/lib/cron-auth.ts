import { NextRequest, NextResponse } from "next/server"

/**
 * Simple shared-secret check for cron-triggered endpoints.
 * Set CRON_SECRET in env, and have your scheduler (Vercel Cron, an external
 * cron job, etc.) call these routes with header: Authorization: Bearer <secret>
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed: if no secret is configured, refuse rather than run unauthenticated automation
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}
