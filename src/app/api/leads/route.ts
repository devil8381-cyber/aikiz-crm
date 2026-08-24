import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { wsBroadcast } from "@/lib/ws-broadcast"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const user = session.user as any
    const where: any = {}

    // Agents only see their own leads
    if (user.role !== "ADMIN") {
      where.assignedToId = user.id
    }

    if (status && status !== "All") {
      where.status = status
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { claimNumber: { contains: search } },
      ]
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lead.count({ where }),
    ])

    return NextResponse.json({ leads, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const body = await req.json()
    const lead = await db.lead.create({
      data: {
        ...body,
        assignedToId: body.assignedToId || null,
      },
    })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE_LEAD",
        details: `Created lead: ${lead.firstName} ${lead.lastName} (${lead.phone})`,
        leadId: lead.id,
      },
    })

    wsBroadcast({
      type: "LEAD_CREATED",
      from: user.id,
      payload: { leadName: `${lead.firstName} ${lead.lastName}`, actorName: user.name },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}