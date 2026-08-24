/** Official default email templates — Matthews & Associates */

export const FIRM_NAME = "Matthews & Associates"
export const FIRM_ADDRESS = "2905 Sackett St, Houston, TX 77098"
export const DEPARTMENT = "Case Management Department"
export const DEFAULT_CONSENT_LINK = "https://legalexpertservices.com/new-depo-provera/"

export type EmailType =
  | "TCPA_C1"
  | "TCPA_C2"
  | "TCPA_C3"
  | "MEDICAL_RECORDS"
  | "MISSED_CALL"
  | "FOLLOWUP_VM"
  | "REQUEST_DOCS"

export const EMAIL_TYPE_META: Record<
  EmailType,
  { label: string; fromAccount: "consent" | "claims"; defaultLink: string }
> = {
  TCPA_C1: { label: "TCPA C-1 Consent", fromAccount: "consent", defaultLink: DEFAULT_CONSENT_LINK },
  TCPA_C2: { label: "TCPA C-2 Consent", fromAccount: "consent", defaultLink: DEFAULT_CONSENT_LINK },
  TCPA_C3: { label: "TCPA C-3 Consent", fromAccount: "consent", defaultLink: DEFAULT_CONSENT_LINK },
  MEDICAL_RECORDS: { label: "Secure Records Request", fromAccount: "consent", defaultLink: "" },
  MISSED_CALL: { label: "Missed Call Follow-up", fromAccount: "claims", defaultLink: "" },
  FOLLOWUP_VM: { label: "Case Status Follow-up", fromAccount: "claims", defaultLink: "" },
  REQUEST_DOCS: { label: "Request Documents", fromAccount: "claims", defaultLink: "" },
}

export const DEFAULT_TEMPLATES: Record<EmailType, { subject: string; body: string }> = {
  TCPA_C1: {
    subject: "{{firstName}}, please open this while we're on the phone",
    body: `Hi {{firstName}},

This is {{agentName}}, your case manager working with Matthews & Associates on your Depo-Provera claim.

While we're on the phone, please open this secure link so I can walk you through your consent form together:

{{consentLink}}

This consent allows our team to reach you by call or text about your case and any settlement updates — including if your number is normally filtered by a Do Not Call list or spam blocker, so you don't miss anything important.

Open the link now and let me know when you're ready — I'll stay on the line and walk through it with you.

Talk soon,

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
  TCPA_C2: {
    subject: "{{firstName}}, quick follow-up on your consent form",
    body: `Hi {{firstName}},

This is {{agentName}} again, your case manager working with Matthews & Associates.

We weren't able to finish your consent form during our last call. It only takes a minute, and it's the one thing standing between us and being able to keep you updated on your Depo-Provera case:

{{consentLink}}

Once it's signed, I'll be able to call or text you directly with updates — even if your carrier normally flags unfamiliar numbers as spam.

If now's a good time, open the link and give me a call back at {{agentPhone}} so I can confirm everything went through.

Best,

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
  TCPA_C3: {
    subject: "Last step, {{firstName}} — your consent form is still open",
    body: `Hi {{firstName}},

I don't want your case to stall over paperwork. This is {{agentName}} from Matthews & Associates' case management team — we've tried reaching you a couple of times now to finish your consent form.

Here's the link again, ready whenever you are:

{{consentLink}}

It takes about a minute. Once it's done, I can get back to actually working your case instead of chasing signatures.

Call me at {{agentPhone}} after you submit it, or if you have any questions before you do — I'm happy to walk through it with you.

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
  MEDICAL_RECORDS: {
    subject: "{{firstName}}, secure records request from Matthews & Associates",
    body: `Hello {{firstName}},

My name is {{agentName}}, and I am with the Records Retrieval & Billing Team at Matthews & Associates.

To help our team review your matter, please use the secure portal below to submit the medical records or billing documents requested by your case manager:

{{consentLink}}

This private upload portal is operated by Matthews & Associates and hosted on Netlify's platform. For your privacy, please do not reply to this email with medical-record attachments.

Documents may include treatment records, provider notes, itemized bills, hospital or clinic paperwork, imaging reports, and any other documents specifically requested by your case manager. Please upload only the documents requested for your matter.

If you have questions about which documents are needed, reply to this email or contact me at {{agentPhone}}.

This email is not monitored for medical emergencies. If you need emergency assistance, call 911 or seek immediate medical care.

Thank you,

{{agentName}}
Records Retrieval & Billing Team
Matthews & Associates
{{agentPhone}}`,
  },
  MISSED_CALL: {
    subject: "{{firstName}}, we tried reaching you about your case",
    body: `Hi {{firstName}},

This is {{agentName}}, your case manager working with Matthews & Associates. I just tried calling regarding your Depo-Provera case and wasn't able to reach you.

Nothing to worry about, but I do have a few time-sensitive items to go over with you, and I'd rather explain them directly than leave them in an email.

Please call me back at your earliest convenience:

{{agentPhone}}

I'm available now and will keep trying to reach you — but if you can call first, that saves us both time.

Talk soon,

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
  FOLLOWUP_VM: {
    subject: "{{firstName}} — an update on your case",
    body: `Hi {{firstName}},

This is {{agentName}}, your case manager working with Matthews & Associates on your Depo-Provera claim.

Your case is moving forward, and there are a couple of items on our end that need your input to keep things on track. I'd rather walk you through them by phone than leave the details in writing.

Please call me back when you get a chance:

{{agentPhone}}

I'm available now and happy to answer any questions about where things stand.

Thank you,

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
  REQUEST_DOCS: {
    subject: "{{firstName}} — documents needed to keep your case moving",
    body: `Hi {{firstName}},

This is {{agentName}}, your case manager working with Matthews & Associates.

To keep your Depo-Provera case moving on schedule, we're missing a few documents from you. The sooner we have these, the sooner we can move to the next step.

Please reply to this email with the items below, or call me if you have questions about what's needed or how to send it:

{{agentPhone}}

Thanks for getting this back to us quickly — it makes a real difference in how fast your case can move.

{{agentName}}
{{department}}
{{agentPhone}}

Matthews & Associates
2905 Sackett St, Houston, TX 77098`,
  },
}

export function fillEmailTemplate(
  text: string,
  vars: {
    firstName?: string
    lastName?: string
    agentName?: string
    agentPhone?: string
    consentLink?: string
    department?: string
  }
): string {
  const map: Record<string, string> = {
    firstName: vars.firstName || "there",
    lastName: vars.lastName || "",
    agentName: vars.agentName || "Case Manager",
    agentPhone: vars.agentPhone || "",
    consentLink: vars.consentLink || DEFAULT_CONSENT_LINK,
    department: vars.department || DEPARTMENT,
    fullName: [vars.firstName, vars.lastName].filter(Boolean).join(" ") || "there",
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => map[k] ?? "")
}

/** Polished branded HTML email shell */
export function toProfessionalHtml(plainBody: string, consentLink?: string): string {
  const escaped = plainBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  let htmlBody = escaped.replace(/\n/g, "<br>\n")
  if (consentLink) {
    const safe = consentLink.replace(/&/g, "&amp;")
    htmlBody = htmlBody.split(safe).join(
      `<a href="${safe}" style="color:#0f4c81;font-weight:600;">${safe}</a>`
    )
  }
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#0f172a;padding:18px 28px;">
            <div style="color:#ffffff;font-size:17px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Matthews &amp; Associates</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">2905 Sackett St, Houston, TX 77098</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#1e293b;font-size:15px;line-height:1.65;">
            ${htmlBody}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
            This message is intended for the named recipient regarding a legal matter. If you received it in error, please delete it and notify the sender.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
