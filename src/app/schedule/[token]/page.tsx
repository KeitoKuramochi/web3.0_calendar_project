"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, CalendarDays, Clock, MapPin, Monitor, XCircle } from "lucide-react"
import styles from "./page.module.css"

interface ScheduleData {
  title: string
  senderName: string
  senderDisplayName: string | null
  selectedTimeSlots: string[]
  duration: number
  format: "offline" | "online" | "hybrid"
  status: string
  confirmedSlot: string | null
  recipientNote: string | null
}

export default function SchedulePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  // 画面状態: "selecting" | "confirmed" | "rescheduling_form" | "rescheduled"
  const [view, setView] = useState<"selecting" | "confirmed" | "rescheduling_form" | "rescheduled">("selecting")
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null)
  const [rescheduleNote, setRescheduleNote] = useState("")
  const [submittingReschedule, setSubmittingReschedule] = useState(false)
  const [rescheduleError, setRescheduleError] = useState("")

  useEffect(() => {
    fetch(`/api/schedule/${token}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: ScheduleData | null) => {
        setData(d)
        if (d?.status === "confirmed" && d.confirmedSlot) {
          setConfirmedSlot(d.confirmedSlot)
          setView("confirmed")
        } else if (d?.status === "rescheduling") {
          setView("rescheduled")
        }
        setLoading(false)
      })
  }, [token])

  const handleConfirm = async (slot: string) => {
    setConfirming(slot)
    const res = await fetch(`/api/schedule/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot }),
    })
    if (res.ok) {
      setConfirmedSlot(slot)
      setView("confirmed")
    } else if (res.status === 409) {
      // 既に確定済み — ページを再読み込みして最新状態を表示
      const d = await fetch(`/api/schedule/${token}`).then(r => r.json())
      setData(d)
      setConfirmedSlot(d.confirmedSlot)
      setView(d.status === "confirmed" ? "confirmed" : "rescheduled")
    }
    setConfirming(null)
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleNote.trim()) {
      setRescheduleError("都合のよい日時を入力してください")
      return
    }
    setSubmittingReschedule(true)
    setRescheduleError("")
    const res = await fetch(`/api/schedule/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", note: rescheduleNote }),
    })
    if (res.ok) {
      setView("rescheduled")
    } else if (res.status === 409) {
      setRescheduleError("この依頼はすでに処理済みです")
    } else {
      setRescheduleError("送信に失敗しました。もう一度お試しください")
    }
    setSubmittingReschedule(false)
  }

  const formatLabel = (f: string) =>
    f === "offline" ? "対面" : f === "online" ? "オンライン" : "対面 / オンライン"

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.loadingCard}>読み込み中...</div>
    </div>
  )

  if (!data) return (
    <div className={styles.container}>
      <div className={styles.errorCard}>
        <p>このリンクは無効または期限切れです。</p>
      </div>
    </div>
  )

  if (view === "confirmed") return (
    <div className={styles.container}>
      <div className={styles.confirmedCard}>
        <div className={styles.confirmedIcon}><CheckCircle2 size={40} /></div>
        <h2>日程が確定しました！</h2>
        <div className={styles.confirmedSlot}>{confirmedSlot}</div>
        <p className={styles.confirmedNote}>
          {data.title}の面談が確定されました。<br />
          送信者に通知されています。
        </p>
        <div className={styles.ctaBox}>
          <p>TaskelTaskal を使うと、あなたの予定を登録して<br />次回から日程調整をさらにスムーズにできます。</p>
          <a href="/" className={styles.ctaBtn}>アカウントを作成する（無料）</a>
        </div>
      </div>
    </div>
  )

  if (view === "rescheduled") return (
    <div className={styles.container}>
      <div className={styles.confirmedCard}>
        <div className={styles.rescheduledIcon}><CheckCircle2 size={40} /></div>
        <h2>送信しました</h2>
        <p className={styles.confirmedNote}>
          ご都合をお伝えしました。<br />
          送信者が確認後、改めてご連絡いたします。
        </p>
        <div className={styles.ctaBox}>
          <p>TaskelTaskal を使うと、あなたの空き時間を登録して<br />次回から日程調整をさらにスムーズにできます。</p>
          <a href="/" className={styles.ctaBtn}>アカウントを作成する（無料）</a>
        </div>
      </div>
    </div>
  )

  if (view === "rescheduling_form") return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.appName}>TaskelTaskal</div>
          <h1 className={styles.title}>別の日時を提案する</h1>
          <p className={styles.subtitle}>
            「{data.title}」について、ご都合のよい日時を自由に教えてください。
          </p>
        </div>

        <div className={styles.rescheduleForm}>
          <label className={styles.rescheduleLabel}>
            ご都合のよい日時（自由記述）
          </label>
          <textarea
            className={styles.rescheduleTextarea}
            placeholder={"例：来週の火曜か水曜の午後であれば対応可能です。\n月曜は終日難しいです。"}
            value={rescheduleNote}
            onChange={(e) => setRescheduleNote(e.target.value)}
            rows={5}
          />
          {rescheduleError && (
            <p className={styles.rescheduleError}>{rescheduleError}</p>
          )}
        </div>

        <div className={styles.rescheduleActions}>
          <button
            className={styles.btnBack}
            onClick={() => { setView("selecting"); setRescheduleError("") }}
          >
            戻る
          </button>
          <button
            className={styles.btnRescheduleSubmit}
            onClick={handleRescheduleSubmit}
            disabled={submittingReschedule || !rescheduleNote.trim()}
          >
            {submittingReschedule ? "送信中..." : "送信する"}
          </button>
        </div>

        <p className={styles.footer}>
          ※ 送信者に内容が通知されます。
        </p>
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.appName}>TaskelTaskal</div>
          <h1 className={styles.title}>面談のご依頼</h1>
          <p className={styles.subtitle}>
            「{data.title}」について面談のご依頼が届いています。
          </p>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <Clock size={14} />
            {data.duration}分
          </span>
          <span className={styles.metaItem}>
            {data.format === "online" ? <Monitor size={14} /> : <MapPin size={14} />}
            {formatLabel(data.format)}
          </span>
        </div>

        <div className={styles.slotsLabel}>
          <CalendarDays size={15} />
          ご都合の良い日時をお選びください
        </div>

        <div className={styles.slotList}>
          {data.selectedTimeSlots.map((slot) => (
            <button
              key={slot}
              className={`${styles.slotBtn} ${confirming === slot ? styles.slotBtnLoading : ""}`}
              onClick={() => handleConfirm(slot)}
              disabled={!!confirming}
            >
              <span className={styles.slotText}>{slot}</span>
              <span className={styles.slotAction}>
                {confirming === slot ? "確定中..." : "この日時で確定する →"}
              </span>
            </button>
          ))}
        </div>

        <button
          className={styles.btnNoMatch}
          onClick={() => setView("rescheduling_form")}
          disabled={!!confirming}
        >
          <XCircle size={15} />
          この候補日時はすべて都合がつきません
        </button>

        <p className={styles.footer}>
          ※ ボタンを押すと日程が確定されます。<br />
          アカウント登録は不要です。
        </p>
      </div>
    </div>
  )
}
