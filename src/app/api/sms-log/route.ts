import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { completeSmsStep } from "@/lib/drip"

/**
 * Since SMS is sent client-side (the agent's own phone/Zoom app), this endpoint
 * is fired right after the agent triggers the send, purely to keep an audit
 * trail and lastContactedAt in sync. If the SMS was completing a queued drip
 * step, pass dripSequenceType to advance that enrollment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const body = await req.json()
    const { leadId, title, smsBody, dripSequenceType } = body
    if (!leadId || !smsBody) {
      return NextResponse.json({ error: "leadId and smsBody required" }, { status: 400 })
    }

    const smsLog = await db.smsLog.create({
      data: {
        leadId,
        userId: user.id,
        title: title || "",
        body: smsBody,
        source: dripSequenceType ? "drip" : "manual",
      },
    })

    await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } })

    await db.activityLog.create({
      data: { userId: user.id, leadId, action: "SEND_SMS", details: `Sent SMS: ${smsBody.slice(0, 120)}` },
    })

    if (dripSequenceType) {
      await completeSmsStep(leadId, dripSequenceType)
    }

    return NextResponse.json({ smsLog })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
