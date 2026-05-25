import { auth } from "@/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const rows = await db.select().from(profiles).where(eq(profiles.userId, session.user.id))
  return NextResponse.json(rows[0]?.data ?? null)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const data = await req.json()
  await db.insert(profiles)
    .values({ userId: session.user.id, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: profiles.userId, set: { data, updatedAt: new Date() } })

  return NextResponse.json({ ok: true })
}
