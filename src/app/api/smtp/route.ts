import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import nodemailer from "nodemailer"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const settings = await db.systemSetting.findMany({
      where: { key: { startsWith: "smtp_" } },
    })
    const map: Record<string, string> = {}
    settings.forEach((s: any) => { map[s.key] = s.value })

    return NextResponse.json({
      smtp_host: map["smtp_host"] || "",
      smtp_port: map["smtp_port"] || "465",
      smtp_secure: map["smtp_secure"] !== "false",
      smtp_from_name: map["smtp_from_name"] || "Matthews & Associates",
      smtp_consent_user: map["smtp_consent_user"] || "",
      smtp_consent_pass_set: !!map["smtp_consent_pass"],
      smtp_claims_user: map["smtp_claims_user"] || "",
      smtp_claims_pass_set: !!map["smtp_claims_pass"],
      configured: !!(map["smtp_host"] && map["smtp_consent_pass"]),
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
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const body = await req.json()
    const fields: Record<string, string> = {
      smtp_host: body.smtp_host || "",
      smtp_port: String(body.smtp_port || "465"),
      smtp_secure: body.smtp_secure !== false ? "true" : "false",
      smtp_from_name: body.smtp_from_name || "Matthews & Associates",
      smtp_consent_user: body.smtp_consent_user || "",
      smtp_claims_user: body.smtp_claims_user || "",
    }

    if (body.smtp_consent_pass) fields.smtp_consent_pass = body.smtp_consent_pass
    if (body.smtp_claims_pass) fields.smtp_claims_pass = body.smtp_claims_pass

    for (const [key, value] of Object.entries(fields)) {
      await db.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    return NextResponse.json({ message: "SMTP settings saved" })
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
    const testEmail = body.testEmail || user.email

    const settings = await db.systemSetting.findMany({
      where: { key: { startsWith: "smtp_" } },
    })
    const map: Record<string, string> = {}
    settings.forEach((s: any) => { map[s.key] = s.value })

    const host = map["smtp_host"] || process.env.SMTP_HOST
    const port = Number(map["smtp_port"] || process.env.SMTP_PORT || "465")
    const secure = (map["smtp_secure"] ?? "true") !== "false"
    const fromName = map["smtp_from_name"] || process.env.SMTP_FROM_NAME || "Matthews & Associates"
    const consentUser = map["smtp_consent_user"] || process.env.SMTP_CONSENT_USER || process.env.SMTP_USER
    const consentPass = map["smtp_consent_pass"] || process.env.SMTP_CONSENT_PASS || process.env.SMTP_PASS

    if (!host || !consentUser || !consentPass) {
      return NextResponse.json({ error: "SMTP host, user, and password are required. Save your SMTP settings first." }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user: consentUser, pass: consentPass } })
    await transporter.verify()

    const info = await transporter.sendMail({
      from: `"${fromName}" <${consentUser}>`,
      to: testEmail,
      subject: "SMTP Test - Matthews & Associates CRM",
      text: `This is a test email from Matthews & Associates CRM.\n\nSMTP Configuration:\n  Host: ${host}\n  Port: ${port}\n  Secure: ${secure}\n  From: ${consentUser}\n  To: ${testEmail}\n\nIf you received this, your SMTP is working correctly.\n\n- Matthews & Associates CRM`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5e7eb;"><tr><td style="background:#0f172a;padding:18px 28px;"><div style="color:#fff;font-size:17px;font-weight:700;">Matthews & Associates CRM - SMTP Test</div></td></tr><tr><td style="padding:28px;color:#1e293b;font-size:15px;line-height:1.65;"><p>Your SMTP configuration is <strong style="color:#10b981;">working correctly</strong>.</p><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;"><tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Host</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${host}</td></tr><tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Port</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${port}</td></tr><tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">From</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${consentUser}</td></tr><tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">To</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${testEmail}</td></tr></table></td></tr><tr><td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;">Sent from Matthews & Associates CRM</td></tr></table></td></tr></table></body></html>`,
    })

    return NextResponse.json({ message: `Test email sent to ${testEmail}`, messageId: info.messageId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "SMTP test failed" }, { status: 500 })
  }
}
