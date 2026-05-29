"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Mail } from "lucide-react"
import styles from "./match.module.css"
import { inferProfileFromRole } from "@/lib/ai"
import { ConsultRequest, TimeSlotScore, CachedAnalysis } from "@/types"
import { formatJaWithEnd } from "@/lib/formatDate"
import StepIndicator from "@/components/StepIndicator/StepIndicator"
import { getActiveConsultation, upsertConsultation } from "@/lib/storage"
import { analyzeRecipient } from "@/app/actions/ai"

export default function MatchPage() {
  const router = useRouter()

  const [request, setRequest] = useState<ConsultRequest | null>(null)
  const [scoredSlots, setScoredSlots] = useState<TimeSlotScore[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [analyzedProfile, setAnalyzedProfile] = useState<{
    preferredTimeHints: string[]
    avoidedTimeHints: string[]
    requiredInfos: string[]
    reasoningFactors: string[]
    workPattern: string
    aiComment: string
  } | null>(null)
  const [inferredUserId, setInferredUserId] = useState<string>("")
  const [recipientNote, setRecipientNote] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(true)
  const [aiStatus, setAiStatus] = useState<"ai" | "mock" | null>(null)

  useEffect(() => {
    getActiveConsultation().then(async (active) => {
      if (!active?.request) { router.replace("/request"); return }
      const req = active.request
      setRequest(req)
      if (active.recipientNote) setRecipientNote(active.recipientNote)

      const r = req.recipient ?? {}
      // scheduleNotes を notes に付加してAIに渡す
      const combinedNotes = [r.notes, req.recipientScheduleNotes].filter(Boolean).join("\n")
      const slots = req.myAvailableTimes

      // キャッシュチェック
      const cache = active.cachedAnalysis
      const sortedSlots = [...slots].sort().join(",")
      const cacheHit = cache && [...(cache.forSlots ?? [])].sort().join(",") === sortedSlots
      if (cacheHit && cache) {
        setAiStatus("ai")
        setAnalyzedProfile({
          preferredTimeHints: cache.preferredTimeHints,
          avoidedTimeHints: cache.avoidedTimeHints,
          requiredInfos: cache.requiredInfos,
          reasoningFactors: cache.reasoningFactors,
          workPattern: cache.workPattern,
          aiComment: cache.aiComment,
        })
        setScoredSlots(cache.scoredSlots)
        // デフォルト選択: poor 以外を全選択
        setSelectedSlots(cache.scoredSlots.filter(s => s.score !== "poor").map(s => s.timeSlot))
        setAnalyzing(false)
        return
      }

      setAnalyzing(true)
      try {
        const { profile, scores, reasoningFactors, workPattern, aiComment, usedMock } = await analyzeRecipient(
          r.name ?? "",
          r.role ?? "",
          r.department ?? "",
          combinedNotes,
          slots,
          req.duration ?? 30
        )
        setInferredUserId(profile.id)
        setAiStatus(usedMock ? "mock" : "ai")
        const profileData = {
          preferredTimeHints: profile.availableTimesFreeText
            ? profile.availableTimesFreeText.split("。").filter(Boolean)
            : [],
          avoidedTimeHints: profile.avoidTimesFreeText
            ? profile.avoidTimesFreeText.split("。").filter(Boolean)
            : [],
          requiredInfos: profile.mailRequiredInfo,
          reasoningFactors: reasoningFactors ?? [],
          workPattern: workPattern ?? "",
          aiComment: aiComment ?? "",
        }
        setAnalyzedProfile(profileData)
        setScoredSlots(scores)
        // デフォルト選択: poor 以外を全選択
        setSelectedSlots(scores.filter(s => s.score !== "poor").map(s => s.timeSlot))

        const cacheData: CachedAnalysis = { forSlots: [...slots].sort(), scoredSlots: scores, ...profileData }
        await upsertConsultation({ ...active, cachedAnalysis: cacheData })
      } catch (err) {
        console.error("[MatchPage] analyzeRecipient failed:", err)
        const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", combinedNotes)
        setInferredUserId(inferred.id)
        setAiStatus("mock")
        setScoredSlots(slots.map(s => ({ timeSlot: s, score: "fair" as const, privacyReason: "情報不足のため判定できません" })))
        setSelectedSlots(slots)
      } finally {
        setAnalyzing(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSlot = (timeSlot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(timeSlot) ? prev.filter((s) => s !== timeSlot) : [...prev, timeSlot]
    )
  }

  const getScoreEmoji = (s: string) =>
    s === "excellent" ? "◎" : s === "good" ? "○" : s === "fair" ? "△" : "×"

  const getScoreLabel = (s: string) =>
    s === "excellent" ? "問題なし" : s === "good" ? "ほぼOK" : s === "fair" ? "要注意" : "NG"

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
    const combinedNotes = [r.notes, request?.recipientScheduleNotes].filter(Boolean).join("\n")
    const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", combinedNotes)
    const ranges = request?.myAvailableRanges
    const selectedTimeRanges = ranges?.filter((r) => {
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
      return selectedSlots.some((s) => {
        if (!s.startsWith(r.date + "T")) return false
        const slotMin = toMin(s.split("T")[1].slice(0, 5))
        return slotMin >= toMin(r.start) && slotMin + duration <= toMin(r.end)
      })
    })
    const matchData = {
      targetUserId: inferredUserId || inferred.id,
      selectedTimeSlots: selectedSlots.map((s) => formatJaWithEnd(s, duration)),
      selectedTimeSlotsRaw: selectedSlots,
      selectedTimeSlot: formatJaWithEnd(selectedSlots[0], duration),
      selectedTimeRanges: selectedTimeRanges && selectedTimeRanges.length > 0 ? selectedTimeRanges : undefined,
      inferredProfile: {
        ...inferred,
        id: inferredUserId || inferred.id,
        availableTimesFreeText: analyzedProfile?.preferredTimeHints.join("。") ?? inferred.availableTimesFreeText,
        avoidTimesFreeText: analyzedProfile?.avoidedTimeHints.join("。") ?? inferred.avoidTimesFreeText,
        mailRequiredInfo: analyzedProfile?.requiredInfos ?? inferred.mailRequiredInfo,
      },
    }
    await upsertConsultation({
      ...active,
      status: "matched",
      match: matchData,
      request: { ...active.request!, myAvailableTimes: selectedSlots },
    })
    router.push("/mail")
  }

  const recipient = request?.recipient
  const recipientLabel = [recipient?.name, recipient?.role, recipient?.department]
    .filter(Boolean).join("・") || "（相手の情報が未入力です）"

  const poorSlots = scoredSlots.filter(s => s.score === "poor")
  const fairSlots = scoredSlots.filter(s => s.score === "fair")

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
        <h1>AI日程チェック</h1>
        <p>入力した空き時間を相手の役職・スケジュール情報と照らし合わせて問題がないか確認します。</p>
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
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            この内容を踏まえて新しい候補日時を選んでください。
          </div>
        </div>
      )}

      {/* 分析中ローディング */}
      {analyzing && (
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
          AIが各日程を相手の役職・情報と照らし合わせて確認中...
        </div>
      )}

      {/* AI/モックステータス */}
      {!analyzing && aiStatus && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          background: aiStatus === "ai" ? "rgba(78,191,173,0.08)" : "rgba(232,146,78,0.08)",
          border: `1.5px solid ${aiStatus === "ai" ? "rgba(78,191,173,0.3)" : "rgba(232,146,78,0.35)"}`,
          borderRadius: 10, fontSize: "0.78rem", fontWeight: 700,
          color: aiStatus === "ai" ? "var(--color-excellent)" : "var(--color-fair)",
        }}>
          {aiStatus === "ai" ? "✓ Cloudflare AI で確認済み" : "⚠ モックデータを使用中（AI応答なし）"}
          {aiStatus === "mock" && (
            <a href="/api/debug/ai" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", textDecoration: "underline" }}>
              診断を確認 →
            </a>
          )}
        </div>
      )}

      {/* NGスロット警告サマリー */}
      {!analyzing && (poorSlots.length > 0 || fairSlots.length > 0) && (
        <div style={{
          padding: "12px 16px",
          background: poorSlots.length > 0 ? "rgba(220,50,50,0.06)" : "rgba(232,146,78,0.07)",
          border: `1.5px solid ${poorSlots.length > 0 ? "rgba(220,50,50,0.25)" : "rgba(232,146,78,0.3)"}`,
          borderRadius: 14,
          fontSize: "0.84rem",
        }}>
          {poorSlots.length > 0 && (
            <div style={{ fontWeight: 700, color: "var(--color-danger)", marginBottom: fairSlots.length > 0 ? 4 : 0 }}>
              ✗ NG {poorSlots.length}件: 相手にとって都合が悪い可能性が高い日程があります
            </div>
          )}
          {fairSlots.length > 0 && (
            <div style={{ fontWeight: 600, color: "var(--color-fair)" }}>
              △ 要注意 {fairSlots.length}件: 確認が必要な日程があります
            </div>
          )}
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
            下のリストで各日程の理由を確認し、送る候補を選んでください
          </div>
        </div>
      )}

      {/* 全クリアメッセージ */}
      {!analyzing && scoredSlots.length > 0 && poorSlots.length === 0 && fairSlots.length === 0 && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(78,191,173,0.08)",
          border: "1.5px solid rgba(78,191,173,0.3)",
          borderRadius: 14,
          fontSize: "0.84rem", fontWeight: 700, color: "var(--color-excellent)",
        }}>
          ✓ 全ての候補日程に問題は見つかりませんでした
        </div>
      )}

      {/* 相手の傾向カード */}
      {!analyzing && analyzedProfile && (
        <div className="glass-card fade-in" style={{ padding: "16px 18px" }}>
          <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
            <CalendarDays size={16} />
            <span>「{recipientLabel}」の推測されるスケジュール傾向</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* 推論根拠 */}
            {analyzedProfile.reasoningFactors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                {analyzedProfile.reasoningFactors.map((f) => (
                  <span key={f} style={{
                    padding: "3px 10px",
                    background: "var(--bg-primary)",
                    border: "1.5px solid var(--border-color)",
                    borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)",
                  }}>📌 {f}</span>
                ))}
              </div>
            )}
            {analyzedProfile.workPattern && (
              <div style={{
                fontSize: "0.8rem", padding: "7px 12px",
                background: "var(--color-excellent-bg)",
                border: "1px solid rgba(78,191,173,0.3)",
                borderRadius: 10, color: "var(--text-primary)",
              }}>
                <span style={{ fontWeight: 700, color: "var(--color-excellent)", marginRight: 6 }}>🗓 勤務パターン:</span>
                {analyzedProfile.workPattern}
              </div>
            )}
            {analyzedProfile.aiComment && (
              <div style={{
                fontSize: "0.78rem", padding: "6px 12px",
                background: "rgba(232,146,78,0.06)",
                border: "1px solid rgba(232,146,78,0.25)",
                borderRadius: 10, color: "var(--color-fair)",
              }}>
                💬 {analyzedProfile.aiComment}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {analyzedProfile.preferredTimeHints.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>都合が良さそうな時間帯:</div>
                  <div className={styles.timeTagGroup}>
                    {analyzedProfile.preferredTimeHints.map((h) => (
                      <span key={h} className={styles.timeTagPrefer}>{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {analyzedProfile.avoidedTimeHints.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>避けた方が良い時間帯:</div>
                  <div className={styles.timeTagGroup}>
                    {analyzedProfile.avoidedTimeHints.map((h) => (
                      <span key={h} className={styles.timeTagAvoid}>{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 日程チェック結果リスト */}
      {!analyzing && scoredSlots.length > 0 && (
        <div className="glass-card fade-in" style={{ padding: "18px" }}>
          <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
            <CalendarDays size={16} />
            <span>チェック結果（送る候補を選択）</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
            チェックを外すと、その日程はメッセージに含まれません。NGや要注意の理由を確認して調整してください。
          </p>

          <div className={styles.slotList}>
            {scoredSlots.map((slot) => {
              const isChecked = selectedSlots.includes(slot.timeSlot)
              return (
                <div
                  key={slot.timeSlot}
                  className={`${styles.slotItem} ${isChecked ? styles.slotItemActive : ""}`}
                  style={{
                    cursor: "pointer",
                    opacity: slot.score === "poor" && !isChecked ? 0.6 : 1,
                  }}
                  onClick={() => toggleSlot(slot.timeSlot)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className={styles.slotCheckbox}
                    style={{ pointerEvents: "none" }}
                  />
                  <div className={getScoreClass(slot.score)} title={getScoreLabel(slot.score)}>
                    {getScoreEmoji(slot.score)}
                  </div>
                  <div className={styles.slotInfo}>
                    <div className={styles.slotTime}>{formatJaWithEnd(slot.timeSlot, request?.duration ?? 30)}</div>
                    <div className={styles.slotReason}>
                      <span style={{
                        fontWeight: 700,
                        color: slot.score === "poor" ? "var(--color-danger)"
                          : slot.score === "fair" ? "var(--color-fair)"
                          : "var(--color-excellent)",
                        marginRight: 4,
                      }}>
                        {getScoreLabel(slot.score)}
                      </span>
                      {slot.privacyReason}
                    </div>
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
      )}
    </div>
  )
}
