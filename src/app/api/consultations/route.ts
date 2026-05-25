import { auth } from "@/auth"
import { db } from "@/lib/db"
import { consultations } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const rows = await db.select().from(consultations)
    .where(eq(consultations.userId, session.user.id))
    .orderBy(desc(consultations.updatedAt))

  return NextResponse.json(rows.map((r) => r.data))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const record = await req.json()
  const now = new Date()

  await db.insert(consultations)
    .values({
      id: record.id,
      userId: session.user.id,
      data: record,
      status: record.status,
      scheduleToken: record.scheduleToken ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: consultations.id,
      set: {
        data: record,
        status: record.status,
        scheduleToken: record.scheduleToken ?? null,
        updatedAt: now,
      },
    })

  return NextResponse.json({ ok: true })
}
