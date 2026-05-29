"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Mail, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import styles from "./match.module.css"
import { inferProfileFromRole } from "@/lib/ai"
import { ConsultRequest, TimeSlotScore, CachedAnalysis, TimeRange } from "@/types"
import { formatJaWithEnd, mergeConsecutiveSlots } from "@/lib/formatDate"
import StepIndicator from "@/components/StepIndicator/StepIndicator"
import { getActiveConsultation, upsertConsultation } from "@/lib/storage"
import { analyzeRecipient } from "@/app/actions/ai"

function genTimeOptions() {
  const opts: string[] = []
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return opts
}
const TIME_OPTIONS = genTimeOptions()

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

function formatRangeJa(range: TimeRange) {
  const d = new Date(range.date)
  const days = ["日", "月", "火", "水", "木", "金", "土"]
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${range.start}〜${range.end}`
}

function rangeKey(r: TimeRange) { return `${r.date}-${r.start}-${r.end}` }

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

  const [localSlots, setLocalSlots] = useState<string[]>([])
  const [localRanges, setLocalRanges] = useState<TimeRange[]>([])
  const [slotsChanged, setSlotsChanged] = useState(false)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [expandedRanges, setExpandedRanges] = useState<Set<string>>(new Set())
  const [tempDate, setTempDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tempStart, setTempStart] = useState("10:00")
  const [tempEnd, setTempEnd] = useState("12:00")
  const [addMsg, setAddMsg] = useState<string | null>(null)

  useEffect(() => {
    getActiveConsultation().then(async (active) => {
      if (!active?.request) { router.replace("/request"); return }
      const req = active.request
      setRequest(req)
      setLocalSlots(req.myAvailableTimes ?? [])
      setLocalRanges(req.myAvailableRanges ?? [])
      if (active.recipientNote) setRecipientNote(active.recipientNote)

      const r = req.recipient ?? {}
      const combinedNotes = [r.notes, req.recipientScheduleNotes].filter(Boolean).join("\n")
      const slots = req.myAvailableTimes

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
        setSelectedSlots(cache.scoredSlots.filter(s => s.score !== "poor").map(s => s.timeSlot))
        setAnalyzing(false)
        return
      }

      await runAnalysis(req, slots)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAnalysis = async (req: ConsultRequest, slots: string[]) => {
    const r = req.recipient ?? {}
    const combinedNotes = [r.notes, req.recipientScheduleNotes].filter(Boolean).join("\n")
    setAnalyzing(true)
    try {
      const { profile, scores, reasoningFactors, workPattern, aiComment, usedMock } = await analyzeRecipient(
        r.name ?? "", r.role ?? "", r.department ?? "", combinedNotes, slots, req.duration ?? 30
      )
      setInferredUserId(profile.id)
      setAiStatus(usedMock ? "mock" : "ai")
      const profileData = {
        preferredTimeHints: profile.availableTimesFreeText?.split("。").filter(Boolean) ?? [],
        avoidedTimeHints: profile.avoidTimesFreeText?.split("。").filter(Boolean) ?? [],
        requiredInfos: profile.mailRequiredInfo,
        reasoningFactors: reasoningFactors ?? [],
        workPattern: workPattern ?? "",
        aiComment: aiComment ?? "",
      }
      setAnalyzedProfile(profileData)
      setScoredSlots(scores)
      setSelectedSlots(scores.filter(s => s.score !== "poor").map(s => s.timeSlot))
      const active = await getActiveConsultation()
      if (active) {
        const cacheData: CachedAnalysis = { forSlots: [...slots].sort(), scoredSlots: scores, ...profileData }
        await upsertConsultation({ ...active, cachedAnalysis: cacheData })
      }
    } catch {
      const r2 = req.recipient ?? {}
      const notes2 = [r2.notes, req.recipientScheduleNotes].filter(Boolean).join("\n")
      const inferred = inferProfileFromRole(r2.name ?? "", r2.role ?? "", r2.department ?? "", notes2)
      setInferredUserId(inferred.id)
      setAiStatus("mock")
      setScoredSlots(slots.map(s => ({ timeSlot: s, score: "fair" as const, privacyReason: "情報不足のため判定できません" })))
      setSelectedSlots(slots)
    } finally {
      setAnalyzing(false)
      setSlotsChanged(false)
    }
  }

  const handleReanalyze = async () => {
    if (!request) return
    await runAnalysis(request, localSlots)
  }

  const addRange = () => {
    if (!tempDate || !tempStart || !tempEnd) return
    const start = toMin(tempStart), end = toMin(tempEnd)
    if (end <= start) return
    const duration = request?.duration ?? 30
    const newRange: TimeRange = { date: tempDate, start: tempStart, end: tempEnd }
    const newSlots: string[] = []
    let cur = start
    while (cur + duration <= end) { newSlots.push(`${tempDate}T${toStr(cur)}`); cur += duration }
    if (newSlots.length === 0) return
    setLocalRanges(prev => [...prev, newRange])
    setLocalSlots(prev => [...new Set([...prev, ...newSlots])].sort())
    setSlotsChanged(true)
    setAddMsg(`${formatRangeJa(newRange)} を追加しました`)
    setTimeout(() => setAddMsg(null), 3000)
    setTempDate(new Date().toISOString().slice(0, 10))
    setAddFormOpen(false)
  }

  const deleteRange = (range: TimeRange) => {
    const duration = request?.duration ?? 30
    const start = toMin(range.start), end = toMin(range.end)
    setLocalRanges(prev => prev.filter(r => rangeKey(r) !== rangeKey(range)))
    setLocalSlots(prev => prev.filter(s => {
      if (!s.startsWith(range.date + "T")) return true
      const slotMin = toMin(s.split("T")[1].slice(0, 5))
      return !(slotMin >= start && slotMin + duration <= end)
    }))
    setSelectedSlots(prev => prev.filter(s => {
      if (!s.startsWith(range.date + "T")) return true
      const slotMin = toMin(s.split("T")[1].slice(0, 5))
      return !(slotMin >= start && slotMin + duration <= end)
    }))
    setScoredSlots(prev => prev.filter(s => {
      if (!s.timeSlot.startsWith(range.date + "T")) return true
      const slotMin = toMin(s.timeSlot.split("T")[1].slice(0, 5))
      return !(slotMin >= start && slotMin + duration <= end)
    }))
    setSlotsChanged(true)
  }

  const deleteSlot = (slot: string) => {
    setLocalSlots(prev => prev.filter(s => s !== slot))
    setSelectedSlots(prev => prev.filter(s => s !== slot))
    setScoredSlots(prev => prev.filter(s => s.timeSlot !== slot))
    setSlotsChanged(true)
  }

  const toggleRangeSelect = (rangeSlots: string[]) => {
    const allSelected = rangeSlots.every(s => selectedSlots.includes(s))
    if (allSelected) {
      setSelectedSlots(prev => prev.filter(s => !rangeSlots.includes(s)))
    } else {
      setSelectedSlots(prev => [...new Set([...prev, ...rangeSlots])])
    }
  }

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])
  }

  const toggleRangeExpand = (key: string) => {
    setExpandedRanges(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const getScoreEmoji = (s: string) => s === "excellent" ? "◎" : s === "good" ? "○" : s === "fair" ? "△" : "×"
  const getScoreLabel = (s: string) => s === "excellent" ? "問題なし" : s === "good" ? "ほぼOK" : s === "fair" ? "要注意" : "NG"
  const getScoreColor = (s: string) =>
    s === "excellent" ? "var(--color-excellent)" : s === "good" ? "var(--color-good)" : s === "fair" ? "var(--color-fair)" : "var(--color-danger)"
  const getScoreBg = (s: string) =>
    s === "excellent" ? "var(--color-excellent-bg)" : s === "good" ? "var(--color-good-bg)" : s === "fair" ? "var(--color-fair-bg)" : "var(--color-danger-bg)"

  const worstScore = (scores: TimeSlotScore[]) => {
    const order = ["poor", "fair", "good", "excellent"]
    return scores.reduce((worst, s) => order.indexOf(s.score) < order.indexOf(worst) ? s.score : worst, "excellent")
  }

  const handleNext = async () => {
    if (selectedSlots.length === 0) return
    const active = await getActiveConsultation()
    if (!active) return
    const duration = request?.duration ?? 30
    const r = request?.recipient ?? {}
    const combinedNotes = [r.notes, request?.recipientScheduleNotes].filter(Boolean).join("\n")
    const inferred = inferProfileFromRole(r.name ?? "", r.role ?? "", r.department ?? "", combinedNotes)
    const selectedTimeRanges = localRanges.filter(range => {
      const start = toMin(range.start), end = toMin(range.end)
      return selectedSlots.some(s => {
        if (!s.startsWith(range.date + "T")) return false
        const slotMin = toMin(s.split("T")[1].slice(0, 5))
        return slotMin >= start && slotMin + duration <= end
      })
    })
    const matchData = {
      targetUserId: inferredUserId || inferred.id,
      selectedTimeSlots: mergeConsecutiveSlots(selectedSlots, duration),
      selectedTimeSlotsRaw: selectedSlots,
      selectedTimeSlot: mergeConsecutiveSlots(selectedSlots, duration)[0] ?? formatJaWithEnd(selectedSlots[0], duration),
      selectedTimeRanges: selectedTimeRanges.length > 0 ? selectedTimeRanges : undefined,
      inferredProfile: {
        ...inferred,
        id: inferredUserId || inferred.id,
        availableTimesFreeText: analyzedProfile?.preferredTimeHints.join("。") ?? inferred.availableTimesFreeText,
        avoidTimesFreeText: analyzedProfile?.avoidedTimeHints.join("。") ?? inferred.avoidTimesFreeText,
        mailRequiredInfo: analyzedProfile?.requiredInfos ?? inferred.mailRequiredInfo,
      },
    }
    await upsertConsultation({
      ...active, status: "matched", match: matchData,
      request: { ...active.request!, myAvailableTimes: localSlots, myAvailableRanges: localRanges.length > 0 ? localRanges : undefined },
    })
    router.push("/mail")
  }

  // 表示用: 範囲ごとにグループ化、範囲に属さない孤立スロット
  const duration = request?.duration ?? 30
  const getRangeSlots = (range: TimeRange) => {
    const start = toMin(range.start), end = toMin(range.end)
    return localSlots.filter(s => {
      if (!s.startsWith(range.date + "T")) return false
      const slotMin = toMin(s.split("T")[1].slice(0, 5))
      return slotMin >= start && slotMin + duration <= end
    })
  }
  const orphanSlots = localSlots.filter(s =>
    !localRanges.some(r => {
      if (!s.startsWith(r.date + "T")) return false
      const slotMin = toMin(s.split("T")[1].slice(0, 5))
      return slotMin >= toMin(r.start) && slotMin + duration <= toMin(r.end)
    })
  )

  const recipient = request?.recipient
  const recipientLabel = [recipient?.name, recipient?.role, recipient?.department].filter(Boolean).join("・") || "（相手の情報が未入力です）"
  const poorSlots = scoredSlots.filter(s => s.score === "poor")
  const fairSlots = scoredSlots.filter(s => s.score === "fair")

  return (
    <div className={styles.container}>
      <StepIndicator current={2} />
      <div className={styles.header}>
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => router.push("/request")} style={{
            display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0,
            fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit",
          }}>← リクエストに戻る</button>
        </div>
        <h1>AI日程チェック</h1>
        <p>入力した空き時間を相手の役職・スケジュール情報と照らし合わせて問題がないか確認します。</p>
      </div>

      {recipientNote && (
        <div style={{ padding: "12px 16px", background: "rgba(232,146,78,0.08)", border: "2px solid rgba(232,146,78,0.35)", borderRadius: 14, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700, color: "var(--color-fair)" }}>🔄 再調整モード</div>
          <div style={{ color: "var(--text-secondary)" }}>相手からの返信: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>「{recipientNote}」</span></div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>この内容を踏まえて新しい候補日時を選んでください。</div>
        </div>
      )}

      {analyzing && (
        <div style={{ padding: "14px 18px", background: "var(--color-excellent-bg)", border: "1.5px solid rgba(78,191,173,0.3)", borderRadius: 14, fontSize: "0.85rem", fontWeight: 600, color: "var(--color-excellent)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          AIが各日程を相手の役職・情報と照らし合わせて確認中...
        </div>
      )}

      {!analyzing && aiStatus && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: aiStatus === "ai" ? "rgba(78,191,173,0.08)" : "rgba(232,146,78,0.08)", border: `1.5px solid ${aiStatus === "ai" ? "rgba(78,191,173,0.3)" : "rgba(232,146,78,0.35)"}`, borderRadius: 10, fontSize: "0.78rem", fontWeight: 700, color: aiStatus === "ai" ? "var(--color-excellent)" : "var(--color-fair)" }}>
          {aiStatus === "ai" ? "✓ Cloudflare AI で確認済み" : "⚠ モックデータを使用中（AI応答なし）"}
          {aiStatus === "mock" && <a href="/api/debug/ai" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", textDecoration: "underline" }}>診断を確認 →</a>}
        </div>
      )}

      {!analyzing && (poorSlots.length > 0 || fairSlots.length > 0) && (
        <div style={{ padding: "12px 16px", background: poorSlots.length > 0 ? "rgba(220,50,50,0.06)" : "rgba(232,146,78,0.07)", border: `1.5px solid ${poorSlots.length > 0 ? "rgba(220,50,50,0.25)" : "rgba(232,146,78,0.3)"}`, borderRadius: 14, fontSize: "0.84rem" }}>
          {poorSlots.length > 0 && <div style={{ fontWeight: 700, color: "var(--color-danger)", marginBottom: fairSlots.length > 0 ? 4 : 0 }}>✗ NG {poorSlots.length}件: 相手にとって都合が悪い可能性が高い日程があります</div>}
          {fairSlots.length > 0 && <div style={{ fontWeight: 600, color: "var(--color-fair)" }}>△ 要注意 {fairSlots.length}件: 確認が必要な日程があります</div>}
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>下のリストで各日程の理由を確認し、送る候補を選んでください</div>
        </div>
      )}

      {!analyzing && scoredSlots.length > 0 && poorSlots.length === 0 && fairSlots.length === 0 && (
        <div style={{ padding: "12px 16px", background: "rgba(78,191,173,0.08)", border: "1.5px solid rgba(78,191,173,0.3)", borderRadius: 14, fontSize: "0.84rem", fontWeight: 700, color: "var(--color-excellent)" }}>
          ✓ 全ての候補日程に問題は見つかりませんでした
        </div>
      )}

      {!analyzing && analyzedProfile && (
        <div className="glass-card fade-in" style={{ padding: "16px 18px" }}>
          <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
            <CalendarDays size={16} />
            <span>「{recipientLabel}」の推測されるスケジュール傾向</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analyzedProfile.reasoningFactors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                {analyzedProfile.reasoningFactors.map(f => (
                  <span key={f} style={{ padding: "3px 10px", background: "var(--bg-primary)", border: "1.5px solid var(--border-color)", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>📌 {f}</span>
                ))}
              </div>
            )}
            {analyzedProfile.workPattern && (
              <div style={{ fontSize: "0.8rem", padding: "7px 12px", background: "var(--color-excellent-bg)", border: "1px solid rgba(78,191,173,0.3)", borderRadius: 10, color: "var(--text-primary)" }}>
                <span style={{ fontWeight: 700, color: "var(--color-excellent)", marginRight: 6 }}>🗓 勤務パターン:</span>{analyzedProfile.workPattern}
              </div>
            )}
            {analyzedProfile.aiComment && (
              <div style={{ fontSize: "0.78rem", padding: "6px 12px", background: "rgba(232,146,78,0.06)", border: "1px solid rgba(232,146,78,0.25)", borderRadius: 10, color: "var(--color-fair)" }}>
                💬 {analyzedProfile.aiComment}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {analyzedProfile.preferredTimeHints.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>都合が良さそうな時間帯:</div>
                  <div className={styles.timeTagGroup}>{analyzedProfile.preferredTimeHints.map(h => <span key={h} className={styles.timeTagPrefer}>{h}</span>)}</div>
                </div>
              )}
              {analyzedProfile.avoidedTimeHints.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>避けた方が良い時間帯:</div>
                  <div className={styles.timeTagGroup}>{analyzedProfile.avoidedTimeHints.map(h => <span key={h} className={styles.timeTagAvoid}>{h}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* チェック結果 */}
      {!analyzing && (
        <div className="glass-card fade-in" style={{ padding: "18px" }}>
          {/* ヘッダー行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div className={styles.sectionTitle} style={{ margin: 0, flex: 1 }}>
              <CalendarDays size={16} />
              <span>チェック結果（送る候補を選択）</span>
            </div>
            <button
              onClick={() => setAddFormOpen(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: addFormOpen ? "var(--color-primary-bg)" : "var(--bg-primary)", border: `1.5px solid ${addFormOpen ? "var(--color-primary)" : "var(--border-color-hover)"}`, borderRadius: 14, fontSize: "0.78rem", fontWeight: 700, color: addFormOpen ? "var(--color-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit" }}
            >
              {addFormOpen ? <ChevronUp size={13} /> : <Plus size={13} />}
              日程を追加
            </button>
          </div>

          {/* 追加フォーム */}
          {addFormOpen && (
            <div style={{ padding: "14px", marginBottom: 12, background: "var(--color-primary-bg)", border: "1.5px solid rgba(112,185,126,0.3)", borderRadius: 14 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-primary)", marginBottom: 10 }}>空いている時間帯を追加（範囲で指定）</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} style={{ flex: 1, minWidth: 120, padding: "8px 10px", border: "1.5px solid var(--border-color)", borderRadius: 10, fontSize: "0.85rem", fontFamily: "inherit", background: "var(--bg-card)", color: "var(--text-primary)" }} />
                <select value={tempStart} onChange={e => setTempStart(e.target.value)} style={{ width: 100, padding: "8px 6px", border: "1.5px solid var(--border-color)", borderRadius: 10, fontSize: "0.85rem", fontFamily: "inherit", background: "var(--bg-card)", color: "var(--text-primary)" }}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>〜</span>
                <select value={tempEnd} onChange={e => setTempEnd(e.target.value)} style={{ width: 100, padding: "8px 6px", border: "1.5px solid var(--border-color)", borderRadius: 10, fontSize: "0.85rem", fontFamily: "inherit", background: "var(--bg-card)", color: "var(--text-primary)" }}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={addRange} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", background: "var(--color-primary)", border: "none", borderRadius: 12, fontSize: "0.82rem", fontWeight: 700, color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={14} />追加
                </button>
              </div>
              {addMsg && <div style={{ marginTop: 8, fontSize: "0.78rem", fontWeight: 700, color: "var(--color-primary)" }}>✓ {addMsg}</div>}
            </div>
          )}

          {/* 変更バナー */}
          {slotsChanged && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 12, background: "rgba(232,146,78,0.08)", border: "1.5px solid rgba(232,146,78,0.35)", borderRadius: 12, fontSize: "0.82rem", fontWeight: 600, color: "var(--color-fair)" }}>
              <span>日程が変更されました。再チェックすると最新の結果が反映されます。</span>
              <button onClick={handleReanalyze} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--color-secondary)", border: "none", borderRadius: 12, fontSize: "0.8rem", fontWeight: 700, color: "white", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                <RefreshCw size={13} />AIに再チェック
              </button>
            </div>
          )}

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 14 }}>
            範囲ごとにまとめて表示しています。右の▼で詳細を展開できます。チェックを外すと候補から除外されます。
          </p>

          {/* スロットが空 */}
          {localRanges.length === 0 && orphanSlots.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "12px 0" }}>候補日程がありません。「日程を追加」から追加してください。</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 範囲ごとの表示 */}
            {localRanges.map(range => {
              const key = rangeKey(range)
              const rangeSlots = getRangeSlots(range)
              const scored = rangeSlots.map(s => scoredSlots.find(ss => ss.timeSlot === s)).filter(Boolean) as TimeSlotScore[]
              const allChecked = rangeSlots.length > 0 && rangeSlots.every(s => selectedSlots.includes(s))
              const someChecked = rangeSlots.some(s => selectedSlots.includes(s))
              const worst = scored.length > 0 ? worstScore(scored) : null
              const isExpanded = expandedRanges.has(key)

              // スコア件数
              const counts: Record<string, number> = {}
              scored.forEach(s => { counts[s.score] = (counts[s.score] ?? 0) + 1 })
              const uncheckedCount = rangeSlots.length - scored.length

              return (
                <div key={key} style={{ border: `2px solid ${allChecked ? "var(--color-secondary)" : someChecked ? "var(--border-color-hover)" : "var(--border-color)"}`, borderRadius: 16, overflow: "hidden", background: allChecked ? "var(--color-secondary-bg)" : "var(--bg-card)" }}>
                  {/* 範囲ヘッダー行 */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                    onClick={() => toggleRangeSelect(rangeSlots)}
                  >
                    <input type="checkbox" checked={allChecked} readOnly className={styles.slotCheckbox} style={{ pointerEvents: "none", flexShrink: 0 }} />

                    {/* スコアバッジ */}
                    {worst ? (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeContent: "center", fontSize: "0.9rem", fontWeight: 700, flexShrink: 0, background: getScoreBg(worst), color: getScoreColor(worst) }}>
                        {getScoreEmoji(worst)}
                      </div>
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeContent: "center", fontSize: "0.8rem", fontWeight: 700, flexShrink: 0, background: "var(--bg-primary)", color: "var(--text-muted)", border: "1.5px dashed var(--border-color)" }}>？</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatRangeJa(range)}</div>
                      {/* スコア内訳チップ */}
                      <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                        {(["excellent", "good", "fair", "poor"] as const).map(sc =>
                          counts[sc] ? (
                            <span key={sc} style={{ fontSize: "0.72rem", fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: getScoreBg(sc), color: getScoreColor(sc) }}>
                              {getScoreEmoji(sc)} {counts[sc]}件
                            </span>
                          ) : null
                        )}
                        {uncheckedCount > 0 && (
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "var(--bg-primary)", color: "var(--text-muted)", border: "1px dashed var(--border-color)" }}>
                            未チェック {uncheckedCount}件
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 展開ボタン */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleRangeExpand(key) }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "none", border: "1.5px solid var(--border-color)", borderRadius: 10, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                    >
                      {isExpanded ? <><ChevronUp size={12} />閉じる</> : <><ChevronDown size={12} />詳細</>}
                    </button>

                    {/* 削除ボタン */}
                    <button
                      onClick={e => { e.stopPropagation(); deleteRange(range) }}
                      style={{ display: "flex", alignItems: "center", padding: "5px 8px", background: "none", border: "1.5px solid var(--border-color)", borderRadius: 10, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                      title="この範囲を削除"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-danger)"; (e.currentTarget as HTMLElement).style.color = "var(--color-danger)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 展開: 個別スロット */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--border-color)", padding: "8px 16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {rangeSlots.map(slot => {
                        const sc = scoredSlots.find(s => s.timeSlot === slot)
                        const isChecked = selectedSlots.includes(slot)
                        const score = sc?.score ?? "fair"
                        return (
                          <div key={slot} onClick={() => toggleSlot(slot)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "pointer", background: isChecked ? "rgba(232,168,124,0.08)" : "var(--bg-primary)", border: `1.5px solid ${isChecked ? "rgba(232,168,124,0.3)" : "var(--border-color)"}` }}>
                            <input type="checkbox" checked={isChecked} readOnly style={{ pointerEvents: "none", accentColor: "var(--color-secondary)" }} />
                            {sc ? (
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: getScoreColor(score), width: 20, textAlign: "center" }}>{getScoreEmoji(score)}</span>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", width: 20, textAlign: "center" }}>？</span>
                            )}
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{formatJaWithEnd(slot, duration)}</span>
                              {sc && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: 8 }}>{getScoreLabel(score)} — {sc.privacyReason}</span>}
                              {!sc && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 8 }}>未チェック</span>}
                            </div>
                            <button onClick={e => { e.stopPropagation(); deleteSlot(slot) }} style={{ display: "flex", alignItems: "center", padding: "3px 5px", background: "none", border: "1px solid var(--border-color)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-danger)" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* 孤立スロット（範囲に属さない個別スロット） */}
            {orphanSlots.map(slot => {
              const sc = scoredSlots.find(s => s.timeSlot === slot)
              const isChecked = selectedSlots.includes(slot)
              const score = sc?.score ?? "fair"
              return (
                <div key={slot} onClick={() => toggleSlot(slot)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 16, cursor: "pointer", background: isChecked ? "var(--color-secondary-bg)" : "var(--bg-card)", border: `2px solid ${isChecked ? "var(--color-secondary)" : "var(--border-color)"}` }}>
                  <input type="checkbox" checked={isChecked} readOnly className={styles.slotCheckbox} style={{ pointerEvents: "none" }} />
                  {sc ? (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeContent: "center", fontSize: "0.9rem", fontWeight: 700, background: getScoreBg(score), color: getScoreColor(score) }}>{getScoreEmoji(score)}</div>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeContent: "center", fontSize: "0.8rem", fontWeight: 700, background: "var(--bg-primary)", color: "var(--text-muted)", border: "1.5px dashed var(--border-color)" }}>？</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatJaWithEnd(slot, duration)}</div>
                    {sc && <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}><span style={{ fontWeight: 700, color: getScoreColor(score), marginRight: 4 }}>{getScoreLabel(score)}</span>{sc.privacyReason}</div>}
                    {!sc && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>未チェック — 「AIに再チェック」で評価します</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteSlot(slot) }} style={{ display: "flex", alignItems: "center", padding: "4px 6px", background: "none", border: "1.5px solid var(--border-color)", borderRadius: 8, cursor: "pointer", color: "var(--text-muted)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-danger)"; (e.currentTarget as HTMLElement).style.color = "var(--color-danger)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {selectedSlots.length > 0 && (
            <div className={styles.selectedSummary} style={{ marginTop: 14, flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <span className={styles.selectedCount}>選択中の候補（{mergeConsecutiveSlots(selectedSlots, duration).length}件）</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {mergeConsecutiveSlots(selectedSlots, duration).map(s => (
                  <span key={s} style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 600 }}>・{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <button onClick={handleNext} className={styles.btnNext} disabled={selectedSlots.length === 0}>
              選択した日時でメッセージ作成へ
              <Mail size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
