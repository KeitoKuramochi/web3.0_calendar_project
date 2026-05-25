"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Clock, MessageSquare, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import styles from "./request.module.css"
import { parseFreeText } from "@/lib/ai"
import { ConsultRequest, RecipientInfo } from "@/types"
import { POPULAR_TOPICS, POPULAR_ROLES } from "@/lib/dummyData"
import { upsertConsultation, setActiveId, getConsultations } from "@/lib/storage"
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
  const [availableTimes, setAvailableTimes] = useState<string[]>(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const fmt = (d: Date, h: number, m: number) => {
      const dd = new Date(d)
      dd.setHours(h, m, 0, 0)
      return dd.toISOString().slice(0, 16)
    }
    const d7 = new Date(base); d7.setDate(base.getDate() + 7)
    const d8 = new Date(base); d8.setDate(base.getDate() + 8)
    const d9 = new Date(base); d9.setDate(base.getDate() + 9)
    return [fmt(d7, 10, 0), fmt(d7, 11, 0), fmt(d8, 14, 0), fmt(d9, 15, 0)]
  })

  const [recipientName, setRecipientName] = useState("")
  const [recipientRole, setRecipientRole] = useState("")
  const [recipientDept, setRecipientDept] = useState("")
  const [recipientNotes, setRecipientNotes] = useState("")

  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ title?: string; slots?: string }>({})
  const [activeCount, setActiveCount] = useState(0)
  const [saveDraftToast, setSaveDraftToast] = useState(false)

  useEffect(() => {
    getConsultations().then((list) => {
      setActiveCount(list.filter((r) => r.status !== "sent").length)
    })
  }, [])

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

  const removeTimeSlot = (slot: string) => {
    setAvailableTimes((prev) => prev.filter((t) => t !== slot))
  }

  const formatJa = (s: string) => {
    const d = new Date(s)
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const loadPreset = () => {
    const text = "来週くらいに進路について相談したいです。鈴木先生と対面で30分くらいお話ししたいです。自分は金曜午前が空いています。急ぎではないです。"
    setFreeText(text)
    const parsed = parseFreeText(text)
    setTitle(parsed.extractedTitle)
    setDuration(parsed.extractedDuration)
    setFormat(parsed.extractedFormat)
    setUrgency(parsed.extractedUrgency)
    setSelectedTopics(["進路相談"])
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const fmt = (d: Date, h: number) => { const dd = new Date(d); dd.setHours(h, 0, 0, 0); return dd.toISOString().slice(0, 16) }
    const d7 = new Date(base); d7.setDate(base.getDate() + 7)
    const d8 = new Date(base); d8.setDate(base.getDate() + 8)
    const d9 = new Date(base); d9.setDate(base.getDate() + 9)
    setAvailableTimes([fmt(d7, 10), fmt(d7, 11), fmt(d8, 10), fmt(d9, 14)])
    setAiNotice(`デモ入力。AIが「${parsed.extractedTitle}」、${parsed.extractedDuration}分、対面を推測しました。`)
  }

  const buildRequestData = (id: string): ConsultRequest => {
    const resolvedTitle = title.trim() || selectedTopics[0] || freeText.trim().slice(0, 40) || "（タイトルなし）"
    const recipient: RecipientInfo = {
      name: recipientName.trim() || undefined,
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
      freeTextInput: freeText,
      urgency,
      consultTopics: [...selectedTopics],
      recipient,
    }
  }

  const handleSaveDraft = async () => {
    const id = `req_${Date.now()}`
    const now = new Date().toISOString()
    await upsertConsultation({ id, status: "draft", createdAt: now, updatedAt: now, request: buildRequestData(id) })
    setActiveId(id)
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

    const id = `req_${Date.now()}`
    const now = new Date().toISOString()
    await upsertConsultation({ id, status: "draft", createdAt: now, updatedAt: now, request: buildRequestData(id) })
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

      {activeCount > 0 && (
        <div style={{
          padding: "10px 16px", background: "var(--color-secondary-bg)",
          border: "2px solid rgba(245, 200, 74, 0.35)", borderRadius: 14,
          fontSize: "0.84rem", fontWeight: 600, color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span>進行中の相談が {activeCount} 件あります</span>
          <Link href="/" style={{ color: "var(--color-fair)", textDecoration: "underline", whiteSpace: "nowrap" }}>
            ダッシュボードで確認 →
          </Link>
        </div>
      )}

      <div style={{ textAlign: "right" }}>
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
            placeholder="例: 来週くらいに進路について鈴木先生に相談したいです。30分くらいで対面が希望。金曜午前が空いています。"
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
          <span>5. 自分の空き時間（15分単位）</span>
        </div>

        <div className={styles.formGroupFull}>
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
              style={{ width: "110px" }}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="button" onClick={addTimeSlot} className={styles.btnAddSlot}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Plus size={15} />
              追加
            </button>
          </div>

          {errors.slots && (
            <span style={{ fontSize: "0.8rem", color: "var(--color-danger)", fontWeight: 600 }}>{errors.slots}</span>
          )}
          <div className={styles.timeSlotList}>
            {availableTimes.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "8px 0" }}>
                空き時間が追加されていません
              </p>
            ) : (
              availableTimes.map((slot) => (
                <div key={slot} className={styles.timeSlotItem}>
                  <span>{formatJa(slot)}</span>
                  <button type="button" onClick={() => removeTimeSlot(slot)} className={styles.btnRemoveSlot}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
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
