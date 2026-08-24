import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { wsBroadcast } from "@/lib/ws-broadcast"

// Target lead fields that CSV columns can be mapped to
const TARGET_FIELDS = [
  "firstName", "lastName", "phone", "email", "address", "city", "state",
  "zipCode", "ssnLast4", "dateOfBirth", "caseType", "claimNumber",
  "dateOfIncident", "claimAmount", "attorneyName", "insuranceCarrier",
  "policyNumber", "incidentDescription", "notes",
] as const

// Fallback auto-detect aliases (used when no explicit mapping is sent)
const AUTO_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "first_name", "first"],
  lastName: ["lastname", "last_name", "last"],
  phone: ["phone", "phonenumber", "phone_number"],
  email: ["email"],
  address: ["address"],
  city: ["city"],
  state: ["state"],
  zipCode: ["zipcode", "zip", "zip_code"],
  ssnLast4: ["ssnlast4", "ssn_last4", "ssn"],
  dateOfBirth: ["dateofbirth", "dob", "date_of_birth"],
  caseType: ["casetype", "case_type"],
  claimNumber: ["claimnumber", "claim_number"],
  dateOfIncident: ["dateofincident", "date_of_incident"],
  claimAmount: ["claimamount", "claim_amount"],
  attorneyName: ["attorneyname", "attorney_name"],
  insuranceCarrier: ["insurancecarrier", "insurance_carrier"],
  policyNumber: ["policynumber", "policy_number"],
  incidentDescription: ["incidentdescription", "incident_description"],
  notes: ["notes"],
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

    // Optional: which user to assign every imported lead to
    const assignedToId = (formData.get("assignedToId") as string) || ""
    let assignedUser: { id: string; name: string } | null = null
    if (assignedToId) {
      assignedUser = await db.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true } })
      if (!assignedUser) return NextResponse.json({ error: "Selected user was not found" }, { status: 400 })
    }

    // Optional: explicit column -> field mapping chosen by the admin in the UI.
    // Shape: { firstName: "First Name", phone: "Mobile #", ... }
    const mappingRaw = (formData.get("mapping") as string) || ""
    let mapping: Record<string, string> | null = null
    if (mappingRaw) {
      try { mapping = JSON.parse(mappingRaw) } catch { mapping = null }
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 })

    const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim())
    const headers = rawHeaders.map(h => h.toLowerCase())

    // Build a lookup: target field -> column index in the CSV
    const fieldIndex: Record<string, number> = {}
    if (mapping) {
      for (const field of TARGET_FIELDS) {
        const chosenHeader = mapping[field]
        if (!chosenHeader) continue
        const idx = rawHeaders.findIndex(h => h === chosenHeader)
        if (idx !== -1) fieldIndex[field] = idx
      }
    } else {
      for (const field of TARGET_FIELDS) {
        const aliases = AUTO_ALIASES[field] || [field.toLowerCase()]
        const idx = headers.findIndex(h => aliases.includes(h))
        if (idx !== -1) fieldIndex[field] = idx
      }
    }

    let created = 0
    let errors = 0

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        for (const field of TARGET_FIELDS) {
          const idx = fieldIndex[field]
          row[field] = idx !== undefined ? (values[idx] || "").trim() : ""
        }

        if (!row.firstName && !row.lastName && !row.phone) { errors++; continue }

        await db.lead.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            email: row.email,
            address: row.address,
            city: row.city,
            state: row.state,
            zipCode: row.zipCode,
            ssnLast4: row.ssnLast4,
            dateOfBirth: row.dateOfBirth,
            caseType: row.caseType,
            claimNumber: row.claimNumber,
            dateOfIncident: row.dateOfIncident,
            claimAmount: row.claimAmount,
            attorneyName: row.attorneyName,
            insuranceCarrier: row.insuranceCarrier,
            policyNumber: row.policyNumber,
            incidentDescription: row.incidentDescription,
            notes: row.notes,
            status: "New",
            assignedToId: assignedUser ? assignedUser.id : null,
          },
        })
        created++
      } catch {
        errors++
      }
    }

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "BULK_UPLOAD",
        details: `Uploaded CSV: ${created} leads created, ${errors} errors${assignedUser ? `, assigned to ${assignedUser.name}` : ""}`,
      },
    })

    if (created > 0) {
      wsBroadcast({
        type: "LEAD_CREATED",
        from: user.id,
        payload: { leadName: `${created} leads imported`, actorName: user.name },
      })
    }

    return NextResponse.json({ created, errors, total: lines.length - 1, assignedTo: assignedUser?.name || null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { result.push(current); current = "" }
      else { current += ch }
    }
  }
  result.push(current)
  return result
}
