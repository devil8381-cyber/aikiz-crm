import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"])
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

// Claimant views their details (no auth needed)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

    const record = await db.medicalRecord.findUnique({
      where: { token },
      include: { lead: true },
    })
    if (!record) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })

    return NextResponse.json({
      claimant: {
        firstName: record.lead.firstName,
        lastName: record.lead.lastName,
        email: record.lead.email,
        phone: record.lead.phone,
        caseType: record.lead.caseType,
        claimNumber: record.lead.claimNumber,
        dateOfIncident: record.lead.dateOfIncident,
        claimAmount: record.lead.claimAmount,
        city: record.lead.city,
        state: record.lead.state,
      },
      hasUpload: !!record.uploadedAt,
      fileName: record.fileName,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Claimant uploads a medical record file
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

    const record = await db.medicalRecord.findUnique({ where: { token } })
    if (!record) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
    if (record.uploadedAt) return NextResponse.json({ error: "File already uploaded for this request" }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const extension = path.extname(file.name).toLowerCase()
    // Some browsers omit the MIME type for Office documents; accept a known
    // extension in that case, while still rejecting unknown files.
    if (!ALLOWED_EXTENSIONS.has(extension) || (file.type && !ALLOWED_MIME_TYPES.has(file.type))) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX" }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10MB" }, { status: 400 })
    }

    const uploadDir = process.env.UPLOAD_DIR || "/tmp/crm-uploads"
    await mkdir(uploadDir, { recursive: true })
    const safeOriginalName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_") || "medical-record"
    const storedFileName = `medical_${record.id}_${Date.now()}_${safeOriginalName}`
    await writeFile(path.join(uploadDir, storedFileName), Buffer.from(await file.arrayBuffer()))

    await db.medicalRecord.update({
      where: { id: record.id },
      data: {
        fileName: safeOriginalName,
        storedFileName,
        fileMimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        uploadedAt: new Date(),
      },
    })

    await db.activityLog.create({
      data: {
        leadId: record.leadId,
        action: "MEDICAL_RECORD_UPLOADED",
        details: `Medical record uploaded: ${safeOriginalName}`,
      },
    })

    return NextResponse.json({ message: "Medical record uploaded successfully", fileName: safeOriginalName })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
