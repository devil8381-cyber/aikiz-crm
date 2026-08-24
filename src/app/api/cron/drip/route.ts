import { NextRequest, NextResponse } from "next/server"
import { checkCronAuth } from "@/lib/cron-auth"
import { runDripCron } from "@/lib/drip"

// Call this on a schedule (e.g. every 15-30 min) from Vercel Cron or an external scheduler.
export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied
  try {
    const result = await runDripCron()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
