import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const { searchParams } = new URL(req.url)
    const isPolling = searchParams.get("poll") === "1"
    const afterCursor = searchParams.get("after") || ""
    const userId = searchParams.get("userId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    // Polling endpoint: any authenticated user can check recent activity
    // Full activity log: admin only
    if (!isPolling && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const where: any = {}
    if (userId) where.userId = userId
    if (afterCursor) {
      const afterDate = new Date(afterCursor)
      if (Number.isNaN(afterDate.getTime())) {
        return NextResponse.json({ error: "Invalid activity cursor" }, { status: 400 })
      }
      where.createdAt = { gt: afterDate }
    }

    // For polling, only return recent items
    const takeLimit = isPolling ? Math.min(limit, 10) : limit

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: isPolling ? 0 : (page - 1) * takeLimit,
        take: takeLimit,
      }),
      isPolling ? Promise.resolve(0) : db.activityLog.count({ where }),
    ])

    if (isPolling) {
      // Return a cursor even for an empty initial response, so subsequent
      // requests only fetch activity created after this point.
      const newestCreatedAt = logs.reduce<Date>((latest, log) => (
        log.createdAt > latest ? log.createdAt : latest
      ), new Date())
      return NextResponse.json({ logs, nextCursor: newestCreatedAt.toISOString() })
    }

    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / takeLimit) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
