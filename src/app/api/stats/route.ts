import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const where: any = {}
    if (user.role !== "ADMIN") where.assignedToId = user.id

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalLeads,
      statusCounts,
      pendingCallbacks,
      todayCallbacks,
      todayLeads,
      todayCalls,
      settings,
    ] = await Promise.all([
      db.lead.count({ where }),
      db.lead.groupBy({ by: ["status"], where, _count: true }),
      db.callback.count({ where: { isCompleted: false, ...(user.role !== "ADMIN" ? { userId: user.id } : {}) } }),
      db.callback.count({
        where: {
          isCompleted: false,
          callbackDate: new Date().toISOString().split("T")[0],
          ...(user.role !== "ADMIN" ? { userId: user.id } : {})
        }
      }),
      db.lead.count({
        where: {
          ...where,
          createdAt: { gte: todayStart }
        }
      }),
      db.activityLog.count({
        where: {
          userId: user.id,
          createdAt: { gte: todayStart },
          action: { in: ["UPDATE_STATUS", "MARKED_VM", "COMPLETE_CALLBACK", "CALL_DISPOSITION"] },
        },
      }),
      db.systemSetting.findMany(),
    ])

    const statusMap: Record<string, number> = {}
    statusCounts.forEach((s: any) => { statusMap[s.status] = s._count })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s: any) => { settingsMap[s.key] = s.value })
    const dailyCallTarget = parseInt(settingsMap["daily_call_target"] || "50", 10)

    return NextResponse.json({
      totalLeads,
      statusBreakdown: statusMap,
      pendingCallbacks,
      todayCallbacks,
      todayLeads,
      todayCalls,
      dailyCallTarget,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
