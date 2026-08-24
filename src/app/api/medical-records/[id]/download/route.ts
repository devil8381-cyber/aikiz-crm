import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as { id: string; role: string }
    const { id } = await params
    const record = await db.medicalRecord.findUnique({
      where: { id },
      include: { lead: { select: { assignedToId: true } } },
    })
    if (!record?.uploadedAt || !record.storedFileName) {
      return NextResponse.json({ error: "Uploaded file not found" }, { status: 404 })
    }
    if (user.role !== "ADMIN" && record.lead.assignedToId !== user.id) {
      return NextResponse.json({ error: "Not authorized to access this file" }, { status: 403 })
    }

    const uploadDir = process.env.UPLOAD_DIR || "/tmp/crm-uploads"
    const buffer = await readFile(path.join(uploadDir, path.basename(record.storedFileName)))
    const safeDownloadName = record.fileName.replace(/[\r\n\"]/g, "_") || "medical-record"
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": record.fileMimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${safeDownloadName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error: any) {
    if (error?.code === "ENOENT") return NextResponse.json({ error: "Uploaded file is no longer available" }, { status: 404 })
    return NextResponse.json({ error: "Unable to download medical record" }, { status: 500 })
  }
}
