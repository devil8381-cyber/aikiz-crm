import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const settings = await db.systemSetting.findMany()
    const map: Record<string, string> = {}
    settings.forEach((s: any) => { map[s.key] = s.value })

    return NextResponse.json({
      dailyCallTarget: parseInt(map["daily_call_target"] || "50", 10),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const body = await req.json()
    const { dailyCallTarget } = body

    if (typeof dailyCallTarget !== "number" || dailyCallTarget < 1 || dailyCallTarget > 999) {
      return NextResponse.json({ error: "dailyCallTarget must be between 1 and 999" }, { status: 400 })
    }

    await db.systemSetting.upsert({
      where: { key: "daily_call_target" },
      update: { value: String(dailyCallTarget) },
      create: { key: "daily_call_target", value: String(dailyCallTarget) },
    })

    return NextResponse.json({ message: "Settings updated", dailyCallTarget })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
