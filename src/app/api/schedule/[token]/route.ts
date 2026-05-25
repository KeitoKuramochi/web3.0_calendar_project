import { db } from "@/lib/db"
import { consultations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const record = rows[0]?.data as any
  if (!record) return NextResponse.json(null, { status: 404 })

  // 個人情報を含まない最小限の情報のみ返す
  return NextResponse.json({
    title: record.request?.title ?? "ご面談のご依頼",
    senderName: record.request?.requesterId === "user" ? "送信者" : (record.request?.requesterId ?? "送信者"),
    senderDisplayName: record.senderDisplayName ?? null,
    selectedTimeSlots: record.match?.selectedTimeSlots ?? [],
    duration: record.request?.duration ?? 30,
    format: record.request?.format ?? "hybrid",
    status: record.status,
    confirmedSlot: record.confirmedSlot ?? null,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { slot } = await req.json()
  if (!slot) return NextResponse.json({ error: "slot required" }, { status: 400 })

  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const row = rows[0]
  if (!row) return NextResponse.json(null, { status: 404 })

  const record = row.data as any
  const updated = { ...record, status: "confirmed", confirmedSlot: slot }

  await db.update(consultations)
    .set({ data: updated, status: "confirmed", updatedAt: new Date() })
    .where(eq(consultations.scheduleToken, token))

  return NextResponse.json({ ok: true })
}
