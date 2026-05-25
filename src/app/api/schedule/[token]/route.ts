import { db } from "@/lib/db"
import { consultations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const record = rows[0]?.data as any
  if (!record) return NextResponse.json(null, { status: 404 })

  return NextResponse.json({
    title: record.request?.title ?? "ご面談のご依頼",
    senderName: record.senderDisplayName ?? "送信者",
    senderDisplayName: record.senderDisplayName ?? null,
    selectedTimeSlots: record.match?.selectedTimeSlots ?? [],
    duration: record.request?.duration ?? 30,
    format: record.request?.format ?? "hybrid",
    status: record.status,
    confirmedSlot: record.confirmedSlot ?? null,
    recipientNote: record.recipientNote ?? null,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()

  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const row = rows[0]
  if (!row) return NextResponse.json(null, { status: 404 })

  const record = row.data as any

  // 二重確定・再調整済みは受け付けない
  if (record.status === "confirmed" || record.status === "rescheduling") {
    return NextResponse.json({ error: "already_processed" }, { status: 409 })
  }

  // 「全部合わない」— 代替候補を保存
  if (body.action === "reschedule") {
    const note = typeof body.note === "string" ? body.note.trim() : ""
    if (!note) return NextResponse.json({ error: "note required" }, { status: 400 })
    const updated = { ...record, status: "rescheduling", recipientNote: note }
    await db.update(consultations)
      .set({ data: updated, status: "rescheduling", updatedAt: new Date() })
      .where(eq(consultations.scheduleToken, token))
    return NextResponse.json({ ok: true })
  }

  // 通常確定
  const { slot } = body
  if (!slot) return NextResponse.json({ error: "slot required" }, { status: 400 })

  const updated = { ...record, status: "confirmed", confirmedSlot: slot }
  await db.update(consultations)
    .set({ data: updated, status: "confirmed", updatedAt: new Date() })
    .where(eq(consultations.scheduleToken, token))

  return NextResponse.json({ ok: true })
}
