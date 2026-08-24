import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { DEFAULT_TEMPLATES, DEPARTMENT, fillEmailTemplate, toProfessionalHtml } from "@/lib/email-defaults"
import { fromAddressForType, sendFirmMail } from "@/lib/mail"

// Generate a medical records link for a lead
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: "Lead ID required" }, { status: 400 })

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (!lead.email?.trim()) return NextResponse.json({ error: "This claimant has no email address. Add an email address before sending a records request." }, { status: 400 })

    // Agents can only request for their own leads
    if (user.role !== "ADMIN" && lead.assignedToId !== user.id) {
      return NextResponse.json({ error: "Not your lead" }, { status: 403 })
    }

    // A retry should resend the existing pending request instead of creating
    // several active medical-upload links for the same claimant.
    const record = await db.medicalRecord.findFirst({
      where: { leadId, uploadedAt: null },
      orderBy: { createdAt: "desc" },
    }) || await db.medicalRecord.create({ data: { leadId } })

    // NEXTAUTH_URL is often intentionally omitted by hosting platforms. Build
    // an absolute link from the request in that case so the claimant can open
    // it outside the CRM, rather than receiving a broken relative URL.
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.BASE_URL || new URL(req.url).origin).replace(/\/$/, "")
    const link = `${baseUrl}/?${new URLSearchParams({ token: record.token, mode: "medical" }).toString()}`

    const agent = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, phoneDisplay: true },
    })
    const emailType = "MEDICAL_RECORDS" as const
    const variables = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      agentName: agent?.name || user.name || "Case Manager",
      agentPhone: agent?.phoneDisplay || "",
      consentLink: link,
      department: DEPARTMENT,
    }
    const subject = fillEmailTemplate(DEFAULT_TEMPLATES[emailType].subject, variables)
    const text = fillEmailTemplate(DEFAULT_TEMPLATES[emailType].body, variables)
    const { email: fromEmail, account } = await fromAddressForType(emailType)

    try {
      await sendFirmMail({
        account,
        to: lead.email,
        subject,
        text,
        html: toProfessionalHtml(text, link),
        replyTo: fromEmail,
      })
    } catch (error: any) {
      return NextResponse.json({ error: error.message || "The secure records email could not be sent." }, { status: 502 })
    }

    await db.emailLog.create({
      data: { leadId, userId: user.id, emailType, to: lead.email, subject, status: "SENT" },
    })
    await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } })
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "SEND_MEDICAL_RECORDS_REQUEST",
        details: `Sent secure records request from ${fromEmail} to ${lead.firstName} ${lead.lastName} (${lead.email})`,
        leadId,
      },
    })

    return NextResponse.json({ id: record.id, emailed: true, to: lead.email, from: fromEmail })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// List medical records for agent's leads (admin sees all)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get("leadId")

    if (leadId) {
      // Return records for a specific lead (with permission check)
      const lead = await db.lead.findUnique({ where: { id: leadId } })
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
      if (user.role !== "ADMIN" && lead.assignedToId !== user.id) {
        return NextResponse.json({ error: "Not your lead" }, { status: 403 })
      }
      const records = await db.medicalRecord.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ records })
    }

    // Return all records for the agent's leads
    const where: any = {}
    if (user.role !== "ADMIN") {
      where.lead = { assignedToId: user.id }
    }

    const records = await db.medicalRecord.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, claimNumber: true, assignedToId: true, assignedTo: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ records })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
