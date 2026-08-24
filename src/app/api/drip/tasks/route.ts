import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getPendingSms } from "@/lib/drip"

/** Queued SMS steps waiting on an agent to actually send them. */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const where =
      user.role === "ADMIN"
        ? { status: "active", awaitingAgent: true }
        : { status: "active", awaitingAgent: true, lead: { assignedToId: user.id } }

    const enrollments = await db.dripEnrollment.findMany({
      where,
      include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true, assignedToId: true } } },
      orderBy: { updatedAt: "asc" },
    })

    const tasks = await Promise.all(
      enrollments.map(async (e) => ({
        enrollmentId: e.id,
        sequenceType: e.sequenceType,
        lead: e.lead,
        sms: await getPendingSms(e.id),
      }))
    )

    return NextResponse.json({ tasks: tasks.filter((t) => t.sms) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
