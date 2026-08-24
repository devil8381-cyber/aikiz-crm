import { db } from "./db"
import { fromAddressForType, sendFirmMail } from "./mail"
import {
  DEFAULT_TEMPLATES,
  EMAIL_TYPE_META,
  fillEmailTemplate,
  toProfessionalHtml,
  DEPARTMENT,
  DEFAULT_CONSENT_LINK,
  type EmailType,
} from "./email-defaults"
import { withTracking } from "./email-tracking"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

type EmailStep = { type: "EMAIL"; emailType: EmailType; delay: number }
type SmsStep = { type: "SMS"; title: string; body: string; delay: number }
export type DripStep = EmailStep | SmsStep

/**
 * Missed Call -> SMS same day -> follow-up email next day -> second SMS day 3.
 * `delay` is measured from the PREVIOUS step's completion, in ms.
 * Step 0 is implicit — enrollment happens right after the MISSED_CALL email is sent,
 * so this array starts at "what happens next."
 */
export const SEQUENCES: Record<string, DripStep[]> = {
  MISSED_CONTACT: [
    {
      type: "SMS",
      title: "Drip: Missed Call Follow-up",
      body: `Hi {{firstName}}, this is {{agentName}} with Matthews & Associates. I emailed you earlier after trying to reach you about your case. Please call me back at {{agentPhone}} when you get a chance.`,
      delay: 3 * HOUR,
    },
    { type: "EMAIL", emailType: "FOLLOWUP_VM", delay: 1 * DAY },
    {
      type: "SMS",
      title: "Drip: Second Attempt",
      body: `Hi {{firstName}}, following up again — this is {{agentName}} with Matthews & Associates. I don't want your case to stall. Please call {{agentPhone}} when you can, even for two minutes.`,
      delay: 2 * DAY,
    },
  ],
  DOC_REMINDER: [
    {
      type: "SMS",
      title: "Drip: Document Reminder",
      body: `Hi {{firstName}}, this is {{agentName}} with Matthews & Associates. We're still waiting on a couple of documents to keep your case moving — could you upload them today? Call {{agentPhone}} if you have questions.`,
      delay: 2 * DAY,
    },
    {
      type: "SMS",
      title: "Drip: Document Reminder — Second Attempt",
      body: `Hi {{firstName}}, just a reminder — your case is on hold until we receive those documents. Please upload them or call {{agentPhone}} so we can keep things moving.`,
      delay: 3 * DAY,
    },
  ],
}

export async function enrollInDrip(leadId: string, sequenceType: keyof typeof SEQUENCES) {
  const existing = await db.dripEnrollment.findFirst({
    where: { leadId, sequenceType, status: "active" },
  })
  if (existing) return existing // already enrolled, don't double-stack

  const steps = SEQUENCES[sequenceType]
  const firstStep = steps[0]
  return db.dripEnrollment.create({
    data: {
      leadId,
      sequenceType,
      currentStep: 0,
      status: "active",
      nextActionAt: new Date(Date.now() + firstStep.delay),
    },
  })
}

async function fillVars(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId } })
  if (!lead) return null
  const agent = lead.assignedToId
    ? await db.user.findUnique({ where: { id: lead.assignedToId }, select: { name: true, phoneDisplay: true } })
    : null
  return {
    lead,
    vars: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      agentName: agent?.name || "Case Manager",
      agentPhone: agent?.phoneDisplay || "",
      consentLink: DEFAULT_CONSENT_LINK,
      department: DEPARTMENT,
    },
  }
}

function fillSms(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
}

/**
 * Advances one due drip step. For EMAIL steps this actually sends the email.
 * For SMS steps this just marks the enrollment as "awaiting agent" — an agent
 * has to actually tap send (no server-side SMS gateway is wired in yet).
 * Returns what happened, for logging/testing.
 */
