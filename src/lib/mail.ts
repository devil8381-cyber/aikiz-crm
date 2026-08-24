import nodemailer from "nodemailer"
import type { EmailType } from "./email-defaults"
import { EMAIL_TYPE_META } from "./email-defaults"
import { db } from "./db"

export type MailAccount = "consent" | "claims" | "info"

let _settingsCache: Record<string, string> | null = null
let _settingsCacheTime = 0

async function getSmtpSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (_settingsCache && now - _settingsCacheTime < 30000) return _settingsCache
  try {
    const settings = await db.systemSetting.findMany({ where: { key: { startsWith: "smtp_" } } })
    const map: Record<string, string> = {}
    settings.forEach((s: any) => { map[s.key] = s.value })
    _settingsCache = map
    _settingsCacheTime = now
    return map
  } catch {
    return {}
  }
}

function clearSettingsCache() { _settingsCache = null; _settingsCacheTime = 0 }

async function accountCreds(account: MailAccount) {
  const s = await getSmtpSettings()
  if (account === "consent") {
    return {
      user: s.smtp_consent_user || process.env.SMTP_CONSENT_USER || process.env.SMTP_USER || "consent@matthewsassociate.com",
      pass: s.smtp_consent_pass || process.env.SMTP_CONSENT_PASS || process.env.SMTP_PASS || "",
    }
  }
  if (account === "claims") {
    return {
      user: s.smtp_claims_user || process.env.SMTP_CLAIMS_USER || process.env.SMTP_USER || "claims@matthewsassociate.com",
      pass: s.smtp_claims_pass || process.env.SMTP_CLAIMS_PASS || process.env.SMTP_PASS || "",
    }
  }
  return {
    user: process.env.SMTP_INFO_USER || process.env.SMTP_USER || "info@matthewsassociate.com",
    pass: process.env.SMTP_INFO_PASS || process.env.SMTP_PASS || "",
  }
}

export async function fromAddressForType(emailType: EmailType): Promise<{ account: MailAccount; email: string }> {
  const meta = EMAIL_TYPE_META[emailType]
  const account = meta.fromAccount
  const { user } = await accountCreds(account)
  return { account, email: user }
}

export async function sendFirmMail(opts: {
  account: MailAccount
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}) {
  const s = await getSmtpSettings()
  const host = s.smtp_host || process.env.SMTP_HOST || "smtp.hostinger.com"
  const port = Number(s.smtp_port || process.env.SMTP_PORT || "465")
  const secure = (s.smtp_secure ?? "true") !== "false" && port === 465
  const { user, pass } = await accountCreds(opts.account)

  if (!pass) {
    throw new Error("SMTP password not configured. Set it in Admin Settings > SMTP Configuration, or set SMTP_CONSENT_PASS / SMTP_CLAIMS_PASS in environment variables.")
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  const fromName = s.smtp_from_name || process.env.SMTP_FROM_NAME || "Matthews & Associates"

  const info = await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo: opts.replyTo || user,
  })

  return { messageId: info.messageId, from: user }
}

export { clearSettingsCache }
