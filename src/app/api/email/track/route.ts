import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
)

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t")
  const redirectTo = req.nextUrl.searchParams.get("r")
  const isPixel = req.nextUrl.searchParams.get("px")

  if (token) {
    try {
      if (isPixel) {
        await db.emailLog.updateMany({
          where: { trackToken: token, openedAt: null },
          data: { openedAt: new Date() },
        })
        await db.emailLog.updateMany({
          where: { trackToken: token },
          data: { openCount: { increment: 1 } },
        })
      } else if (redirectTo) {
        await db.emailLog.updateMany({
          where: { trackToken: token, clickedAt: null },
          data: { clickedAt: new Date() },
        })
        await db.emailLog.updateMany({
          where: { trackToken: token },
          data: { clickCount: { increment: 1 } },
        })
      }
    } catch {
      // never let tracking failures break the recipient's experience
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(redirectTo)
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  })
}
