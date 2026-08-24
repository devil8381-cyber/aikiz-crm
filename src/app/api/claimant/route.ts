import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")
    const mode = searchParams.get("mode")

    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

    if (mode === "tcpa") {
      const tcpaForm = await db.tcpaForm.findUnique({ 
        where: { token },
        include: { lead: true },
      })
      if (!tcpaForm) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
      return NextResponse.json({ 
        formType: tcpaForm.formType,
        isCompleted: tcpaForm.isCompleted,
        claimant: {
          firstName: tcpaForm.lead.firstName,
          lastName: tcpaForm.lead.lastName,
          email: tcpaForm.lead.email,
          phone: tcpaForm.lead.phone,
          caseType: tcpaForm.lead.caseType,
          claimNumber: tcpaForm.lead.claimNumber,
          dateOfIncident: tcpaForm.lead.dateOfIncident,
        },
      })
    }

    if (mode === "docs") {
      const docRequest = await db.documentRequest.findUnique({
        where: { token },
        include: { lead: true },
      })
      if (!docRequest) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
      if (docRequest.isUsed) return NextResponse.json({ error: "Link already used" }, { status: 400 })
      if (!docRequest.openedAt) {
        await db.documentRequest.update({ where: { id: docRequest.id }, data: { openedAt: new Date() } })
      }
      return NextResponse.json({
        claimant: {
          firstName: docRequest.lead.firstName,
          lastName: docRequest.lead.lastName,
          email: docRequest.lead.email,
          phone: docRequest.lead.phone,
          caseType: docRequest.lead.caseType,
          claimNumber: docRequest.lead.claimNumber,
          dateOfIncident: docRequest.lead.dateOfIncident,
          claimAmount: docRequest.lead.claimAmount,
          address: docRequest.lead.address,
          city: docRequest.lead.city,
          state: docRequest.lead.state,
        },
      })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, mode, formData } = body

    if (mode === "tcpa") {
      const tcpaForm = await db.tcpaForm.findUnique({ where: { token } })
      if (!tcpaForm) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
      
      await db.tcpaForm.update({
        where: { id: tcpaForm.id },
        data: { isCompleted: true },
      })
      
      return NextResponse.json({ message: `TCPA ${tcpaForm.formType} form submitted successfully` })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}