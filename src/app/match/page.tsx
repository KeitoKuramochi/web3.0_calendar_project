"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Mail, X, RotateCcw } from "lucide-react"
import styles from "./match.module.css"
import { inferProfileFromRole } from "@/lib/ai"
import { UserProfile } from "@/types"
import { formatJaWithEnd } from "@/lib/formatDate"
import StepIndicator from "@/components/StepIndicator/StepIndicator"
import { getActiveConsultation, upsertConsultation } from "@/lib/storage"
import { proposeTimeSlots } from "@/app/actions/ai"

type ProposedSlot = { datetime: string; reason: string }

export default function MatchPage() {
  const router = useRouter()

  const [proposing, setProposing] = useState(true)
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[]>([])
  const [removedSlots, setRemovedSlots] = useState<Set<string>>(new Set())
  const [reasoning, setReasoning] = useState("")
  const [inferredProfile, setInferredProfile] = useState<UserProfile | null>(null)
  const [usedMock, setUsedMock] = useState(false)
  const [recipientNote, setRecipientNote] = useState<string | null>(null)
  const [duration, setDuration] = useState(30)
  const [recipientLabel, setRecipientLabel] = useState("")

  const runProposal = async (active: NonNullable<Awaited<ReturnType<typeof getActiveConsultation>>>, force = false) => {
    const req = active.request!
    const r = req.recipient ?? {}

    // キャッシュ: myAvailableTimes が入っていて inferredProfile もあれば再提案しない
    if (!force && req.myAvailableTimes?.length > 0 && active.match?.inferredProfile) {
      setProposedSlots(req.myAvailableTimes.map((dt) => ({ datetime: dt, reason: "" })))
      setReasoning("")
      setInferredProfile(active.match.inferredProfile)
      setUsedMock(false)
      setProposing(false)
      return
    }

    setProposing(true)
    const today = new Date().toISOString().split("T")[0]
    try {
      const result = await proposeTimeSlots(
        r.name ?? "",
        r.role ?? "",
        r.department ?? "",
        r.notes ?? "",
        req.recipientScheduleNotes ?? "",
        req.duration ?? 30,
        today
      )
      setProposedSlots(result.slots)
      setReasoning(result.reasoning)
      setInferredProfile(result.inferredProfile)
      setUsedMock(result.usedMock)
    } catch (err) {
      console.error("[MatchPage] proposeTimeSlots failed:", err)
      const fallback = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "")
      setInferredProfile(fallback)
      setReasoning("役職・情報から一般的な傾向を参考に提案しました。")
      setUsedMock(true)
    } finally {
      setProposing(false)
    }
  }

  useEffect(() => {
    getActiveConsultation().then(async (active) => {
      if (!active?.request) { router.replace("/request"); return }
      const req = active.request
      if (active.recipientNote) setRecipientNote(active.recipientNote)
      setDuration(req.duration ?? 30)
      const r = req.recipient ?? {}
      setRecipientLabel([r.name, r.role, r.department].filter(Boolean).join("・") || "（相手の情報なし）")
      await runProposal(active)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemove = (datetime: string) => {
    setRemovedSlots((prev) => new Set([...prev, datetime]))
  }

  const handleRestore = (datetime: string) => {
    setRemovedSlots((prev) => {
      const next = new Set(prev)
      next.delete(datetime)
      return next
    })
  }

  const handleRepropose = async () => {
    const active = await getActiveConsultation()
    if (!active) return
    setRemovedSlots(new Set())
    await runProposal(active, true)
  }

  const selectedSlots = proposedSlots.filter((s) => !removedSlots.has(s.datetime))

  const handleNext = async () => {
    if (selectedSlots.length === 0) return
    const active = await getActiveConsultation()
    if (!active) return
    const dur = duration
    const profile = inferredProfile ?? inferProfileFromRole(
      active.request?.recipient?.name ?? "",
      active.request?.recipient?.role ?? "",
      active.request?.recipient?.department ?? "",
      active.request?.recipient?.notes ?? ""
    )
    await upsertConsultation({
      ...active,
      status: "matched",
      match: {
        targetUserId: active.request?.recipient?.email ?? "",
        selectedTimeSlots: selectedSlots.map((s) => formatJaWithEnd(s.datetime, dur)),
        selectedTimeSlotsRaw: selectedSlots.map((s) => s.datetime),
        selectedTimeSlot: formatJaWithEnd(selectedSlots[0].datetime, dur),
        inferredProfile: profile,
      },
      request: { ...active.request!, myAvailableTimes: selectedSlots.map((s) => s.datetime) },
    })
    router.push("/mail")
  }

  return (
    <div className={styles.container}>
      <StepIndicator current={2} />
      <div className={styles.header}>
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => router.push("/request")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "none", border: "none", padding: 0,
              fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ← リクエストに戻る
          </button>
        </div>
        <h1>AIが日程を提案</h1>
        <p>相手の役職・スケジュール情報をもとに、AIが面談候補日時を提案しました。不要な候補は削除して次へ進めてください。</p>
      </div>

      {/* 再調整バナー */}
      {recipientNote && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(232, 146, 78, 0.08)",
          border: "2px solid rgba(232, 146, 78, 0.35)",
          borderRadius: 14,
          fontSize: "0.85rem",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontWeight: 700, color: "var(--color-fair)" }}>🔄 再調整モード</div>
          <div style={{ color: "var(--text-secondary)" }}>
            相手からの返信: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>「{recipientNote}」</span>
          </div>
        </div>
      )}

      {/* ローディング */}
      {proposing && (
        <div style={{
          padding: "14px 18px",
          background: "var(--color-excellent-bg)",
          border: "1.5px solid rgba(78, 191, 173, 0.3)",
          borderRadius: 14,
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--color-excellent)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          AIが日程を提案中...
        </div>
      )}

      {/* AI/モックステータス */}
      {!proposing && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          background: usedMock ? "rgba(232,146,78,0.08)" : "rgba(78,191,173,0.08)",
          border: `1.5px solid ${usedMock ? "rgba(232,146,78,0.35)" : "rgba(78,191,173,0.3)"}`,
          borderRadius: 10, fontSize: "0.78rem", fontWeight: 700,
          color: usedMock ? "var(--color-fair)" : "var(--color-excellent)",
        }}>
          {usedMock ? "⚠ モックデータを使用中（AI応答なし）" : "✓ Cloudflare AI で提案済み"}
          {usedMock && (
            <a href="/api/debug/ai" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", textDecoration: "underline" }}>
              診断を確認 →
            </a>
          )}
        </div>
      )}

      {/* 相手情報と提案の説明 */}
      {!proposing && (
        <div className="glass-card fade-in" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CalendarDays size={15} style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {recipientLabel} への日程提案
              </div>
              {reasoning && (
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {reasoning}
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                ※ 役職・情報から推測した候補です。実際の都合と異なる場合は相手がリンクから別の日時を提案できます。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提案スロット一覧 */}
      {!proposing && proposedSlots.length > 0 && (
        <div className="glass-card fade-in" style={{ padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              <CalendarDays size={16} />
              <span>提案された候補日程</span>
            </div>
            <button
              type="button"
              onClick={handleRepropose}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)",
                background: "none", border: "1.5px solid var(--border-color)",
                borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <RotateCcw size={13} />
              再提案
            </button>
          </div>

          <div className={styles.slotList}>
            {proposedSlots.map((slot) => {
              const isRemoved = removedSlots.has(slot.datetime)
              return (
                <div
                  key={slot.datetime}
                  className={`${styles.slotItem} ${isRemoved ? styles.slotItemRemoved : styles.slotItemActive}`}
                  style={{ cursor: "default" }}
                >
                  <div className={styles.slotInfo}>
                    <div className={styles.slotTime}>{formatJaWithEnd(slot.datetime, duration)}</div>
                    {slot.reason && <div className={styles.slotReason}>{slot.reason}</div>}
                  </div>
                  {isRemoved ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(slot.datetime)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "none", border: "1.5px solid var(--border-color)",
                        borderRadius: 20, padding: "4px 10px",
                        fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <X size={12} style={{ transform: "rotate(45deg)" }} />
                      元に戻す
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemove(slot.datetime)}
                      style={{
                        background: "none", border: "none", padding: "4px 6px",
                        cursor: "pointer", color: "var(--text-muted)",
                        borderRadius: 8, display: "flex", alignItems: "center",
                        flexShrink: 0,
                      }}
                      title="この候補を削除"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {selectedSlots.length === 0 && (
            <div style={{
              padding: "10px 14px", marginTop: 10,
              background: "rgba(220,50,50,0.07)",
              border: "1.5px solid rgba(220,50,50,0.25)",
              borderRadius: 10, fontSize: "0.82rem", fontWeight: 600,
              color: "var(--color-danger)",
            }}>
              候補が0件です。削除した候補を「元に戻す」か、「再提案」してください。
            </div>
          )}

          {selectedSlots.length > 0 && (
            <div className={styles.selectedSummary}>
              <span className={styles.selectedCount}>{selectedSlots.length}件選択中</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>→ この候補をメッセージに使用します</span>
            </div>
          )}

          <div className={styles.footer}>
            <button
              onClick={handleNext}
              className={styles.btnNext}
              disabled={selectedSlots.length === 0}
            >
              {selectedSlots.length}件の候補でメッセージを作成
              <Mail size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
