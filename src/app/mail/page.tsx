"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Mail, MessageSquare, ShieldCheck, AlertCircle, CheckCircle2, Copy, PartyPopper, Check, HelpCircle, ArrowLeft, UserX } from "lucide-react"
import styles from "./mail.module.css"
import { generateEmail, checkEmail } from "@/lib/ai"
import { ConsultRequest, UserProfile, MailCheckResult, MailIssue, OutputFormat } from "@/types"
import StepIndicator from "@/components/StepIndicator/StepIndicator"
import { getActiveConsultation, upsertConsultation, clearActiveId, getConsultations } from "@/lib/storage"

const FORMAT_OPTIONS: { value: OutputFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "email", label: "メール", icon: <Mail size={14} />, desc: "件名あり・丁寧な文体" },
  { value: "slack", label: "Slack", icon: <MessageSquare size={14} />, desc: "短め・インフォーマル" },
  { value: "line", label: "LINE", icon: <MessageSquare size={14} />, desc: "短い・カジュアル" },
  { value: "discord", label: "Discord", icon: <MessageSquare size={14} />, desc: "ラフ・絵文字あり" },
  { value: "short", label: "短文", icon: <MessageSquare size={14} />, desc: "1〜2文で完結" },
]

export default function MailPage() {
  const router = useRouter()

  const [requester, setRequester] = useState<UserProfile | null>(null)
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null)
  const [matchData, setMatchData] = useState<any>(null)
  const [request, setRequest] = useState<ConsultRequest | null>(null)

  const [outputFormat, setOutputFormat] = useState<OutputFormat>("email")
  const [isFirstContact, setIsFirstContact] = useState(true)
  const [pastContactCount, setPastContactCount] = useState(0)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [checkResult, setCheckResult] = useState<MailCheckResult>({ passed: true, issues: [] })

  const [showToast, setShowToast] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [activeIssueIdx, setActiveIssueIdx] = useState<number | null>(null)
  const [flashTextarea, setFlashTextarea] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // データロードと初期メール生成
  useEffect(() => {
    (async () => {
      const active = await getActiveConsultation()
      if (!active?.request || !active?.match) {
        router.replace("/request")
        return
      }

      const profileRes = await fetch("/api/profile")
      const sender: UserProfile = profileRes.ok ? await profileRes.json() : getDefaultSender()
      setRequester(sender)

      const req = active.request
      setRequest(req)

      const match = active.match
      setMatchData(match)

      const target: UserProfile = match.inferredProfile ?? buildFallbackProfile(req)
      setTargetUser(target)

      // 同一相手への過去の連絡件数を集計して初回判定
      const allConsults = await getConsultations()
      const recipientName = req.recipient?.name
      let firstContact = req.isFirstContact ?? true
      if (recipientName) {
        const past = allConsults.filter(r =>
          r.id !== active.id &&
          r.request?.recipient?.name === recipientName &&
          ["sent", "waiting", "confirmed", "rescheduling"].includes(r.status)
        ).length
        setPastContactCount(past)
        if (past > 0) firstContact = false
      }
      setIsFirstContact(firstContact)

      await upsertConsultation({ ...active, status: "composed" })
      regenerate(sender, target, req, match, "email", undefined, firstContact)
    })()
  }, [])

  // フォーマット切替時に再生成
  const handleFormatChange = (fmt: OutputFormat) => {
    setOutputFormat(fmt)
    if (requester && targetUser && request && matchData) {
      regenerate(requester, targetUser, request, matchData, fmt, undefined, isFirstContact)
    }
  }

  // isFirstContact切替時に再生成
  const handleFirstContactToggle = (val: boolean) => {
    setIsFirstContact(val)
    if (requester && targetUser && request && matchData) {
      regenerate(requester, targetUser, request, matchData, outputFormat, undefined, val)
    }
  }

  const regenerate = (
    sender: UserProfile,
    target: UserProfile,
    req: ConsultRequest,
    match: any,
    fmt: OutputFormat,
    token?: string,
    firstContact: boolean = true
  ) => {
    const slots: string[] = match.selectedTimeSlots ?? [match.selectedTimeSlot ?? "候補日時"]
    const generated = generateEmail(sender, target, req.title || "ご相談", slots, req.format || "offline", req.freeTextInput || "", fmt, token, firstContact)
    setSubject(generated.subject)
    setBody(generated.body)
    if (fmt === "email") {
      setCheckResult(checkEmail(generated.body, target))
    } else {
      setCheckResult({ passed: true, issues: [] })
    }
  }

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setBody(val)
    if (outputFormat === "email" && targetUser) {
      setCheckResult(checkEmail(val, targetUser))
    }
  }

  const jumpToIssue = (issue: MailIssue, idx: number) => {
    setActiveIssueIdx(idx)
    const textarea = bodyRef.current
    if (!textarea || !issue.searchText) return
    const pos = body.indexOf(issue.searchText)
    if (pos === -1) return
    textarea.focus()
    textarea.setSelectionRange(pos, pos + issue.searchText.length)
    const linesBefore = body.substring(0, pos).split("\n").length - 1
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 26
    textarea.scrollTop = Math.max(0, linesBefore * lineHeight - 80)
    setFlashTextarea(true)
    setTimeout(() => setFlashTextarea(false), 700)
  }

  const handleCopy = async () => {
    if (outputFormat === "email") {
      const firstError = checkResult.issues.find((i) => i.type === "error")
      if (firstError) {
        const idx = checkResult.issues.indexOf(firstError)
        jumpToIssue(firstError, idx)
        return
      }
    }
    // スケジュールトークンを生成してDB保存し、URL付き文面を再生成
    const token = crypto.randomUUID()
    const active = await getActiveConsultation()
    if (active && requester && targetUser && request && matchData) {
      await upsertConsultation({ ...active, status: "waiting", scheduleToken: token, senderDisplayName: requester.name })
      regenerate(requester, targetUser, request, matchData, outputFormat, token, isFirstContact)
      // URL挿入後の文面で少し待ってからコピー（state更新を待つ）
      await new Promise((r) => setTimeout(r, 50))
    }
    const latestBody = bodyRef.current?.value ?? body
    const text = subject ? `件名: ${subject}\n\n${latestBody}` : latestBody
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        setShowSuccessModal(true)
      }, 1500)
    })
  }

  const handleGoDashboard = async () => {
    const active = await getActiveConsultation()
    if (active) {
      const nextStatus = active.status === "waiting" ? "waiting" : "sent"
      await upsertConsultation({
        ...active,
        status: nextStatus,
        mail: { subject, body, format: outputFormat },
      })
    }
    clearActiveId()
    router.push("/")
  }

  const buildFallbackProfile = (req: ConsultRequest): UserProfile => ({
    id: "recipient",
    name: req.recipient?.name || "（相手の名前）",
    email: "",
    role: req.recipient?.role || "",
    department: req.recipient?.department || "",
    topics: [],
    availableTimesFreeText: "",
    avoidTimesFreeText: "",
    absoluteNGTimes: [],
    mailPolicy: "",
    mailRequiredInfo: [],
  })

  const getDefaultSender = (): UserProfile => ({
    id: "user",
    name: "（あなたの名前）",
    email: "",
    role: "学部生",
    department: "（所属を設定してください）",
    topics: [],
    availableTimesFreeText: "",
    avoidTimesFreeText: "",
    absoluteNGTimes: [],
    mailPolicy: "",
    mailRequiredInfo: [],
  })

  const getDefaultRequest = (): ConsultRequest => ({
    id: "req_default",
    requesterId: "user",
    title: "研究室選びに関する相談",
    duration: 30,
    format: "offline",
    myAvailableTimes: [],
    freeTextInput: "",
    urgency: "normal",
  })

  const getDefaultMatch = () => ({
    targetUserId: "prof_suzuki",
    selectedTimeSlots: ["5月29日(金) 10:00〜10:30"],
    selectedTimeSlot: "5月29日(金) 10:00〜10:30",
  })

  const errors = checkResult.issues.filter((i) => i.type === "error")
  const warnings = checkResult.issues.filter((i) => i.type === "warning")
  const hasIssues = checkResult.issues.length > 0
  const isEmailFormat = outputFormat === "email"

  return (
    <div className={styles.container}>
      <StepIndicator current={3} />
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.btnBack} onClick={() => router.push("/match")}>
            <ArrowLeft size={15} />
            日程を変更する
          </button>
        </div>
        <h1>メッセージ生成・確認</h1>
        <p>相手の連絡方針を踏まえたメッセージを生成しました。フォーマットを切り替えて用途に合わせて使えます。</p>
      </div>

      {/* プロフィール未設定の警告 */}
      {(!requester?.name || requester.name === "（あなたの名前）") && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "11px 16px",
          background: "var(--color-fair-bg)",
          border: "2px solid rgba(232, 146, 78, 0.3)",
          borderRadius: 14,
          fontSize: "0.85rem", fontWeight: 600, color: "var(--color-fair)",
          marginBottom: 4,
        }}>
          <UserX size={16} />
          プロフィールが未設定のため、差出人名などが空になっています。
          <a href="/profile" style={{ marginLeft: "auto", color: "var(--color-fair)", textDecoration: "underline", whiteSpace: "nowrap" }}>
            プロフィールを設定 →
          </a>
        </div>
      )}

      {/* 出力フォーマット切り替え */}
      <div className={styles.formatPicker}>
        {FORMAT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.formatBtn} ${outputFormat === opt.value ? styles.formatBtnActive : ""}`}
            onClick={() => handleFormatChange(opt.value)}
          >
            {opt.icon}
            <span className={styles.formatLabel}>{opt.label}</span>
            <span className={styles.formatDesc}>{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* 初回/2回目以降トグル */}
      <div className={styles.firstContactRow}>
        <span className={styles.firstContactLabel}>
          {request?.recipient?.name ? `${request.recipient.name}さんへの連絡` : "相手への連絡"}：
        </span>
        {pastContactCount > 0 && (
          <span className={styles.pastCountBadge}>過去 {pastContactCount} 件</span>
        )}
        <div className={styles.firstContactToggle}>
          <button
            type="button"
            className={`${styles.firstContactBtn} ${isFirstContact ? styles.firstContactBtnActive : ""}`}
            onClick={() => handleFirstContactToggle(true)}
          >
            はじめまして
          </button>
          <button
            type="button"
            className={`${styles.firstContactBtn} ${!isFirstContact ? styles.firstContactBtnActive : ""}`}
            onClick={() => handleFirstContactToggle(false)}
          >
            以前にやり取りあり
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* 左: メッセージ編集 */}
        <div>
          <div className={styles.sectionTitle}>
            <MessageSquare size={16} />
            <span>生成されたメッセージ（直接編集可）</span>
          </div>

          <div className={styles.mailEditor}>
            {isEmailFormat && (
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={styles.subjectInput}
                placeholder="件名"
              />
            )}
            <textarea
              ref={bodyRef}
              value={body}
              onChange={handleBodyChange}
              className={`${styles.bodyTextarea} ${flashTextarea ? styles.bodyTextareaFlash : ""}`}
              placeholder="メッセージ本文"
            />

            <div className={styles.editorFooter}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {isEmailFormat ? "コピーしてメーラーに貼り付けて送信してください。" : "コピーして各アプリに貼り付けてください。"}
              </span>
              <button
                onClick={handleCopy}
                className={`${styles.btnCopy} ${isEmailFormat && errors.length > 0 ? styles.btnCopyError : ""}`}
              >
                {isEmailFormat && errors.length > 0 ? (
                  <>
                    <AlertCircle size={15} />
                    エラー箇所を修正する
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    コピーして完了
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 右: チェック結果 */}
        <div>
          <div className={styles.checkerSidebar}>
            <div className={`${styles.checkStatusCard} glass-card`}>
              <div className={styles.sectionTitle} style={{ marginBottom: "10px" }}>
                <ShieldCheck size={16} style={{ color: "var(--color-secondary)" }} />
                <span>{isEmailFormat ? "メールチェックAI" : "チェック（メール形式のみ）"}</span>
              </div>

              {!isEmailFormat ? (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  チェック機能はメール形式でのみ動作します。
                </p>
              ) : errors.length > 0 ? (
                <div className={styles.checkStatusHeader} style={{ color: "var(--color-danger)" }}>
                  <AlertCircle size={18} /><span>未解決のエラーがあります</span>
                </div>
              ) : warnings.length > 0 ? (
                <div className={styles.checkStatusHeader} style={{ color: "var(--color-fair)" }}>
                  <AlertCircle size={18} /><span>改善可能な警告があります</span>
                </div>
              ) : (
                <div className={styles.checkStatusHeader} style={{ color: "var(--color-excellent)" }}>
                  <CheckCircle2 size={18} /><span>送信可能な状態です！</span>
                </div>
              )}

              {isEmailFormat && (
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: "8px 0 14px" }}>
                  {errors.length > 0 ? "指摘をタップすると該当箇所にカーソルが移動します。" : "警告は任意ですが修正すると印象が良くなります。"}
                </p>
              )}

              <div className={styles.issueList}>
                {checkResult.issues.map((issue, idx) => {
                  const isErr = issue.type === "error"
                  const isClickable = !!issue.searchText
                  const isActive = activeIssueIdx === idx
                  return (
                    <div
                      key={idx}
                      className={[
                        styles.issueItem,
                        isErr ? styles.issueError : styles.issueWarning,
                        isClickable ? styles.issueItemClickable : "",
                        isActive ? styles.issueItemActive : "",
                      ].join(" ")}
                      onClick={() => isClickable && jumpToIssue(issue, idx)}
                      title={isClickable ? "クリックで本文の該当箇所にジャンプ" : undefined}
                    >
                      <div className={`${styles.issueTitle} ${isErr ? styles.issueTitleError : styles.issueTitleWarning}`}>
                        <AlertCircle size={13} />
                        <span>{isErr ? "必須エラー" : "警告"}</span>
                      </div>
                      <div className={styles.issueMessage}>{issue.message}</div>
                      {issue.suggestion && (
                        <div className={styles.issueSuggestion}>
                          <span style={{ color: "var(--color-primary)", marginRight: "4px" }}>【修正案】</span>
                          {issue.suggestion}
                        </div>
                      )}
                      {isClickable && (
                        <div className={styles.jumpHint}>
                          ↗ クリックで本文の該当箇所を確認
                        </div>
                      )}
                    </div>
                  )
                })}
                {!hasIssues && isEmailFormat && (
                  <p style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    指摘事項はありません ✓
                  </p>
                )}
              </div>
            </div>

            {targetUser && isEmailFormat && (
              <div className="glass-card" style={{ padding: "14px" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <HelpCircle size={13} style={{ color: "var(--color-primary)" }} />
                  {targetUser.name}の指定条件:
                </div>
                <ul style={{ fontSize: "0.78rem", color: "var(--text-secondary)", paddingLeft: "14px" }}>
                  {targetUser.mailRequiredInfo.map((info, i) => (
                    <li key={i} style={{ marginBottom: "3px" }}>{info}</li>
                  ))}
                  {targetUser.mailRequiredInfo.length === 0 && <li>特になし</li>}
                </ul>
              </div>
            )}

          </div>
        </div>
      </div>

      {showToast && (
        <div className={styles.toast}>
          <Check size={16} />
          <span>クリップボードにコピーしました！</span>
        </div>
      )}

      {showSuccessModal && (
        <div className={styles.successOverlay}>
          <div className={`${styles.successCard} glass-card`}>
            <div className={styles.successIcon}><PartyPopper size={32} /></div>
            <h2>メッセージの準備完了！</h2>
            <p>
              {targetUser?.name}との「{request?.title}」のメッセージが作成・コピーされました。
            </p>
            <button onClick={handleGoDashboard} className={styles.btnDashboard}>
              ダッシュボードへ戻る
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
