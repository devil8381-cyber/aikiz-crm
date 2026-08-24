import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const updateData: any = {}

    if (body.name) updateData.name = body.name
    if (body.email) updateData.email = body.email
    if (body.role) updateData.role = body.role
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.phoneDisplay !== undefined) updateData.phoneDisplay = body.phoneDisplay
    if (body.password) updateData.password = await bcrypt.hash(body.password, 10)

    const updated = await db.user.update({ where: { id }, data: updateData })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_USER",
        details: `Updated user: ${updated.name} (${updated.email})`,
      },
    })

    return NextResponse.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as any
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const { id } = await params
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    await db.user.delete({ where: { id } })

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "DELETE_USER",
        details: `Deleted user: ${target.name} (${target.email})`,
      },
    })

    return NextResponse.json({ message: "User deleted" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}