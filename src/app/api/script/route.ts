import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const script = await db.script.findFirst({ orderBy: { updatedAt: "desc" } })
    return NextResponse.json(script || { title: "", content: "" })
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
    const existing = await db.script.findFirst({ orderBy: { updatedAt: "desc" } })

    let script
    if (existing) {
      script = await db.script.update({ where: { id: existing.id }, data: { title: body.title, content: body.content } })
    } else {
      script = await db.script.create({ data: { title: body.title || "Main Calling Script", content: body.content } })
    }

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_SCRIPT",
        details: `Updated script: ${script.title}`,
      },
    })

    return NextResponse.json(script)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}