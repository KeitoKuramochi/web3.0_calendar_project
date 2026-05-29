import { db } from "@/lib/db"
import { consultations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { sendConfirmedNotification, sendReschedulingNotification, sendPostNoteNotification } from "@/lib/email"
import type { ConsultationRecord } from "@/types"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const record = rows[0]?.data as ConsultationRecord
  if (!record) return NextResponse.json(null, { status: 404 })

  if (record.scheduleTokenExpiresAt && new Date(record.scheduleTokenExpiresAt) < new Date()) {
    return NextResponse.json({ error: "link_expired" }, { status: 410 })
  }

  return NextResponse.json({
    title: record.request?.title ?? "ご面談のご依頼",
    senderName: record.senderDisplayName ?? "送信者",
    senderDisplayName: record.senderDisplayName ?? null,
    selectedTimeSlots: record.match?.selectedTimeSlots ?? [],
    selectedTimeSlotsRaw: record.match?.selectedTimeSlotsRaw ?? [],
    availableRanges: record.match?.selectedTimeRanges ?? [],
    duration: record.request?.duration ?? 30,
    format: record.request?.format ?? "hybrid",
    status: record.status,
    confirmedSlot: record.confirmedSlot ?? null,
    recipientNote: record.recipientNote ?? null,
    recipientPostNote: record.recipientPostNote ?? null,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()

  const rows = await db.select().from(consultations).where(eq(consultations.scheduleToken, token))
  const row = rows[0]
  if (!row) return NextResponse.json(null, { status: 404 })

  const record = row.data as ConsultationRecord

  if (record.scheduleTokenExpiresAt && new Date(record.scheduleTokenExpiresAt) < new Date()) {
    return NextResponse.json({ error: "link_expired" }, { status: 410 })
  }

  // 確定後の追加メッセージ
  if (body.action === "post_note") {
    if (record.status !== "confirmed") {
      return NextResponse.json({ error: "not_confirmed" }, { status: 400 })
    }
    const note = typeof body.note === "string" ? body.note.trim() : ""
    if (!note) return NextResponse.json({ error: "note required" }, { status: 400 })
    const updated = { ...record, recipientPostNote: note }
    await db.update(consultations)
      .set({ data: updated, updatedAt: new Date() })
      .where(eq(consultations.scheduleToken, token))
    if (record.senderEmail) {
      sendPostNoteNotification({
        toEmail: record.senderEmail,
        toName: record.senderDisplayName ?? "送信者",
        title: record.request?.title ?? "ご面談",
        note,
      }).catch(console.error)
    }
    return NextResponse.json({ ok: true })
  }

  // 「全部合わない」または「確定後に変更したい」— 再調整済みの場合のみブロック
  if (body.action === "reschedule") {
    if (record.status === "rescheduling") {
      return NextResponse.json({ error: "already_processed" }, { status: 409 })
    }
    const note = typeof body.note === "string" ? body.note.trim() : ""
    if (!note) return NextResponse.json({ error: "note required" }, { status: 400 })
    const updated = { ...record, status: "rescheduling", recipientNote: note }
    await db.update(consultations)
      .set({ data: updated, status: "rescheduling", updatedAt: new Date() })
      .where(eq(consultations.scheduleToken, token))

    if (record.senderEmail) {
      sendReschedulingNotification({
        toEmail: record.senderEmail,
        toName: record.senderDisplayName ?? "送信者",
        title: record.request?.title ?? "ご面談",
        recipientNote: note,
      }).catch(console.error)
    }
    return NextResponse.json({ ok: true })
  }

  // 通常確定 — 既に確定済みなら409
  if (record.status === "confirmed") {
    return NextResponse.json({ error: "already_confirmed" }, { status: 409 })
  }

  const { slot, message } = body
  if (!slot) return NextResponse.json({ error: "slot required" }, { status: 400 })

  const updated: ConsultationRecord = { ...record, status: "confirmed", confirmedSlot: slot }
  if (message && typeof message === "string" && message.trim()) {
    updated.recipientConfirmMessage = message.trim()
  }
  await db.update(consultations)
    .set({ data: updated, status: "confirmed", updatedAt: new Date() })
    .where(eq(consultations.scheduleToken, token))

  if (record.senderEmail) {
    sendConfirmedNotification({
      toEmail: record.senderEmail,
      toName: record.senderDisplayName ?? "送信者",
      title: record.request?.title ?? "ご面談",
      confirmedSlot: slot,
      recipientNote: updated.recipientConfirmMessage,
    }).catch(console.error)
  }
  return NextResponse.json({ ok: true })
}
