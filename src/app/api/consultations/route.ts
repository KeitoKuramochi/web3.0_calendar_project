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

  // 送信者のGoogle認証メールをデータに埋め込む（通知送信用）
  const enriched = {
    ...record,
    senderEmail: record.senderEmail ?? session.user.email ?? null,
    senderDisplayName: record.senderDisplayName ?? session.user.name ?? null,
  }

  await db.insert(consultations)
    .values({
      id: enriched.id,
      userId: session.user.id,
      data: enriched,
      status: record.status,
      scheduleToken: record.scheduleToken ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: consultations.id,
      set: {
        data: enriched,
        status: enriched.status,
        scheduleToken: enriched.scheduleToken ?? null,
        updatedAt: now,
      },
    })

  return NextResponse.json({ ok: true })
}
