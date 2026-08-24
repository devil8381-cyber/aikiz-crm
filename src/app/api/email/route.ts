import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  DEFAULT_TEMPLATES,
  EMAIL_TYPE_META,
  fillEmailTemplate,
  toProfessionalHtml,
  type EmailType,
  DEPARTMENT,
  DEFAULT_CONSENT_LINK,
} from "@/lib/email-defaults"
import { fromAddressForType, sendFirmMail } from "@/lib/mail"
import { withTracking } from "@/lib/email-tracking"
import { enrollInDrip } from "@/lib/drip"

const VALID: EmailType[] = ["TCPA_C1", "TCPA_C2", "TCPA_C3", "MEDICAL_RECORDS", "MISSED_CALL", "FOLLOWUP_VM", "REQUEST_DOCS"]

async function resolveTemplate(userId: string, emailType: EmailType) {
  const saved = await db.emailTemplate.findUnique({
    where: { userId_emailType: { userId, emailType } },
  })
  const defaults = DEFAULT_TEMPLATES[emailType]
  const meta = EMAIL_TYPE_META[emailType]
  return {
    subject: saved?.subject || defaults.subject,
    body: saved?.body || defaults.body,
    link: saved?.link || meta.defaultLink || DEFAULT_CONSENT_LINK,
  }
}

/** Preview email — does not send */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    const leadId = req.nextUrl.searchParams.get("leadId")
    const emailType = req.nextUrl.searchParams.get("emailType") as EmailType
    if (!leadId || !VALID.includes(emailType)) {
      return NextResponse.json({ error: "leadId and emailType required" }, { status: 400 })
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const agent = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, phoneDisplay: true, email: true },
    })

    const tpl = await resolveTemplate(user.id, emailType)
    const vars = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      agentName: agent?.name || user.name || "Case Manager",
      agentPhone: agent?.phoneDisplay || "",
      consentLink: tpl.link || DEFAULT_CONSENT_LINK,
      department: DEPARTMENT,
    }
    const subject = fillEmailTemplate(tpl.subject, vars)
    const text = fillEmailTemplate(tpl.body, vars)
    const { email: fromEmail, account } = await fromAddressForType(emailType)

    return NextResponse.json({
      to: lead.email || "",
      from: fromEmail,
      fromAccount: account,
      subject,
      text,
      html: toProfessionalHtml(text, vars.consentLink),
      leadName: `${lead.firstName} ${lead.lastName}`,
      hasEmail: Boolean(lead.email?.trim()),
      emailType,
      label: EMAIL_TYPE_META[emailType].label,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Send email after user confirms */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const body = await req.json()
    const emailType = body.emailType as EmailType
    const leadId = body.leadId as string
    if (!leadId || !VALID.includes(emailType)) {
      return NextResponse.json({ error: "leadId and emailType required" }, { status: 400 })
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (!lead.email?.trim()) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    }

    const agent = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, phoneDisplay: true, email: true },
    })

    const tpl = await resolveTemplate(user.id, emailType)
    // Allow confirmed override from preview
    const vars = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      agentName: agent?.name || user.name || "Case Manager",
      agentPhone: agent?.phoneDisplay || "",
      consentLink: body.consentLink || tpl.link || DEFAULT_CONSENT_LINK,
      department: DEPARTMENT,
    }
    const subject = body.subject || fillEmailTemplate(tpl.subject, vars)
    const text = body.text || fillEmailTemplate(tpl.body, vars)
    const { email: fromEmail, account } = await fromAddressForType(emailType)

    // Create the log row first so we have a trackToken to embed in the HTML
    const emailLog = await db.emailLog.create({
      data: { leadId, userId: user.id, emailType, to: lead.email, subject, status: "SENT" },
    })

    const baseUrl = process.env.NEXTAUTH_URL || ""
    const html = withTracking(
      toProfessionalHtml(text, vars.consentLink),
      emailLog.trackToken || "",
      baseUrl
    )

    const result = await sendFirmMail({
      account,
      to: lead.email,
      subject,
      text,
      html,
      replyTo: fromEmail,
    })

    const now = new Date()
    await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: now } })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "SEND_EMAIL",
        details: `Sent ${emailType} from ${fromEmail} to ${lead.firstName} ${lead.lastName} (${lead.email})`,
        leadId,
      },
    })

    // Kick off the missed-contact drip the moment we email someone we couldn't reach
    if (emailType === "MISSED_CALL") {
      await enrollInDrip(leadId, "MISSED_CONTACT")
    }

    return NextResponse.json({
      message: `Email sent from ${fromEmail}`,
      from: fromEmail,
      to: lead.email,
      messageId: result.messageId,
      emailLog,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Send failed" }, { status: 500 })
  }
}