export async function processDripStep(enrollmentId: string) {
  const enrollment = await db.dripEnrollment.findUnique({ where: { id: enrollmentId } })
  if (!enrollment || enrollment.status !== "active") return null
  if (enrollment.awaitingAgent) return null // already surfaced to an agent, don't re-fire

  const steps = SEQUENCES[enrollment.sequenceType]
  const step = steps[enrollment.currentStep]
  if (!step) {
    await db.dripEnrollment.update({ where: { id: enrollment.id }, data: { status: "completed" } })
    return null
  }

  const ctx = await fillVars(enrollment.leadId)
  if (!ctx) {
    await db.dripEnrollment.update({ where: { id: enrollment.id }, data: { status: "cancelled" } })
    return null
  }

  if (step.type === "EMAIL") {
    if (!ctx.lead.email?.trim()) {
      // no email on file — skip straight to next step instead of stalling forever
      return advanceStep(enrollment.id, enrollment.currentStep, steps)
    }
    const tpl = DEFAULT_TEMPLATES[step.emailType]
    const subject = fillEmailTemplate(tpl.subject, ctx.vars)
    const text = fillEmailTemplate(tpl.body, ctx.vars)
    const { email: fromEmail, account } = await fromAddressForType(step.emailType)

    const emailLog = await db.emailLog.create({
      data: {
        leadId: enrollment.leadId,
        emailType: step.emailType,
        to: ctx.lead.email,
        subject,
        status: "SENT",
      },
    })
    const baseUrl = process.env.NEXTAUTH_URL || ""
    const html = withTracking(toProfessionalHtml(text, ctx.vars.consentLink), emailLog.trackToken || "", baseUrl)

    await sendFirmMail({ account, to: ctx.lead.email, subject, text, html, replyTo: fromEmail })
    await db.lead.update({ where: { id: enrollment.leadId }, data: { lastContactedAt: new Date() } })
    await db.activityLog.create({
      data: {
        leadId: enrollment.leadId,
        action: "DRIP_EMAIL_SENT",
        details: `Auto-sent ${step.emailType} (${EMAIL_TYPE_META[step.emailType].label}) as part of the ${enrollment.sequenceType} drip`,
      },
    })
    return advanceStep(enrollment.id, enrollment.currentStep, steps)
  }

  // SMS step: queue it for the assigned agent, don't send it ourselves
  const body = fillSms(step.body, ctx.vars)
  await db.activityLog.create({
    data: {
      userId: ctx.lead.assignedToId || null,
      leadId: enrollment.leadId,
      action: "DRIP_SMS_DUE",
      details: `${step.title}: ${body}`,
    },
  })
  await db.dripEnrollment.update({ where: { id: enrollment.id }, data: { awaitingAgent: true } })
  return { queued: true, title: step.title, body }
}

async function advanceStep(enrollmentId: string, currentStep: number, steps: DripStep[]) {
  const nextIndex = currentStep + 1
  const nextStep = steps[nextIndex]
  if (!nextStep) {
    await db.dripEnrollment.update({ where: { id: enrollmentId }, data: { status: "completed" } })
    return { completed: true }
  }
  await db.dripEnrollment.update({
    where: { id: enrollmentId },
    data: { currentStep: nextIndex, nextActionAt: new Date(Date.now() + nextStep.delay), awaitingAgent: false },
  })
  return { advancedTo: nextIndex }
}

/** Returns the filled SMS title/body for an enrollment currently awaiting an agent send. */
export async function getPendingSms(enrollmentId: string) {
  const enrollment = await db.dripEnrollment.findUnique({ where: { id: enrollmentId } })
  if (!enrollment || !enrollment.awaitingAgent) return null
  const steps = SEQUENCES[enrollment.sequenceType]
  const step = steps[enrollment.currentStep]
  if (!step || step.type !== "SMS") return null
  const ctx = await fillVars(enrollment.leadId)
  if (!ctx) return null
  return { title: step.title, body: fillSms(step.body, ctx.vars) }
}

/** Call this once the agent has actually sent the queued SMS for a lead's active drip. */
export async function completeSmsStep(leadId: string, sequenceType: keyof typeof SEQUENCES) {
  const enrollment = await db.dripEnrollment.findFirst({
    where: { leadId, sequenceType, status: "active", awaitingAgent: true },
  })
  if (!enrollment) return null
  const steps = SEQUENCES[sequenceType]
  return advanceStep(enrollment.id, enrollment.currentStep, steps)
}

/** Processes every due, active enrollment. Meant to be called by a scheduled cron hit. */
export async function runDripCron() {
  const due = await db.dripEnrollment.findMany({
    where: { status: "active", awaitingAgent: false, nextActionAt: { lte: new Date() } },
  })
  const results = []
  for (const e of due) {
    results.push(await processDripStep(e.id))
  }
  return { processed: due.length, results }
}
