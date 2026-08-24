import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { wsBroadcast } from "@/lib/ws-broadcast"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        callbacks: { orderBy: { createdAt: "desc" } },
        tcpaForms: { orderBy: { createdAt: "desc" } },
        documentRequests: { orderBy: { createdAt: "desc" } },
        emailLogs: { orderBy: { createdAt: "desc" } },
        activityLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    return NextResponse.json(lead)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const { id } = await params
    const body = await req.json()

    if (body._delete && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    if (body._delete) {
      const lead = await db.lead.findUnique({ where: { id } })
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
      await db.lead.delete({ where: { id } })
      await db.activityLog.create({
        data: {
          userId: user.id,
          action: "DELETE_LEAD",
          details: `Deleted lead: ${lead.firstName} ${lead.lastName}`,
        },
      })
      try { wsBroadcast({ type: "LEAD_DELETED", from: user.id, payload: { leadName: `${lead.firstName} ${lead.lastName}`, actorName: user.name } }) } catch {}
      return NextResponse.json({ message: "Lead deleted" })
    }

    const { _delete, callbackData, disposition, ...updateData } = body as any

    // Track status changes
    if (updateData.status) {
      const oldLead = await db.lead.findUnique({ where: { id } })
      if (oldLead && oldLead.status !== updateData.status) {
        // Any fresh disposition clears a prior stale-lead escalation flag
        if (oldLead.escalated) {
          updateData.escalated = false
          updateData.escalatedAt = null
        }
        await db.activityLog.create({
          data: {
            userId: user.id,
            action: "CALL_DISPOSITION",
            details: `Changed status from "${oldLead.status}" to "${updateData.status}" for ${oldLead.firstName} ${oldLead.lastName}`,
            leadId: id,
            disposition: updateData.status,
          },
        })
        try { wsBroadcast({ type: "LEAD_UPDATED", from: user.id, payload: { leadName: `${oldLead.firstName} ${oldLead.lastName}`, oldStatus: oldLead.status, newStatus: updateData.status, actorName: user.name } }) } catch {}

        // A disposition was just given - close out any still-pending callback(s)
        // for this lead so they stop showing on the Dashboard. If the new
        // disposition is itself "Callback", a fresh callback record is created
        // right below, so this only clears the OLD one(s).
        await db.callback.updateMany({
          where: { leadId: id, isCompleted: false },
          data: { isCompleted: true },
        })
      }
    }

    // Handle callback creation
    if (updateData.status === "Callback" && callbackData) {
      const cb = callbackData
      await db.callback.create({
        data: {
          leadId: id,
          userId: user.id,
          callbackDate: cb.callbackDate,
          callbackTime: cb.callbackTime,
          ampm: cb.ampm,
          timezone: cb.timezone,
        },
      })
      const leadData = await db.lead.findUnique({ where: { id } })
      try { wsBroadcast({ type: "CALLBACK_SCHEDULED", from: user.id, payload: { leadName: `${leadData?.firstName} ${leadData?.lastName}`, actorName: user.name, callbackDate: cb.callbackDate, callbackTime: cb.callbackTime } }) } catch {}
    }

    const lead = await db.lead.update({ where: { id }, data: updateData })

    if (updateData.status === "VM") {
      await db.activityLog.create({
        data: {
          userId: user.id,
          action: "MARKED_VM",
          details: `Marked as Voicemail for ${lead.firstName} ${lead.lastName} (${lead.phone})`,
          leadId: id,
          disposition: "VM",
        },
      })
    }

    return NextResponse.json(lead)
  } catch (error: any) {
    console.error("PATCH /api/leads/[id]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
