import { NextRequest, NextResponse } from "next/server"
import { checkCronAuth } from "@/lib/cron-auth"
import { db } from "@/lib/db"
import { enrollInDrip } from "@/lib/drip"

const OPENED_NO_UPLOAD_MS = 1 * 24 * 60 * 60 * 1000 // opened but didn't upload within 1 day
const NEVER_OPENED_MS = 2 * 24 * 60 * 60 * 1000 // never opened within 2 days

// Call this daily. Finds document requests the claimant hasn't completed and
// enrolls their lead in the DOC_REMINDER drip (actual reminders are sent by /api/cron/drip).
export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied
  try {
    const now = Date.now()
    const idle = await db.documentRequest.findMany({
      where: { isUsed: false },
      select: { id: true, leadId: true, openedAt: true, createdAt: true },
    })

    let enrolled = 0
    for (const d of idle) {
      const dueOpened = d.openedAt && now - d.openedAt.getTime() > OPENED_NO_UPLOAD_MS
      const dueNeverOpened = !d.openedAt && now - d.createdAt.getTime() > NEVER_OPENED_MS
      if (dueOpened || dueNeverOpened) {
        await enrollInDrip(d.leadId, "DOC_REMINDER")
        enrolled++
      }
    }

    return NextResponse.json({ checked: idle.length, enrolled })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
