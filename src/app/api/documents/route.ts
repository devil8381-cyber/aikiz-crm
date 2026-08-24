import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any

    const body = await req.json()
    const { leadId } = body

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const token = uuidv4()
    const docRequest = await db.documentRequest.create({
      data: { leadId, token },
    })

    const baseUrl = process.env.NEXTAUTH_URL || ""
    const link = `${baseUrl}/?token=${token}&mode=docs`

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "GENERATE_DOC_LINK",
        details: `Generated document upload link for ${lead.firstName} ${lead.lastName}`,
        leadId,
      },
    })

    return NextResponse.json({ token, link, message: "Document upload link generated" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  // Called by claimant to upload document
  try {
    const formData = await req.formData()
    const token = formData.get("token") as string
    const file = formData.get("file") as File

    if (!token || !file) {
      return NextResponse.json({ error: "Token and file required" }, { status: 400 })
    }

    const docRequest = await db.documentRequest.findUnique({ where: { token } })
    if (!docRequest) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
    if (docRequest.isUsed) return NextResponse.json({ error: "This link has already been used" }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = process.env.UPLOAD_DIR || "/tmp/crm-uploads"
    await mkdir(uploadDir, { recursive: true })
    const fileName = `${docRequest.id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    await db.documentRequest.update({
      where: { id: docRequest.id },
      data: { isUsed: true, uploadedFileName: fileName },
    })

    return NextResponse.json({ message: "Document uploaded successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
