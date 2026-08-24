import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export async function POST() {
  try {
    const existingAdmin = await db.user.findFirst({ where: { role: "ADMIN" } })
    if (existingAdmin) {
      return NextResponse.json({ message: "Already initialized", user: { id: existingAdmin.id, name: existingAdmin.name, email: existingAdmin.email, role: existingAdmin.role } })
    }

    const hashedPassword = await bcrypt.hash("admin123", 10)
    const admin = await db.user.create({
      data: { name: "Admin", email: "admin@matthewsassoc.com", password: hashedPassword, role: "ADMIN" },
    })

    const agentHashed = await bcrypt.hash("agent123", 10)
    const agent = await db.user.create({
      data: { name: "Agent 1", email: "agent@matthewsassoc.com", password: agentHashed, role: "AGENT", phoneDisplay: "(972) 532-0072" },
    })
    await db.user.update({ where: { id: admin.id }, data: { phoneDisplay: "(972) 532-0072" } })
    const defaultSms = `Hi {{firstName}}, this is {{agentName}}, your case manager from Matthews & Associates. I'm calling with an update on your Depo-Provera case, which was approved by the federal court last week. The final step is the sanctioning of your bill for treatment and compensation related to the meningioma. Please call me back for more information at {{agentPhone}}. I look forward to speaking with you.`
    await db.smsTemplate.create({ data: { userId: agent.id, title: "Depo-Provera Callback", body: defaultSms, isDefault: true } })
    await db.smsTemplate.create({ data: { userId: admin.id, title: "Depo-Provera Callback", body: defaultSms, isDefault: true } })

    await db.script.create({
      data: {
        title: "Main Calling Script",
        content: `# Matthews & Associates - Calling Script

## Opening
"Hello, may I speak with [CLAIMANT NAME]?"

"My name is [YOUR NAME] calling from Matthews & Associates. How are you doing today?"

## Purpose
"The reason for my call is regarding your [CASE TYPE] claim. We have been reviewing your case and wanted to reach out to discuss some important updates and next steps."

## Qualifying Questions
1. "Can you confirm your date of birth?"
2. "What is the best number to reach you?"
3. "Have you spoken with any attorney regarding this matter?"
4. "Can you briefly describe what happened?"

## Value Proposition
"At Matthews & Associates, we specialize in helping claimants like yourself navigate the claims process. Our team works to ensure you receive the compensation you deserve."

## Objection Handling
- **\"I'm not interested\"**: "I completely understand. May I ask why? Sometimes there's information that could change your perspective."
- **\"Call me back later\"**: "Absolutely. What would be the best date and time to reach you?"
- **\"I already have an attorney\"**: "That's great to hear. We can still provide additional support. Would you be open to a brief consultation?"

## Close
"Thank you for your time, [CLAIMANT NAME]. I'll be sending you a follow-up email with the next steps. Is there anything else you'd like to know?"

## Important Notes
- Always be professional and empathetic
- Never make promises about case outcomes
- Document everything in the system
- If claimant is on VM, leave a professional message with callback number`,
      },
    })

    // Seed sample leads
    const sampleLeads = [
      { firstName: "John", lastName: "Smith", phone: "+1-555-0101", email: "john.smith@email.com", city: "New York", state: "NY", caseType: "Personal Injury", claimNumber: "CLM-2024-001", dateOfIncident: "2024-06-15", assignedToId: agent.id, status: "New" },
      { firstName: "Sarah", lastName: "Johnson", phone: "+1-555-0102", email: "sarah.j@email.com", city: "Los Angeles", state: "CA", caseType: "Mass Tort", claimNumber: "CLM-2024-002", dateOfIncident: "2024-07-20", assignedToId: agent.id, status: "Interested" },
      { firstName: "Michael", lastName: "Brown", phone: "+1-555-0103", email: "mbrown@email.com", city: "Chicago", state: "IL", caseType: "Product Liability", claimNumber: "CLM-2024-003", dateOfIncident: "2024-05-10", assignedToId: agent.id, status: "Callback" },
      { firstName: "Emily", lastName: "Davis", phone: "+1-555-0104", email: "emily.d@email.com", city: "Houston", state: "TX", caseType: "Personal Injury", claimNumber: "CLM-2024-004", dateOfIncident: "2024-08-01", assignedToId: admin.id, status: "Signed" },
      { firstName: "Robert", lastName: "Wilson", phone: "+1-555-0105", email: "rwilson@email.com", city: "Phoenix", state: "AZ", caseType: "Mass Tort", claimNumber: "CLM-2024-005", dateOfIncident: "2024-04-22", assignedToId: agent.id, status: "VM" },
    ]

    for (const lead of sampleLeads) {
      await db.lead.create({ data: lead })
    }

    // Add a sample callback for Michael Brown
    const michaelLead = await db.lead.findFirst({ where: { phone: "+1-555-0103" } })
    if (michaelLead) {
      await db.callback.create({
        data: {
          leadId: michaelLead.id,
          userId: agent.id,
          callbackDate: new Date().toISOString().split("T")[0],
          callbackTime: "10:00",
          ampm: "AM",
          timezone: "America/Chicago",
        },
      })
    }

    // Default system settings
    await db.systemSetting.create({ data: { key: "daily_call_target", value: "50" } })

    return NextResponse.json({ message: "Initialized successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
