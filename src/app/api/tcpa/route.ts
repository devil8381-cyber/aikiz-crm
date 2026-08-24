import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const body = await req.json()
    const { leadId, formType } = body // formType: C1, C2, C3

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Check sequential order
    if (formType === "C2") {
      const c1 = await db.tcpaForm.findFirst({ where: { leadId, formType: "C1" } })
      if (!c1) return NextResponse.json({ error: "C-1 must be sent first" }, { status: 400 })
    }
    if (formType === "C3") {
      const c2 = await db.tcpaForm.findFirst({ where: { leadId, formType: "C2" } })
      if (!c2) return NextResponse.json({ error: "C-2 must be sent first" }, { status: 400 })
    }

    // Check if already sent
    const existing = await db.tcpaForm.findFirst({ where: { leadId, formType } })
    if (existing) {
      return NextResponse.json({ 
        message: "TCPA form link already generated",
        token: existing.token,
        formType: existing.formType,
      })
    }

    const token = uuidv4()
    const tcpaForm = await db.tcpaForm.create({
      data: { leadId, formType, token },
    })

    // Build the link
    const baseUrl = process.env.NEXTAUTH_URL || ""
    const link = `${baseUrl}/?token=${token}&mode=tcpa&form=${formType}`

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "GENERATE_TCPA_LINK",
        details: `Generated TCPA ${formType} link for ${lead.firstName} ${lead.lastName}`,
        leadId,
      },
    })

    return NextResponse.json({ token, link, formType, message: `TCPA ${formType} link generated` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}