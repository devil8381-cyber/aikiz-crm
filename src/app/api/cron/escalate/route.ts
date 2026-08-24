import { NextRequest, NextResponse } from "next/server"
import { checkCronAuth } from "@/lib/cron-auth"
import { db } from "@/lib/db"

const STALE_DAYS = 5
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000

// Call this daily. Flags leads sitting in "Callback" status with no contact
// in STALE_DAYS, and logs an activity entry so admins can see/reassign them.
export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied
  try {
    const cutoff = new Date(Date.now() - STALE_MS)

    const stale = await db.lead.findMany({
      where: {
        status: "Callback",
        escalated: false,
        OR: [{ lastContactedAt: { lt: cutoff } }, { lastContactedAt: null, updatedAt: { lt: cutoff } }],
      },
      select: { id: true, firstName: true, lastName: true, assignedToId: true },
    })

    for (const lead of stale) {
      await db.lead.update({ where: { id: lead.id }, data: { escalated: true, escalatedAt: new Date() } })
      await db.activityLog.create({
        data: {
          leadId: lead.id,
          userId: lead.assignedToId || null,
          action: "STALE_LEAD_ESCALATED",
          details: `${lead.firstName} ${lead.lastName} has been in Callback status for ${STALE_DAYS}+ days with no contact — flagged for admin review/reassignment.`,
        },
      })
    }

    return NextResponse.json({ escalated: stale.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
