import { auth } from "@/auth"
import { db } from "@/lib/db"
import { consultations } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  const rows = await db.select().from(consultations).where(
    and(eq(consultations.id, id), eq(consultations.userId, session.user.id))
  )
  return NextResponse.json(rows[0]?.data ?? null)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  await db.delete(consultations).where(
    and(eq(consultations.id, id), eq(consultations.userId, session.user.id))
  )
  return NextResponse.json({ ok: true })
}
