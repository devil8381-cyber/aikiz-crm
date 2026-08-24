/** SMS template merge helpers */

export type LeadMerge = {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  claimNumber?: string
  caseType?: string
}

export const DEFAULT_SMS_BODY = `Hi {{firstName}}, this is {{agentName}} with Matthews & Associates, your case manager on the Depo-Provera claim. I tried reaching you and have a time-sensitive update on your case. Please call me back at {{agentPhone}} when you have a moment. Thank you!`

/** Ready-to-use SMS presets agents/admins can load in via Admin > SMS Templates */
export const SMS_TEMPLATE_PRESETS: { title: string; body: string }[] = [
  {
    title: "Missed Call Follow-up",
    body: `Hi {{firstName}}, this is {{agentName}} with Matthews & Associates. I just tried calling about your Depo-Provera case and couldn't reach you. Please call me back at {{agentPhone}} when you get a chance — thank you!`,
  },
  {
    title: "Voicemail Left",
    body: `Hi {{firstName}}, {{agentName}} here from Matthews & Associates. I left you a voicemail about your case — please give me a call back at {{agentPhone}} at your earliest convenience.`,
  },
  {
    title: "Case Status Update",
    body: `Hi {{firstName}}, this is {{agentName}}, your case manager from Matthews & Associates. Your case is moving forward and I need a few minutes of your time to keep things on track. Call me at {{agentPhone}} when you're free.`,
  },
  {
    title: "Consent Reminder",
    body: `Hi {{firstName}}, this is {{agentName}} from Matthews & Associates. We still need your consent form completed to keep contacting you about your case. Check your email for the secure link, or call me at {{agentPhone}} and I'll walk you through it.`,
  },
  {
    title: "Document Request",
    body: `Hi {{firstName}}, {{agentName}} here from Matthews & Associates. Your case needs a couple of documents from you to move to the next step. Call me at {{agentPhone}} or reply here and I'll tell you exactly what's needed.`,
  },
  {
    title: "Second Attempt",
    body: `Hi {{firstName}}, following up again — this is {{agentName}} with Matthews & Associates. I don't want your case to stall. Please call {{agentPhone}} when you can, even for two minutes.`,
  },
]

export function fillTemplate(
  template: string,
  lead: LeadMerge,
  agentName = "our team",
  agentPhone = ""
): string {
  const map: Record<string, string> = {
    firstName: lead.firstName || "there",
    lastName: lead.lastName || "",
    fullName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there",
    phone: lead.phone || "",
    email: lead.email || "",
    claimNumber: lead.claimNumber || "",
    caseType: lead.caseType || "Depo-Provera",
    agentName: agentName || "our team",
    agentPhone: agentPhone || "",
    "Leads Name": lead.firstName || "there",
    "Agents Name": agentName || "our team",
  }
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim()
    return map[k] ?? ""
  })
}
