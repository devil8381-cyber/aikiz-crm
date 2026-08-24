import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const users = await db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
    })

    const callCounts = await db.activityLog.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: todayStart },
        action: { in: ["UPDATE_STATUS", "MARKED_VM", "COMPLETE_CALLBACK", "CALL_DISPOSITION"] },
      },
      _count: true,
    })
    const callMap: Record<string, number> = {}
    callCounts.forEach((c: any) => { callMap[c.userId] = c._count })

    const statusCounts = await db.lead.groupBy({
      by: ["assignedToId", "status"],
      _count: true,
    })

    const leaderboard = users.map((u) => {
      const userStatuses: Record<string, number> = {}
      statusCounts
        .filter((s: any) => s.assignedToId === u.id)
        .forEach((s: any) => { userStatuses[s.status] = s._count })

      const totalLeads = Object.values(userStatuses).reduce((a, b) => a + b, 0)
      const signed = userStatuses["Signed"] || 0
      const interested = userStatuses["Interested"] || 0
      const todayCalls = callMap[u.id] || 0

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        todayCalls,
        totalLeads,
        signed,
        interested,
        conversionRate: totalLeads > 0 ? Math.round((signed / totalLeads) * 100) : 0,
      }
    })

    leaderboard.sort((a, b) => b.todayCalls - a.todayCalls)

    return NextResponse.json({ leaderboard })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
