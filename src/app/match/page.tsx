"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ShieldCheck, Mail, AlertCircle, Search, Plus, X } from "lucide-react"
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
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null)
  const [scoredSlots, setScoredSlots] = useState<TimeSlotScore[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [inferredUserId, setInferredUserId] = useState<string>("")
  const [recipientNote, setRecipientNote] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(true)
  const [editableSlots, setEditableSlots] = useState<string[]>([])
  const [addDate, setAddDate] = useState("")
  const [addTime, setAddTime] = useState("10:00")

  const applyAnalysis = (scores: TimeSlotScore[], profile: { preferredTimeHints: string[]; avoidedTimeHints: string[]; requiredInfos: string[]; reasoningFactors: string[]; workPattern: string; aiComment: string }) => {
    setAnalyzedProfile(profile)
    setScoredSlots(scores)
  }

  const saveAnalysisCache = async (active: Awaited<ReturnType<typeof getActiveConsultation>>, slots: string[], scores: TimeSlotScore[], profile: { preferredTimeHints: string[]; avoidedTimeHints: string[]; requiredInfos: string[]; reasoningFactors: string[]; workPattern: string; aiComment: string }) => {
    if (!active) return
    const cache: CachedAnalysis = { forSlots: [...slots].sort(), scoredSlots: scores, ...profile }
    await upsertConsultation({ ...active, cachedAnalysis: cache })
  }

  useEffect(() => {
    getActiveConsultation().then(async (active) => {
      if (!active?.request) { router.replace("/request"); return }
      const req = active.request
      setRequest(req)
      if (active.recipientNote) setRecipientNote(active.recipientNote)

      const r = req.recipient ?? {}
      const slots = req.myAvailableTimes
      setEditableSlots(slots)

      // キャッシュチェック: 同じスロット一覧でAI分析済みなら復元してスキップ
      const cache = active.cachedAnalysis
      const sortedSlots = [...slots].sort().join(",")
      const cacheHit = cache && [...(cache.forSlots ?? [])].sort().join(",") === sortedSlots
      if (cacheHit && cache) {
        setInferredUserId("")
        applyAnalysis(cache.scoredSlots, {
          preferredTimeHints: cache.preferredTimeHints,
          avoidedTimeHints: cache.avoidedTimeHints,
          requiredInfos: cache.requiredInfos,
          reasoningFactors: cache.reasoningFactors,
          workPattern: cache.workPattern,
          aiComment: cache.aiComment,
        })
        setAnalyzing(false)
        return
      }

      setAnalyzing(true)
      try {
        const { profile, scores, reasoningFactors, workPattern, aiComment } = await analyzeRecipient(
          r.name ?? "",
          r.role ?? "",
          r.department ?? "",
          r.notes ?? "",
          slots,
          req.duration ?? 30
        )
        setInferredUserId(profile.id)
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
        applyAnalysis(scores, profileData)
        saveAnalysisCache(active, slots, scores, profileData)
      } catch {
        const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "")
        setInferredUserId(inferred.id)
      } finally {
        setAnalyzing(false)
      }
    })
  }, [])

  // 15分単位の時刻オプション
  const TIME_OPTIONS = React.useMemo(() => {
    const opts: string[] = []
    for (let h = 8; h <= 21; h++) {
      for (const m of [0, 15, 30, 45]) {
        if (h === 21 && m > 0) break
        opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
      }
    }
    return opts
  }, [])

  const addSlotAndRescore = async () => {
    if (!addDate || !addTime || !request) return
    const newSlot = `${addDate}T${addTime}`
    if (editableSlots.includes(newSlot)) return
    const next = [...editableSlots, newSlot].sort()
    setEditableSlots(next)
    setAddDate("")
    setAddTime("10:00")
    const r = request.recipient ?? {}
    setAnalyzing(true)
    try {
      const { profile, scores, reasoningFactors, workPattern, aiComment } = await analyzeRecipient(
        r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "",
        next, request.duration ?? 30
      )
      setInferredUserId(profile.id)
      setAnalyzedProfile({
        preferredTimeHints: profile.availableTimesFreeText?.split("。").filter(Boolean) ?? [],
        avoidedTimeHints: profile.avoidTimesFreeText?.split("。").filter(Boolean) ?? [],
        requiredInfos: profile.mailRequiredInfo,
        reasoningFactors: reasoningFactors ?? [],
        workPattern: workPattern ?? "",
        aiComment: aiComment ?? "",
      })
      setScoredSlots(scores)
    } finally {
      setAnalyzing(false)
    }
  }

  const removeSlotAndRescore = async (slot: string) => {
    const next = editableSlots.filter((s) => s !== slot)
    setEditableSlots(next)
    setSelectedSlots((prev) => prev.filter((s) => s !== slot))
    if (!request || next.length === 0) { setScoredSlots([]); return }
    const r = request.recipient ?? {}
    setAnalyzing(true)
    try {
      const { profile, scores, reasoningFactors, workPattern, aiComment } = await analyzeRecipient(
        r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "",
        next, request.duration ?? 30
      )
      setInferredUserId(profile.id)
      setAnalyzedProfile({
        preferredTimeHints: profile.availableTimesFreeText?.split("。").filter(Boolean) ?? [],
        avoidedTimeHints: profile.avoidTimesFreeText?.split("。").filter(Boolean) ?? [],
        requiredInfos: profile.mailRequiredInfo,
        reasoningFactors: reasoningFactors ?? [],
        workPattern: workPattern ?? "",
        aiComment: aiComment ?? "",
      })
      setScoredSlots(scores)
    } finally {
      setAnalyzing(false)
    }
  }

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
    // analyzeRecipient で取得した profile を再利用（フォールバックとして inferProfileFromRole も保持）
    const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", r.notes ?? "")
    // 選択スロットに対応する元の範囲を算出（スケジュールページ用）
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
      request: { ...active.request!, myAvailableTimes: editableSlots },
    })
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

      {/* 分岐選択 */}
      <div className={styles.branchRow}>
        <div className={`${styles.branchCard} ${styles.branchCardDisabled}`}>
          <div className={styles.branchCardIcon}><Search size={18} /></div>
          <div className={styles.branchCardContent}>
            <div className={styles.branchCardTitle}>相談先を探す</div>
            <span className={styles.branchBadge}>準備中</span>
          </div>
        </div>
        <div className={`${styles.branchCard} ${styles.branchCardActive}`}>
          <div className={styles.branchCardIcon}><CalendarDays size={18} /></div>
          <div className={styles.branchCardContent}>
            <div className={styles.branchCardTitle}>日程候補から選ぶ</div>
            <div className={styles.branchActiveHint}>← 今はこちら</div>
          </div>
        </div>
      </div>

      {/* AI 分析中のローディング */}
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
          AIが相手の予定傾向を分析中...
        </div>
      )}

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
              {/* 推論根拠チップ */}
              {analyzedProfile.reasoningFactors?.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>推測の根拠:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {analyzedProfile.reasoningFactors.map((f: string) => (
                      <span key={f} style={{
                        padding: "3px 10px",
                        background: "var(--bg-primary)",
                        border: "1.5px solid var(--border-color)",
                        borderRadius: 20,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}>📌 {f}</span>
                    ))}
                  </div>
                  <div style={{ height: 1, background: "var(--border-color)", margin: "10px 0 6px" }} />
                </div>
              )}
              {/* 勤務パターン */}
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
              {/* AIコメント（不確かな場合） */}
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
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
            日時を複数選択すると、相手に複数の候補を提示するメッセージを作成します。×のスロットも選択できますが、相手にとって都合が悪い可能性があります。
          </p>

          {/* スロット追加フォーム */}
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              style={{
                flex: 1, minWidth: 130, padding: "8px 12px",
                background: "var(--bg-primary)", border: "1.5px solid var(--border-color)",
                borderRadius: 12, fontSize: "0.85rem", color: "var(--text-primary)",
                fontFamily: "inherit", outline: "none",
              }}
            />
            <select
              value={addTime}
              onChange={(e) => setAddTime(e.target.value)}
              style={{
                width: 100, padding: "8px 12px",
                background: "var(--bg-primary)", border: "1.5px solid var(--border-color)",
                borderRadius: 12, fontSize: "0.85rem", color: "var(--text-primary)",
                fontFamily: "inherit", outline: "none",
              }}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={addSlotAndRescore}
              disabled={!addDate || analyzing}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px",
                background: addDate ? "var(--color-primary-bg)" : "var(--bg-primary)",
                border: "1.5px solid var(--border-color)", borderRadius: 12,
                fontSize: "0.82rem", fontWeight: 700, color: "var(--color-primary)",
                cursor: addDate ? "pointer" : "not-allowed", fontFamily: "inherit",
                opacity: addDate ? 1 : 0.5,
              }}
            >
              <Plus size={14} />
              追加してスコア再計算
            </button>
          </div>

          <div className={styles.slotList}>
            {scoredSlots.map((slot) => {
              const isPoor = slot.score === "poor"
              const isChecked = selectedSlots.includes(slot.timeSlot)
              return (
                <div
                  key={slot.timeSlot}
                  className={`${styles.slotItem} ${isChecked ? styles.slotItemActive : ""}`}
                  style={{ cursor: "pointer", opacity: isPoor && !isChecked ? 0.65 : 1 }}
                  onClick={() => toggleSlot(slot.timeSlot)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSlotAndRescore(slot.timeSlot) }}
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
