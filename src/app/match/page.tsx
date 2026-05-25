"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ShieldCheck, Mail, AlertCircle } from "lucide-react"
import styles from "./match.module.css"
import { analyzeProfile, scoreTimeSlots, inferProfileFromRole } from "@/lib/ai"
import { ConsultRequest, TimeSlotScore } from "@/types"
import { formatJaWithEnd } from "@/lib/formatDate"
import StepIndicator from "@/components/StepIndicator/StepIndicator"
import { getActiveConsultation, upsertConsultation } from "@/lib/storage"

export default function MatchPage() {
  const router = useRouter()

  const [request, setRequest] = useState<ConsultRequest | null>(null)
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null)
  const [scoredSlots, setScoredSlots] = useState<TimeSlotScore[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [inferredUserId, setInferredUserId] = useState<string>("")

  useEffect(() => {
    getActiveConsultation().then((active) => {
      if (!active?.request) { router.replace("/request"); return }
      const req = active.request
      setRequest(req)

      const r = req.recipient ?? {}
      const inferred = inferProfileFromRole(
        r.name ?? "",
        r.role ?? "",
        r.department ?? "",
        r.notes ?? ""
      )
      setInferredUserId(inferred.id)
      setAnalyzedProfile(analyzeProfile(inferred))
      setScoredSlots(scoreTimeSlots(req.myAvailableTimes, inferred))
    })
  }, [])

  const toggleSlot = (timeSlot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(timeSlot)
        ? prev.filter((s) => s !== timeSlot)
        : [...prev, timeSlot]
    )
  }

  const getScoreEmoji = (s: string) =>
    s === "excellent" ? "◎" : s === "good" ? "○" : s === "fair" ? "△" : "×"

  const getScoreClass = (s: string) => {
    const base = styles.scoreBadge
    if (s === "excellent") return `${base} ${styles.scoreExcellent}`
    if (s === "good") return `${base} ${styles.scoreGood}`
    if (s === "fair") return `${base} ${styles.scoreFair}`
    return `${base} ${styles.scorePoor}`
  }

  const handleNext = async () => {
    if (selectedSlots.length === 0) return
    const active = await getActiveConsultation()
    if (!active) return
    const duration = request?.duration ?? 30
    const r = request?.recipient ?? {}
    const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "")
    const matchData = {
      targetUserId: inferred.id,
      selectedTimeSlots: selectedSlots.map((s) => formatJaWithEnd(s, duration)),
      selectedTimeSlotsRaw: selectedSlots,
      selectedTimeSlot: formatJaWithEnd(selectedSlots[0], duration),
      inferredProfile: inferred,
    }
    await upsertConsultation({ ...active, status: "matched", match: matchData })
    router.push("/mail")
  }

  const recipient = request?.recipient
  const recipientLabel = [recipient?.name, recipient?.role, recipient?.department]
    .filter(Boolean).join("・") || "（相手の情報が未入力です）"

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
            ← リクエストをやり直す
          </button>
        </div>
        <h1>日程スコアリング</h1>
        <p>入力された相手の役職・情報から、各候補日時の調整しやすさを推測しました。複数選択できます。</p>
      </div>

      {/* 相手情報と推論の説明 */}
      <div className="glass-card fade-in" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertCircle size={15} style={{ color: "var(--color-fair)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {recipientLabel} への推測スコア
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              ※ 役職・所属から一般的な傾向を推測しています。実際の都合とは異なる場合があります。
              相手がリンクから日時を選んだ際に修正できます。
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 推論された時間帯の傾向 */}
        {analyzedProfile && (
          <div className="glass-card fade-in" style={{ padding: "18px" }}>
            <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
              <ShieldCheck size={16} style={{ color: "var(--color-secondary)" }} />
              <span>推測された予定傾向</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>対応しやすい時間帯（推測）:</div>
                <div className={styles.timeTagGroup}>
                  {analyzedProfile.preferredTimeHints.length === 0
                    ? <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>特定なし</span>
                    : analyzedProfile.preferredTimeHints.map((h: string) => (
                      <span key={h} className={styles.timeTagPrefer}>{h}</span>
                    ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>避けた方が良い時間帯（推測）:</div>
                <div className={styles.timeTagGroup}>
                  {analyzedProfile.avoidedTimeHints.length === 0
                    ? <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>特定なし</span>
                    : analyzedProfile.avoidedTimeHints.map((h: string) => (
                      <span key={h} className={styles.timeTagAvoid}>{h}</span>
                    ))}
                </div>
              </div>
              {analyzedProfile.requiredInfos.length > 0 && (
                <div style={{ fontSize: "0.78rem", background: "var(--bg-primary)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                  <span style={{ fontWeight: 600 }}>メールに含める情報（推測）: </span>
                  {analyzedProfile.requiredInfos.join("、")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 日程スコアリング */}
        <div className="glass-card fade-in" style={{ padding: "18px" }}>
          <div className={styles.sectionTitle} style={{ marginBottom: "6px" }}>
            <CalendarDays size={16} />
            <span>調整可能性スコア（複数選択可）</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
            ◎・○の日時を複数選択すると、相手に複数の候補を提示するメッセージを作成します。
          </p>

          <div className={styles.slotList}>
            {scoredSlots.map((slot) => {
              const isPoor = slot.score === "poor"
              const isChecked = selectedSlots.includes(slot.timeSlot)
              return (
                <div
                  key={slot.timeSlot}
                  className={`${styles.slotItem} ${isChecked ? styles.slotItemActive : ""}`}
                  style={{ cursor: isPoor ? "not-allowed" : "pointer", opacity: isPoor ? 0.5 : 1 }}
                  onClick={() => { if (!isPoor) toggleSlot(slot.timeSlot) }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    disabled={isPoor}
                    className={styles.slotCheckbox}
                    style={{ pointerEvents: "none" }}
                  />
                  <div className={getScoreClass(slot.score)}>
                    {getScoreEmoji(slot.score)}
                  </div>
                  <div className={styles.slotInfo}>
                    <div className={styles.slotTime}>{formatJaWithEnd(slot.timeSlot, request?.duration ?? 30)}</div>
                    <div className={styles.slotReason}>{slot.privacyReason}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedSlots.length > 0 && (
            <div className={styles.selectedSummary}>
              <span className={styles.selectedCount}>{selectedSlots.length}件選択中</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>→ 選択した日時がメッセージの候補として使用されます</span>
            </div>
          )}

          <div className={styles.footer}>
            <button
              onClick={handleNext}
              className={styles.btnNext}
              disabled={selectedSlots.length === 0}
            >
              選択した日時でメッセージ作成へ
              <Mail size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
