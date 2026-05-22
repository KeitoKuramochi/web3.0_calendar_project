"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Clock, MessageSquare, Sparkles, Plus, Trash2, ArrowRight } from "lucide-react"
import styles from "./request.module.css"
import { parseFreeText } from "@/lib/ai"
import { ConsultRequest } from "@/types"
import { POPULAR_TOPICS } from "@/lib/dummyData"

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
  const [availableTimes, setAvailableTimes] = useState<string[]>([
    "2026-05-29T10:00",
    "2026-05-29T11:00",
    "2026-05-27T14:00",
    "2026-05-28T15:00",
  ])

  const [aiNotice, setAiNotice] = useState<string | null>(null)

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
    setAvailableTimes(["2026-05-29T10:00", "2026-05-29T11:00", "2026-05-27T10:00", "2026-05-28T14:00"])
    setAiNotice(`デモ入力。AIが「${parsed.extractedTitle}」、${parsed.extractedDuration}分、対面を推測しました。`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (availableTimes.length === 0) {
      alert("空き時間を1つ以上追加してください。")
      return
    }

    const allTopics = [...selectedTopics]
    const requestData: Partial<ConsultRequest> = {
      id: `req_${Date.now()}`,
      requesterId: "user",
      title: title || allTopics[0] || "相談面談",
      duration,
      format,
      myAvailableTimes: availableTimes,
      freeTextInput: freeText,
      urgency,
      consultTopics: allTopics,
    }

    localStorage.setItem("consult_request", JSON.stringify(requestData))
    router.push("/match")
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>相談リクエスト作成</h1>
        <p>相談内容や希望形式、空き時間を入力してください。ざっくりした文章でもAIが読み取ります。</p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button type="button" onClick={loadPreset} className={styles.btnAddSlot} style={{ background: "var(--color-primary-bg)", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
          <Sparkles size={14} style={{ marginRight: "6px" }} />
          【デモ用】自動入力する
        </button>
      </div>

      <form onSubmit={handleSubmit} className="glass-card fade-in">

        {/* 1. 自由文 */}
        <div className={styles.sectionTitle}>
          <MessageSquare size={16} />
          <span>1. ざっくりした文章で伝える（推奨）</span>
        </div>

        <div className={styles.formGroupFull} style={{ marginBottom: "24px" }}>
          <label className={styles.label}>相談の目的・予定感を自由に入力</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onBlur={handleFreeTextBlur}
            placeholder="例: 来週くらいに進路について相談したいです。30分くらいで対面が希望。金曜午前が空いています。"
            className={styles.textarea}
          />
          {aiNotice && (
            <div className={styles.aiNotice}>
              <Sparkles size={14} style={{ color: "var(--color-secondary)", flexShrink: 0 }} />
              <span>{aiNotice}</span>
            </div>
          )}
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "24px 0" }} />

        {/* 2. 相談内容トピック */}
        <div className={styles.sectionTitle}>
          <Calendar size={16} />
          <span>2. 相談内容（タグ選択 + 自由入力）</span>
        </div>

        <div className={styles.formGroupFull} style={{ marginBottom: "24px" }}>
          <label className={styles.label}>人気のトピック（複数選択可）</label>
          <div className={styles.tagGrid}>
            {POPULAR_TOPICS.map((t) => (
              <button key={t} type="button"
                className={`${styles.tagChip} ${selectedTopics.includes(t) ? styles.tagChipActive : ""}`}
                onClick={() => toggleTopic(t)}>
                {t}
              </button>
            ))}
          </div>

          {/* カスタムトピック */}
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

        {/* 3. 詳細条件 */}
        <div className={styles.sectionTitle}>
          <Clock size={16} />
          <span>3. 詳細条件</span>
        </div>

        <div className={styles.formGrid}>
          {/* 件名 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>件名（ざっくりでOK）</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 進路相談、研究室のことを聞きたい"
              className={styles.input}
              required
            />
          </div>

          {/* 所要時間 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>所要時間</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={styles.select}>
              <option value={15}>15分（ちょっとした質問）</option>
              <option value={30}>30分（標準的な相談）</option>
              <option value={60}>60分（じっくり面談）</option>
              <option value={90}>90分（詳細な模擬面接など）</option>
            </select>
          </div>

          {/* 面談形式 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>面談形式</label>
            <div className={styles.toggleGroup}>
              {(["offline", "online", "hybrid"] as const).map((v) => (
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
              {([["low", "急がない"], ["normal", "普通"], ["high", "急ぎ"]] as const).map(([v, label]) => (
                <button key={v} type="button"
                  onClick={() => setUrgency(v)}
                  className={`${styles.toggleButton} ${urgency === v ? styles.toggleButtonActive : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 空き時間 (15分単位) */}
          <div className={styles.formGroupFull} style={{ marginTop: "10px" }}>
            <label className={styles.label}><Clock size={15} />自分の空き時間（15分単位で選択）</label>

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
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.btnSubmit}>
            相談先と日程候補を探す
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </div>
  )
}
