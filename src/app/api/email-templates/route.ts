import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { DEFAULT_TEMPLATES, EMAIL_TYPE_META, type EmailType } from "@/lib/email-defaults"

const VALID = Object.keys(DEFAULT_TEMPLATES) as EmailType[]

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const agentId = req.nextUrl.searchParams.get("userId")
    if (!agentId) {
      const users = await db.user.findMany({
        where: { role: { in: ["AGENT", "ADMIN"] } },
        select: {
          id: true,
          name: true,
          email: true,
          phoneDisplay: true,
          emailTemplates: true,
        },
        orderBy: { name: "asc" },
      })
      return NextResponse.json({ users, types: EMAIL_TYPE_META, defaults: DEFAULT_TEMPLATES })
    }

    const templates = await db.emailTemplate.findMany({ where: { userId: agentId } })
    const agent = await db.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, phoneDisplay: true },
    })
    return NextResponse.json({ templates, agent, types: EMAIL_TYPE_META, defaults: DEFAULT_TEMPLATES })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const body = await req.json()
    const emailType = body.emailType as EmailType
    if (!VALID.includes(emailType) || !body.userId) {
      return NextResponse.json({ error: "userId and emailType required" }, { status: 400 })
    }
    const def = DEFAULT_TEMPLATES[emailType]
    const meta = EMAIL_TYPE_META[emailType]

    const tpl = await db.emailTemplate.upsert({
      where: { userId_emailType: { userId: body.userId, emailType } },
      create: {
        userId: body.userId,
        emailType,
        subject: body.subject || def.subject,
        body: body.body || def.body,
        link: body.link ?? meta.defaultLink,
      },
      update: {
        ...(body.subject !== undefined && { subject: body.subject }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.link !== undefined && { link: body.link }),
      },
    })

    if (body.phoneDisplay !== undefined) {
      await db.user.update({
        where: { id: body.userId },
        data: { phoneDisplay: String(body.phoneDisplay) },
      })
    }

    return NextResponse.json(tpl)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
