import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { wsBroadcast } from "@/lib/ws-broadcast"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get("active") === "true"

    const where: any = { isCompleted: false }
    if (user.role !== "ADMIN") {
      where.userId = user.id
    }

    const callbacks = await db.callback.findMany({
      where: activeOnly ? where : {},
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, caseType: true, claimNumber: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(callbacks)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const body = await req.json()
    const callback = await db.callback.update({
      where: { id: body.id },
      data: { isCompleted: true },
    })

    const lead = await db.lead.findUnique({ where: { id: callback.leadId } })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "COMPLETE_CALLBACK",
        details: `Completed callback for ${lead?.firstName} ${lead?.lastName}`,
        leadId: callback.leadId,
      },
    })

    wsBroadcast({
      type: "CALLBACK_COMPLETED",
      from: user.id,
      payload: { leadName: `${lead?.firstName} ${lead?.lastName}`, actorName: user.name },
    })

    return NextResponse.json(callback)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}