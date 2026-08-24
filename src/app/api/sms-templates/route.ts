import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const DEFAULT_BODY = `Hi {{firstName}}, this is {{agentName}} with Matthews & Associates, your case manager on the Depo-Provera claim. I tried reaching you and have a time-sensitive update on your case. Please call me back at {{agentPhone}} when you have a moment. Thank you!`

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    const agentId = req.nextUrl.searchParams.get("userId")

    if (user.role === "ADMIN" && agentId) {
      const templates = await db.smsTemplate.findMany({
        where: { userId: agentId },
        orderBy: { updatedAt: "desc" },
      })
      const agent = await db.user.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, phoneDisplay: true, email: true },
      })
      return NextResponse.json({ templates, agent })
    }

    if (user.role === "ADMIN" && !agentId) {
      const users = await db.user.findMany({
        where: { role: { in: ["AGENT", "ADMIN"] } },
        select: {
          id: true,
          name: true,
          email: true,
          phoneDisplay: true,
          role: true,
          smsTemplates: { orderBy: { updatedAt: "desc" } },
        },
        orderBy: { name: "asc" },
      })
      return NextResponse.json({ users })
    }

    // Agent: own templates + profile
    const templates = await db.smsTemplate.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, phoneDisplay: true },
    })
    return NextResponse.json({ templates, agent: me })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    const body = await req.json()

    // Admin can create for any agent; agent only for self
    let targetUserId = user.id
    if (user.role === "ADMIN" && body.userId) targetUserId = body.userId
    if (user.role !== "ADMIN" && body.userId && body.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tpl = await db.smsTemplate.create({
      data: {
        userId: targetUserId,
        title: body.title || "SMS Template",
        body: body.body || DEFAULT_BODY,
        isDefault: body.isDefault !== false,
      },
    })

    if (body.phoneDisplay !== undefined && user.role === "ADMIN") {
      await db.user.update({
        where: { id: targetUserId },
        data: { phoneDisplay: body.phoneDisplay },
      })
    }

    return NextResponse.json(tpl, { status: 201 })
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

    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await db.smsTemplate.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (user.role !== "ADMIN" && existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updated = await db.smsTemplate.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      },
    })

    if (body.phoneDisplay !== undefined && user.role === "ADMIN") {
      await db.user.update({
        where: { id: existing.userId },
        data: { phoneDisplay: String(body.phoneDisplay) },
      })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    const id = req.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await db.smsTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (user.role !== "ADMIN" && existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.smsTemplate.delete({ where: { id } })
    return NextResponse.json({ message: "Deleted" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export { DEFAULT_BODY }
