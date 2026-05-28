"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Clock, MessageSquare, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import styles from "./request.module.css"
import { parseFreeText } from "@/lib/ai"
import { ConsultRequest, RecipientInfo, TimeRange } from "@/types"
import { POPULAR_TOPICS, POPULAR_ROLES } from "@/lib/dummyData"
import { upsertConsultation, setActiveId, getActiveConsultation } from "@/lib/storage"
import StepIndicator from "@/components/StepIndicator/StepIndicator"

// 15分単位の時刻オプション生成 (8:00〜21:00)
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

export default function RequestPage() {
  const router = useRouter()

  const [freeText, setFreeText] = useState("")
  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState<number>(30)
  const [format, setFormat] = useState<"offline" | "online" | "hybrid">("hybrid")
  const [urgency, setUrgency] = useState<"high" | "normal" | "low">("normal")
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopicInput, setCustomTopicInput] = useState("")

  const [tempDate, setTempDate] = useState("")
  const [tempTime, setTempTime] = useState("10:00")
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [availableRanges, setAvailableRanges] = useState<TimeRange[]>([])

  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [recipientRole, setRecipientRole] = useState("")
  const [recipientDept, setRecipientDept] = useState("")
  const [recipientNotes, setRecipientNotes] = useState("")

  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ title?: string; slots?: string }>({})
  const [saveDraftToast, setSaveDraftToast] = useState(false)
  const [addMode, setAddMode] = useState<"single" | "range">("single")
  const [rangeEndTime, setRangeEndTime] = useState("12:00")
  const [rangeAddedMsg, setRangeAddedMsg] = useState<string | null>(null)
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null)
  const autoSaveDraftRef = useRef<{ id: string; createdAt: string } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 既存ドラフトの読み込み（ダッシュボードから再開した場合）
  useEffect(() => {
    getActiveConsultation().then((active) => {
      if (!active?.request || active.status !== "draft") {
        // 新規作成: デフォルトの空き時間候補を入れる
        const base = new Date(); base.setHours(0, 0, 0, 0)
        const fmtISO = (d: Date, h: number, m: number) => { const dd = new Date(d); dd.setHours(h, m, 0, 0); return dd.toISOString().slice(0, 16) }
        const d7 = new Date(base); d7.setDate(base.getDate() + 7)
        const d8 = new Date(base); d8.setDate(base.getDate() + 8)
        const d9 = new Date(base); d9.setDate(base.getDate() + 9)
        setAvailableTimes([fmtISO(d7, 10, 0), fmtISO(d7, 11, 0), fmtISO(d8, 14, 0), fmtISO(d9, 15, 0)])
        return
      }
      const req = active.request
      // フォームを復元
      if (req.freeTextInput) setFreeText(req.freeTextInput)
      if (req.title && req.title !== "（タイトルなし）") setTitle(req.title)
      setDuration(req.duration ?? 30)
      setFormat(req.format ?? "hybrid")
      setUrgency(req.urgency ?? "normal")
      if (req.consultTopics?.length) setSelectedTopics(req.consultTopics)
      setAvailableTimes(req.myAvailableTimes ?? [])
      setAvailableRanges(req.myAvailableRanges ?? [])
      if (req.recipient) {
        setRecipientName(req.recipient.name ?? "")
        setRecipientEmail(req.recipient.email ?? "")
        setRecipientRole(req.recipient.role ?? "")
        setRecipientDept(req.recipient.department ?? "")
        setRecipientNotes(req.recipient.notes ?? "")
      }
      // 同一IDで保存するようにrefを更新
      autoSaveDraftRef.current = { id: active.id, createdAt: active.createdAt }
      setAutoSaveLabel("自動保存済み")
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自動保存（3秒デバウンス）
  useEffect(() => {
    const hasEnoughData = (title.trim() !== "" || selectedTopics.length > 0) && availableTimes.length > 0
    if (!hasEnoughData) return
    setAutoSaveLabel("変更あり")
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const isFirst = !autoSaveDraftRef.current
      const now = new Date().toISOString()
      if (isFirst) autoSaveDraftRef.current = { id: `req_${Date.now()}`, createdAt: now }
      const { id, createdAt } = autoSaveDraftRef.current!
      await upsertConsultation({ id, status: "draft", createdAt, updatedAt: now, request: buildRequestData(id) })
      setActiveId(id)
      setAutoSaveLabel("自動保存済み")
    }, 3000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [title, recipientName, recipientEmail, recipientRole, recipientDept, availableTimes, availableRanges, duration, format, urgency, freeText, selectedTopics])

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

  const addTimeSlot = () => {
    if (!tempDate || !tempTime) return
    const slot = `${tempDate}T${tempTime}`
    if (!availableTimes.includes(slot)) {
      setAvailableTimes((prev) => [...prev, slot].sort())
    }
    setTempDate("")
    setTempTime("10:00")
  }

  const addTimeRange = () => {
    if (!tempDate || !tempTime || !rangeEndTime) return
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
    const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    const start = toMin(tempTime)
    const end = toMin(rangeEndTime)
    if (end <= start) return
    const newRange: TimeRange = { date: tempDate, start: tempTime, end: rangeEndTime }
    setAvailableRanges((prev) => [...prev, newRange])
    const slots: string[] = []
    let cur = start
    while (cur + duration <= end) {
      slots.push(`${tempDate}T${toStr(cur)}`)
      cur += duration
    }
    if (slots.length === 0) return
    setAvailableTimes((prev) => [...new Set([...prev, ...slots])].sort())
    setRangeAddedMsg(`${tempTime}〜${rangeEndTime} の範囲から ${slots.length} 件追加しました`)
    setTimeout(() => setRangeAddedMsg(null), 3000)
    setTempDate("")
  }

  const removeRange = (range: TimeRange) => {
    setAvailableRanges((prev) => prev.filter((r) => !(r.date === range.date && r.start === range.start && r.end === range.end)))
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
    const startMin = toMin(range.start); const endMin = toMin(range.end)
    setAvailableTimes((prev) => prev.filter((s) => {
      if (!s.startsWith(range.date + "T")) return true
      const [h, m] = s.split("T")[1].split(":").map(Number)
      const slotMin = h * 60 + m
      return slotMin < startMin || slotMin + duration > endMin
    }))
  }

  const removeTimeSlot = (slot: string) => {
    setAvailableTimes((prev) => prev.filter((t) => t !== slot))
  }

  const formatJa = (s: string) => {
    const d = new Date(s)
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
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
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const fmt = (d: Date, h: number) => { const dd = new Date(d); dd.setHours(h, 0, 0, 0); return dd.toISOString().slice(0, 16) }
    const d7 = new Date(base); d7.setDate(base.getDate() + 7)
    const d8 = new Date(base); d8.setDate(base.getDate() + 8)
    const d9 = new Date(base); d9.setDate(base.getDate() + 9)
    setAvailableTimes([fmt(d7, 10), fmt(d7, 11), fmt(d8, 10), fmt(d9, 14)])
    setAvailableRanges([])
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
      myAvailableTimes: availableTimes,
      myAvailableRanges: availableRanges.length > 0 ? availableRanges : undefined,
      freeTextInput: freeText,
      urgency,
      consultTopics: [...selectedTopics],
      recipient,
    }
  }

  const handleSaveDraft = async () => {
    const now = new Date().toISOString()
    const isFirst = !autoSaveDraftRef.current
    if (isFirst) autoSaveDraftRef.current = { id: `req_${Date.now()}`, createdAt: now }
    const { id, createdAt } = autoSaveDraftRef.current!
    await upsertConsultation({ id, status: "draft", createdAt, updatedAt: now, request: buildRequestData(id) })
    setActiveId(id)
    setAutoSaveLabel("自動保存済み")
    setSaveDraftToast(true)
    setTimeout(() => setSaveDraftToast(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: { title?: string; slots?: string } = {}
    const resolvedTitle = title.trim() || selectedTopics[0] || ""
    if (!resolvedTitle) errs.title = "件名またはトピックを入力してください"
    if (availableTimes.length === 0) errs.slots = "空き時間を1つ以上追加してください"
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
        <p>相談内容や希望形式、空き時間を入力してください。ざっくりした文章でもAIが読み取ります。</p>
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
          {/* 面談形式 */}
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

          {/* 急ぎ度 */}
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

          {/* 所要時間 */}
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

          {/* 件名 */}
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
          <span>4. 相手の情報（日程の推測精度が上がります）</span>
        </div>

        <div className={styles.formGrid} style={{ marginBottom: "24px" }}>
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
            <label className={styles.label}>メモ（任意）</label>
            <input
              type="text"
              value={recipientNotes}
              onChange={(e) => setRecipientNotes(e.target.value)}
              className={styles.input}
              placeholder="例: 火曜に研究会あり"
            />
          </div>
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "0 0 24px" }} />

        {/* 5. 空き時間 */}
        <div className={styles.sectionTitle}>
          <Clock size={16} />
          <span>5. 自分の空き時間</span>
        </div>

        <div className={styles.formGroupFull}>
          {/* モードトグル */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["single", "range"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAddMode(m)}
                style={{
                  padding: "7px 16px",
                  background: addMode === m ? "var(--color-primary-bg)" : "var(--bg-primary)",
                  border: `2px solid ${addMode === m ? "var(--color-primary)" : "var(--border-color)"}`,
                  borderRadius: 12, fontSize: "0.82rem", fontWeight: 700,
                  color: addMode === m ? "var(--color-primary)" : "var(--text-secondary)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {m === "single" ? "時間を指定" : "範囲で追加"}
              </button>
            ))}
          </div>

          {addMode === "range" && (
            <div style={{
              padding: "10px 14px", marginBottom: 8,
              background: "var(--color-primary-bg)",
              border: "1.5px solid rgba(112,185,126,0.25)", borderRadius: 12,
              fontSize: "0.78rem", color: "var(--color-primary)", fontWeight: 600, lineHeight: 1.6,
            }}>
              指定した範囲の候補日時（{duration}分単位）が自動展開されます。<br />
              相手は確定リンクから希望の {duration} 分を選べます。
            </div>
          )}

          <div className={styles.timeSlotInputGroup}>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className={styles.input}
              style={{ flex: "1" }}
            />
            <select
              value={tempTime}
              onChange={(e) => setTempTime(e.target.value)}
              className={styles.select}
              style={{ width: "105px" }}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {addMode === "range" && (
              <>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>〜</span>
                <select
                  value={rangeEndTime}
                  onChange={(e) => setRangeEndTime(e.target.value)}
                  className={styles.select}
                  style={{ width: "105px" }}
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}
            <button
              type="button"
              onClick={addMode === "single" ? addTimeSlot : addTimeRange}
              className={styles.btnAddSlot}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <Plus size={15} />
              {addMode === "single" ? "追加" : "展開して追加"}
            </button>
          </div>

          {rangeAddedMsg && (
            <div style={{
              fontSize: "0.8rem", fontWeight: 700, color: "var(--color-primary)",
              padding: "6px 12px", background: "var(--color-primary-bg)",
              borderRadius: 10, marginTop: 4,
            }}>
              ✓ {rangeAddedMsg}
            </div>
          )}

          {errors.slots && (
            <span style={{ fontSize: "0.8rem", color: "var(--color-danger)", fontWeight: 600 }}>{errors.slots}</span>
          )}
          <div className={styles.timeSlotList}>
            {availableTimes.length === 0 && availableRanges.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "8px 0" }}>
                空き時間が追加されていません
              </p>
            ) : (
              <>
                {/* 範囲指定エントリ */}
                {availableRanges.map((r, i) => {
                  const d = new Date(r.date)
                  const days = ["日", "月", "火", "水", "木", "金", "土"]
                  const label = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${r.start}〜${r.end}`
                  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
                  const slots = Math.floor((toMin(r.end) - toMin(r.start)) / duration)
                  return (
                    <div key={i} className={styles.timeSlotItem} style={{ background: "var(--color-primary-bg)", borderColor: "rgba(112,185,126,0.3)" }}>
                      <span style={{ fontWeight: 700 }}>📅 {label}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 6 }}>（{slots}枠）</span>
                      <button type="button" onClick={() => removeRange(r)} className={styles.btnRemoveSlot}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                {/* 個別スロット（範囲指定に含まれないもの） */}
                {availableTimes
                  .filter((slot) => {
                    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
                    return !availableRanges.some((r) => {
                      if (!slot.startsWith(r.date + "T")) return false
                      const slotMin = toMin(slot.split("T")[1].slice(0, 5))
                      return slotMin >= toMin(r.start) && slotMin + duration <= toMin(r.end)
                    })
                  })
                  .map((slot) => (
                    <div key={slot} className={styles.timeSlotItem}>
                      <span>{formatJa(slot)}</span>
                      <button type="button" onClick={() => removeTimeSlot(slot)} className={styles.btnRemoveSlot}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSaveDraft} onClick={handleSaveDraft}>
            下書き保存
          </button>
          <button type="submit" className={styles.btnSubmit}>
            次へ
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
