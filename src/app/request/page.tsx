"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Calendar, Clock, MessageSquare, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import styles from "./request.module.css"
import { parseFreeText } from "@/lib/ai"
import { ConsultRequest, RecipientInfo, TimeRange } from "@/types"
import { POPULAR_ROLES } from "@/lib/dummyData"
import { upsertConsultation, setActiveId, getActiveConsultation } from "@/lib/storage"
import { suggestSchedulePatterns } from "@/app/actions/ai"
import StepIndicator from "@/components/StepIndicator/StepIndicator"

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

  const [tempDate, setTempDate] = useState("")
  const [tempTime, setTempTime] = useState("10:00")
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [availableRanges, setAvailableRanges] = useState<TimeRange[]>([])
  const [rangeEndTime, setRangeEndTime] = useState("12:00")
  const [rangeAddedMsg, setRangeAddedMsg] = useState<string | null>(null)

  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [recipientRole, setRecipientRole] = useState("")
  const [recipientDept, setRecipientDept] = useState("")
  const [recipientScheduleNotes, setRecipientScheduleNotes] = useState("")
  const [schedulePatterns, setSchedulePatterns] = useState<string[]>([])

  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ title?: string; slots?: string }>({})
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
        setAvailableTimes(req.myAvailableTimes ?? [])
        setAvailableRanges(req.myAvailableRanges ?? [])
        if (req.recipient) {
          setRecipientName(req.recipient.name ?? "")
          setRecipientEmail(req.recipient.email ?? "")
          setRecipientRole(req.recipient.role ?? "")
          setRecipientDept(req.recipient.department ?? "")
        }
        setRecipientScheduleNotes(req.recipientScheduleNotes ?? "")
        setAutoSaveLabel("自動保存済み")
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 役職が変わったらスケジュールパターンチップを更新
  useEffect(() => {
    if (!recipientRole) { setSchedulePatterns([]); return }
    suggestSchedulePatterns(recipientRole, recipientDept).then(setSchedulePatterns)
  }, [recipientRole, recipientDept])

  useEffect(() => {
    const hasEnoughData = (title.trim() !== "" || selectedTopics.length > 0) && availableTimes.length > 0
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
  }, [title, recipientName, recipientEmail, recipientRole, recipientDept, availableTimes, availableRanges, duration, format, urgency, freeText, selectedTopics, recipientScheduleNotes])

  const handleFreeTextBlur = () => {
    if (!freeText.trim()) return
    const parsed = parseFreeText(freeText)
    if (parsed.extractedTitle) setTitle(parsed.extractedTitle)
    setDuration(parsed.extractedDuration)
    setFormat(parsed.extractedFormat)
    setUrgency(parsed.extractedUrgency)
    if (parsed.extractedKeywords.length > 0) setSelectedTopics(parsed.extractedKeywords)
    const fmtLabel = parsed.extractedFormat === "offline" ? "対面" : parsed.extractedFormat === "online" ? "オンライン" : "指定なし"
    setAiNotice(`AIが読み取りました：件名「${parsed.extractedTitle}」、${parsed.extractedDuration}分、${fmtLabel}`)
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
    setRangeAddedMsg(`${tempTime}〜${rangeEndTime} の範囲を追加しました`)
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
    setRecipientScheduleNotes("火曜は研究会あり。月曜午前は会議が多いと聞いた。")
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const d7 = new Date(base); d7.setDate(base.getDate() + 7)
    const d8 = new Date(base); d8.setDate(base.getDate() + 8)
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
    const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    const expandRange = (dateStr: string, start: string, end: string) => {
      const slots: string[] = []
      let cur = toMin(start)
      while (cur + 30 <= toMin(end)) { slots.push(`${dateStr}T${toStr(cur)}`); cur += 30 }
      return slots
    }
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
    const ranges: TimeRange[] = [
      { date: fmtDate(d7), start: "10:00", end: "12:00" },
      { date: fmtDate(d8), start: "14:00", end: "17:00" },
    ]
    setAvailableRanges(ranges)
    setAvailableTimes(ranges.flatMap(r => expandRange(r.date, r.start, r.end)))
    setAiNotice(`デモ入力。相手：鈴木 茂（研究室教員）、相談：就職活動、30分・対面。`)
  }

  const buildRequestData = (id: string): ConsultRequest => {
    const resolvedTitle = title.trim() || selectedTopics[0] || freeText.trim().slice(0, 40) || "（タイトルなし）"
    const recipient: RecipientInfo = {
      name: recipientName.trim() || undefined,
      email: recipientEmail.trim() || undefined,
      role: recipientRole.trim() || undefined,
      department: recipientDept.trim() || undefined,
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
        <p>相談内容・相手の情報・自分の空き時間を入力してください。AIが各候補日程に問題がないか確認します。</p>
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

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "0 0 24px" }} />

        {/* 2. 詳細設定 */}
        <div className={styles.sectionTitle}>
          <Clock size={16} />
          <span>2. 詳細設定</span>
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

        {/* 3. 相談相手の情報 */}
        <div className={styles.sectionTitle}>
          <Calendar size={16} />
          <span>3. 相手の情報（AIの判断精度が上がります）</span>
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
            rows={2}
            style={{ minHeight: 60 }}
            placeholder="知っている範囲で自由に記入してください。AIが日程チェックの参考にします。"
          />
          {schedulePatterns.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {schedulePatterns.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRecipientScheduleNotes((prev) => prev ? `${prev}、${p}` : p)}
                  style={{
                    padding: "4px 12px",
                    background: "var(--bg-primary)",
                    border: "1.5px solid var(--border-color-hover)",
                    borderRadius: 20,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  + {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "0 0 24px" }} />

        {/* 4. 自分の空き時間 */}
        <div className={styles.sectionTitle}>
          <Clock size={16} />
          <span>4. 自分の空き時間（範囲で指定）</span>
        </div>

        <div className={styles.formGroupFull}>
          <div style={{
            padding: "10px 14px", marginBottom: 8,
            background: "var(--color-primary-bg)",
            border: "1.5px solid rgba(112,185,126,0.25)", borderRadius: 12,
            fontSize: "0.78rem", color: "var(--color-primary)", fontWeight: 600, lineHeight: 1.6,
          }}>
            空いている時間帯を範囲で入力してください。相手がその中から都合の良い時間を選べます。
          </div>

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
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>〜</span>
            <select
              value={rangeEndTime}
              onChange={(e) => setRangeEndTime(e.target.value)}
              className={styles.select}
              style={{ width: "105px" }}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={addTimeRange}
              className={styles.btnAddSlot}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <Plus size={15} />
              追加
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
            {availableRanges.length === 0 && availableTimes.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "8px 0" }}>
                空き時間が追加されていません
              </p>
            ) : (
              <>
                {availableRanges.map((r, i) => {
                  const d = new Date(r.date)
                  const days = ["日", "月", "火", "水", "木", "金", "土"]
                  const label = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]}) ${r.start}〜${r.end}`
                  return (
                    <div key={i} className={styles.timeSlotItem} style={{ background: "var(--color-primary-bg)", borderColor: "rgba(112,185,126,0.3)" }}>
                      <span style={{ fontWeight: 700 }}>📅 {label}</span>
                      <button type="button" onClick={() => removeRange(r)} className={styles.btnRemoveSlot}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
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
            AIに日程を確認してもらう
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
