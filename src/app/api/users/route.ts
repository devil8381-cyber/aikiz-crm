import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, phoneDisplay: true, createdAt: true, _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(users)
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
    const hashedPassword = await bcrypt.hash(body.password || "password123", 10)

    const newUser = await db.user.create({
      data: { name: body.name, email: body.email, password: hashedPassword, role: body.role || "AGENT", phoneDisplay: body.phoneDisplay || "" },
    })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE_USER",
        details: `Created user: ${newUser.name} (${newUser.email}) as ${newUser.role}`,
      },
    })

    return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}