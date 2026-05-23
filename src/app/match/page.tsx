"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Users, CalendarDays, ShieldCheck, Mail } from "lucide-react"
import styles from "./match.module.css"
import { selectCandidates, scoreTimeSlots, analyzeProfile } from "@/lib/ai"
import { DUMMY_USERS } from "@/lib/dummyData"
import { ConsultRequest, TimeSlotScore } from "@/types"
import { formatJaWithEnd } from "@/lib/formatDate"
import StepIndicator from "@/components/StepIndicator/StepIndicator"

export default function MatchPage() {
  const router = useRouter()

  const [request, setRequest] = useState<ConsultRequest | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("")
  const [analyzedProfile, setAnalyzedProfile] = useState<any>(null)
  const [scoredSlots, setScoredSlots] = useState<TimeSlotScore[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]) // 複数選択

  useEffect(() => {
    let reqData: ConsultRequest
    const saved = localStorage.getItem("consult_request")
    if (saved) {
      try { reqData = JSON.parse(saved) } catch { router.replace("/request"); return }
    } else {
      router.replace("/request")
      return
    }
    setRequest(reqData)

    const keywords = reqData.consultTopics?.length
      ? reqData.consultTopics
      : reqData.title
      ? [reqData.title]
      : ["研究室選び"]
    const matched = selectCandidates(keywords, reqData.freeTextInput || "")
    setCandidates(matched)

    if (matched.length > 0) {
      handleSelectCandidate(matched[0].user.id, reqData)
    }
  }, [])

  const getDefault = (): ConsultRequest => ({
    id: "req_default",
    requesterId: "user",
    title: "研究室選びに関する相談",
    duration: 30,
    format: "offline",
    myAvailableTimes: [
      "2026-05-29T10:00",
      "2026-05-29T11:00",
      "2026-05-27T10:00",
      "2026-05-28T14:00",
    ],
    freeTextInput: "",
    urgency: "normal",
  })

  const handleSelectCandidate = (userId: string, currentReq = request) => {
    setSelectedCandidateId(userId)
    setSelectedSlots([])
    const user = DUMMY_USERS.find((u) => u.id === userId)
    if (!user || !currentReq) return
    setAnalyzedProfile(analyzeProfile(user))
    setScoredSlots(scoreTimeSlots(currentReq.myAvailableTimes, user))
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

  const handleNext = () => {
    if (!selectedCandidateId || selectedSlots.length === 0) return
    const duration = request?.duration ?? 30
    const matchData = {
      targetUserId: selectedCandidateId,
      selectedTimeSlots: selectedSlots.map((s) => formatJaWithEnd(s, duration)),
      selectedTimeSlotsRaw: selectedSlots,
      selectedTimeSlot: formatJaWithEnd(selectedSlots[0], duration),
    }
    localStorage.setItem("consult_match", JSON.stringify(matchData))
    router.push("/mail")
  }

  const selectedUser = DUMMY_USERS.find((u) => u.id === selectedCandidateId)

  return (
    <div className={styles.container}>
      <StepIndicator current={2} />
      <div className={styles.header}>
        <h1>相談先マッチング・日程調整</h1>
        <p>AIがリクエストに合った相談先を提案しました。候補日時は複数選択できます（相手に複数の選択肢を提示します）。</p>
      </div>

      <div className={styles.layout}>
        {/* 左: 相談先候補 */}
        <div>
          <div className={styles.sectionTitle}>
            <Users size={16} />
            <span>相談先候補（AI推奨順）</span>
          </div>

          <div className={styles.candidateList}>
            {candidates.map((cand) => (
              <div
                key={cand.user.id}
                className={`${styles.candidateCard} ${selectedCandidateId === cand.user.id ? styles.candidateCardActive : ""}`}
                onClick={() => handleSelectCandidate(cand.user.id)}
              >
                <span className={styles.matchBadge}>適合度 {cand.matchScore}%</span>
                <div className={styles.candidateHeader}>
                  <div className={styles.avatar}>{cand.user.avatar || "👤"}</div>
                  <div className={styles.candidateInfo}>
                    <h3>{cand.user.name}</h3>
                    <p>{cand.user.department}</p>
                  </div>
                </div>
                <div className={styles.recommendReason}>{cand.reason}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右: スコアリング */}
        <div>
          {selectedUser && (
            <div className={styles.detailSection}>
              {/* 相手の予定ルール */}
              <div className="glass-card fade-in" style={{ padding: "18px" }}>
                <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
                  <ShieldCheck size={16} style={{ color: "var(--color-secondary)" }} />
                  <span>相手の予定調整ルール（AI分析・ぼかし表現）</span>
                </div>

                <div className={styles.profileSummary}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>対応しやすい時間:</div>
                    <div className={styles.timeTagGroup}>
                      {analyzedProfile?.preferredTimeHints.length === 0
                        ? <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>特に指定なし</span>
                        : analyzedProfile?.preferredTimeHints.map((h: string) => (
                          <span key={h} className={styles.timeTagPrefer}>{h}</span>
                        ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "6px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>調整が難しい時間:</div>
                    <div className={styles.timeTagGroup}>
                      {analyzedProfile?.avoidedTimeHints.length === 0
                        ? <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>特に指定なし</span>
                        : analyzedProfile?.avoidedTimeHints.map((h: string) => (
                          <span key={h} className={styles.timeTagAvoid}>{h}</span>
                        ))}
                    </div>
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "0.82rem", background: "var(--bg-primary)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", lineHeight: "1.5" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>連絡方針: </span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedUser.mailPolicy}</span>
                  </div>
                </div>
              </div>

              {/* 日程スコアリング（複数選択） */}
              <div className="glass-card fade-in" style={{ padding: "18px" }}>
                <div className={styles.sectionTitle} style={{ marginBottom: "6px" }}>
                  <CalendarDays size={16} />
                  <span>調整可能性の高い日時（複数選択可）</span>
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
          )}
        </div>
      </div>
    </div>
  )
}
