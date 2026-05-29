"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Clock, MessageSquare, Plus, ArrowRight, ArrowLeft } from "lucide-react"
import styles from "./request.module.css"
import { parseFreeText } from "@/lib/ai"
import { ConsultRequest, RecipientInfo } from "@/types"
import { POPULAR_TOPICS, POPULAR_ROLES } from "@/lib/dummyData"
import { upsertConsultation, setActiveId, getActiveConsultation } from "@/lib/storage"
import StepIndicator from "@/components/StepIndicator/StepIndicator"

export default function RequestPage() {
  const router = useRouter()

  const [freeText, setFreeText] = useState("")
  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState<number>(30)
  const [format, setFormat] = useState<"offline" | "online" | "hybrid">("hybrid")
  const [urgency, setUrgency] = useState<"high" | "normal" | "low">("normal")
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopicInput, setCustomTopicInput] = useState("")

  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [recipientRole, setRecipientRole] = useState("")
  const [recipientDept, setRecipientDept] = useState("")
  const [recipientNotes, setRecipientNotes] = useState("")
  const [recipientScheduleNotes, setRecipientScheduleNotes] = useState("")

  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ title?: string }>({})
  const [saveDraftToast, setSaveDraftToast] = useState(false)
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null)
  const autoSaveDraftRef = useRef<{ id: string; createdAt: string } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const now = new Date().toISOString()
    autoSaveDraftRef.current = { id: `req_${Date.now()}`, createdAt: now }

    getActiveConsultation().then((active) => {
      if (active?.request && active.status === "draft") {
        autoSaveDraftRef.current = { id: active.id, createdAt: active.createdAt }
        const req = active.request
        if (req.freeTextInput) setFreeText(req.freeTextInput)
        if (req.title && req.title !== "（タイトルなし）") setTitle(req.title)
        setDuration(req.duration ?? 30)
        setFormat(req.format ?? "hybrid")
        setUrgency(req.urgency ?? "normal")
        if (req.consultTopics?.length) setSelectedTopics(req.consultTopics)
        if (req.recipient) {
          setRecipientName(req.recipient.name ?? "")
          setRecipientEmail(req.recipient.email ?? "")
          setRecipientRole(req.recipient.role ?? "")
          setRecipientDept(req.recipient.department ?? "")
          setRecipientNotes(req.recipient.notes ?? "")
        }
        setRecipientScheduleNotes(req.recipientScheduleNotes ?? "")
        setAutoSaveLabel("自動保存済み")
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hasEnoughData = title.trim() !== "" || selectedTopics.length > 0
    if (!hasEnoughData) return
    setAutoSaveLabel("変更あり")
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const now = new Date().toISOString()
      if (!autoSaveDraftRef.current) autoSaveDraftRef.current = { id: `req_${Date.now()}`, createdAt: now }
      const { id, createdAt } = autoSaveDraftRef.current
      await upsertConsultation({ id, status: "draft", createdAt, updatedAt: now, request: buildRequestData(id) })
      setAutoSaveLabel("自動保存済み")
    }, 3000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [title, recipientName, recipientEmail, recipientRole, recipientDept, duration, format, urgency, freeText, selectedTopics, recipientScheduleNotes])

  const handleFreeTextBlur = () => {
    if (!freeText.trim()) return
    const parsed = parseFreeText(freeText)
    if (parsed.extractedTitle) setTitle(parsed.extractedTitle)
    setDuration(parsed.extractedDuration)
    setFormat(parsed.extractedFormat)
    setUrgency(parsed.extractedUrgency)
    const fmtLabel = parsed.extractedFormat === "offline" ? "対面" : parsed.extractedFormat === "online" ? "オンライン" : "指定なし"
    setAiNotice(`AIが読み取りました：件名「${parsed.extractedTitle}」、${parsed.extractedDuration}分、${fmtLabel}`)
  }

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  const addCustomTopic = () => {
    const t = customTopicInput.trim()
    if (!t || selectedTopics.includes(t)) return
    setSelectedTopics((prev) => [...prev, t])
    setCustomTopicInput("")
    if (!title) setTitle(t)
  }

  const loadPreset = () => {
    const text = "就活の進め方についてアドバイスをいただきたいです。"
    setFreeText(text)
    const parsed = parseFreeText(text)
    setTitle(parsed.extractedTitle || "就活相談")
    setDuration(30)
    setFormat("offline")
    setUrgency("normal")
    setSelectedTopics(["就職活動"])
    setRecipientName("鈴木 茂")
    setRecipientEmail("suzuki@example.ac.jp")
    setRecipientRole("研究室教員")
    setRecipientDept("情報工学科")
    setRecipientNotes("")
    setRecipientScheduleNotes("火曜は研究会があるみたい。月曜午前は会議が多いと聞いた。")
    setAiNotice(`デモ入力。相手：鈴木 茂（研究室教員）、相談：就職活動、30分・対面。`)
  }

  const buildRequestData = (id: string): ConsultRequest => {
    const resolvedTitle = title.trim() || selectedTopics[0] || freeText.trim().slice(0, 40) || "（タイトルなし）"
    const recipient: RecipientInfo = {
      name: recipientName.trim() || undefined,
      email: recipientEmail.trim() || undefined,
      role: recipientRole.trim() || undefined,
      department: recipientDept.trim() || undefined,
      notes: recipientNotes.trim() || undefined,
    }
    return {
      id,
      requesterId: "user",
      title: resolvedTitle,
      duration,
      format,
      myAvailableTimes: [],  // AIが match ページで生成する
      freeTextInput: freeText,
      urgency,
      consultTopics: [...selectedTopics],
      recipient,
      recipientScheduleNotes: recipientScheduleNotes.trim() || undefined,
    }
  }

  const handleSaveDraft = async () => {
    const now = new Date().toISOString()
    if (!autoSaveDraftRef.current) autoSaveDraftRef.current = { id: `req_${Date.now()}`, createdAt: now }
    const { id, createdAt } = autoSaveDraftRef.current
    await upsertConsultation({ id, status: "draft", createdAt, updatedAt: now, request: buildRequestData(id) })
    setActiveId(id)
    setAutoSaveLabel("自動保存済み")
    setSaveDraftToast(true)
    setTimeout(() => setSaveDraftToast(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: { title?: string } = {}
    const resolvedTitle = title.trim() || selectedTopics[0] || ""
    if (!resolvedTitle) errs.title = "件名またはトピックを入力してください"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const now = new Date().toISOString()
    const id = autoSaveDraftRef.current?.id ?? `req_${Date.now()}`
    const createdAt = autoSaveDraftRef.current?.createdAt ?? now
    await upsertConsultation({ id, status: "draft", createdAt, updatedAt: now, request: buildRequestData(id) })
    setActiveId(id)
    router.push("/match")
  }

  return (
    <div className={styles.container}>
      <StepIndicator current={1} />
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none" }}>
            <ArrowLeft size={14} />ダッシュボード
          </Link>
        </div>
        <h1>相談リクエスト作成</h1>
        <p>相談内容や相手の情報を入力してください。AIが日程候補を自動で提案します。</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {autoSaveLabel ? (
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: autoSaveLabel === "自動保存済み" ? "var(--color-excellent)" : "var(--text-muted)" }}>
            {autoSaveLabel === "自動保存済み" ? "✓ 自動保存済み" : "・・・"}
          </span>
        ) : <span />}
        <button type="button" onClick={loadPreset} className={styles.btnDemoText}>
          サンプルを入力してみる
        </button>
      </div>

      <form onSubmit={handleSubmit} className="glass-card fade-in">

        {/* 1. 相談の目的 */}
        <div className={styles.sectionTitle}>
          <MessageSquare size={16} />
          <span>1. 相談の目的</span>
        </div>

        <div className={styles.formGroupFull} style={{ marginBottom: aiNotice ? "12px" : "24px" }}>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onBlur={handleFreeTextBlur}
            placeholder="例: 就活の進め方についてアドバイスをいただきたい / 研究室選びで迷っていることを相談したい"
            className={styles.textareaMain}
            rows={4}
          />
          {aiNotice && (
            <div className={styles.aiNotice}>
              <span>{aiNotice}</span>
            </div>
          )}
        </div>

        {/* 2. 相談内容タグ */}
        <div className={styles.formGroupFull} style={{ marginBottom: "24px" }}>
          <label className={styles.label}>
            <Calendar size={14} />
            相談内容タグ（複数選択可）
          </label>
          <div className={styles.tagGrid}>
            {POPULAR_TOPICS.map((t) => (
              <button key={t} type="button"
                className={`${styles.tagChip} ${selectedTopics.includes(t) ? styles.tagChipActive : ""}`}
                onClick={() => toggleTopic(t)}>
                {t}
              </button>
            ))}
          </div>

          {selectedTopics.filter((t) => !POPULAR_TOPICS.includes(t)).length > 0 && (
            <div className={styles.tagGrid} style={{ marginTop: "6px" }}>
              {selectedTopics.filter((t) => !POPULAR_TOPICS.includes(t)).map((t) => (
                <button key={t} type="button"
                  className={`${styles.tagChip} ${styles.tagChipActive}`}
                  onClick={() => toggleTopic(t)}>
                  {t} ×
                </button>
              ))}
            </div>
          )}

          <div className={styles.timeSlotInputGroup} style={{ marginTop: "8px" }}>
            <input
              type="text"
              value={customTopicInput}
              onChange={(e) => setCustomTopicInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTopic() } }}
              className={styles.input}
              placeholder="その他のトピックを入力 + Enter"
            />
            <button type="button" onClick={addCustomTopic} className={styles.btnAddSlot}>
              <Plus size={15} />
            </button>
          </div>
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "0 0 24px" }} />

        {/* 3. 詳細設定 */}
        <div className={styles.sectionTitle}>
          <Clock size={16} />
          <span>3. 詳細設定</span>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>面談形式</label>
            <div className={styles.toggleGroup}>
              {(["hybrid", "offline", "online"] as const).map((v) => (
                <button key={v} type="button"
                  onClick={() => setFormat(v)}
                  className={`${styles.toggleButton} ${format === v ? styles.toggleButtonActive : ""}`}>
                  {v === "offline" ? "対面" : v === "online" ? "オンライン" : "どちらでも"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>優先度</label>
            <div className={styles.toggleGroup}>
              {([["normal", "普通"], ["high", "急ぎ"], ["low", "急がない"]] as const).map(([v, label]) => (
                <button key={v} type="button"
                  onClick={() => setUrgency(v)}
                  className={`${styles.toggleButton} ${urgency === v ? styles.toggleButtonActive : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>所要時間</label>
            <div className={styles.toggleGroup}>
              {([15, 30, 60, 90] as const).map((v) => (
                <button key={v} type="button"
                  onClick={() => setDuration(v)}
                  className={`${styles.toggleButton} ${duration === v ? styles.toggleButtonActive : ""}`}>
                  {v}分
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>件名（AIが自動入力）</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })) }}
              placeholder="例: 進路相談、研究室のことを聞きたい"
              className={styles.input}
              style={errors.title ? { borderColor: "var(--color-danger)" } : {}}
            />
            {errors.title && (
              <span style={{ fontSize: "0.8rem", color: "var(--color-danger)", fontWeight: 600 }}>{errors.title}</span>
            )}
          </div>
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "24px 0" }} />

        {/* 4. 相談相手の情報 */}
        <div className={styles.sectionTitle}>
          <Calendar size={16} />
          <span>4. 相手の情報（日程提案の精度が上がります）</span>
        </div>

        <div className={styles.formGrid} style={{ marginBottom: "16px" }}>
          <div className={styles.formGroup}>
            <label className={styles.label}>相手の名前（任意）</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className={styles.input}
              placeholder="例: 鈴木 茂"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>メールアドレス（任意）</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={styles.input}
              placeholder="例: suzuki@example.ac.jp"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>役割・役職</label>
            <select
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              className={styles.select}
            >
              <option value="">-- 選択してください --</option>
              {POPULAR_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>所属・学科・部署（任意）</label>
            <input
              type="text"
              value={recipientDept}
              onChange={(e) => setRecipientDept(e.target.value)}
              className={styles.input}
              placeholder="例: 情報工学科、キャリアセンター"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>相手についてのメモ（任意）</label>
            <input
              type="text"
              value={recipientNotes}
              onChange={(e) => setRecipientNotes(e.target.value)}
              className={styles.input}
              placeholder="例: 厳しいけど親切"
            />
          </div>
        </div>

        {/* 相手のスケジュールメモ */}
        <div className={styles.formGroupFull} style={{ marginBottom: "24px" }}>
          <label className={styles.label}>相手のスケジュールについて知っていること（任意）</label>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 6 }}>
            例: 月曜は研究室が閉まっている、6月5日は会食予定、毎週火曜は研究会がある
          </p>
          <textarea
            value={recipientScheduleNotes}
            onChange={(e) => setRecipientScheduleNotes(e.target.value)}
            className={styles.textareaMain}
            rows={3}
            style={{ minHeight: 80 }}
            placeholder="知っている範囲で自由に記入してください。AIが日程提案の参考にします。"
          />
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSaveDraft} onClick={handleSaveDraft}>
            下書き保存
          </button>
          <button type="submit" className={styles.btnSubmit}>
            AIに日程を提案してもらう
            <ArrowRight size={17} />
          </button>
        </div>
      </form>

      {saveDraftToast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "var(--text-primary)", color: "white",
          padding: "12px 20px", borderRadius: 16,
          fontWeight: 700, fontSize: "0.875rem",
          boxShadow: "0 4px 20px rgba(74, 55, 40, 0.25)",
          zIndex: 1000,
        }}>
          ✓ 下書きを保存しました
        </div>
      )}
    </div>
  )
}
