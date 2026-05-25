"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, CalendarDays, Clock, MapPin, Monitor } from "lucide-react"
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
}

export default function SchedulePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/schedule/${token}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setData(d)
        if (d?.status === "confirmed" && d?.confirmedSlot) {
          setConfirmed(true)
          setConfirmedSlot(d.confirmedSlot)
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
      setConfirmed(true)
      setConfirmedSlot(slot)
    }
    setConfirming(null)
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

  if (confirmed) return (
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

        <p className={styles.footer}>
          ※ ボタンを押すと日程が確定されます。<br />
          アカウント登録は不要です。
        </p>
      </div>
    </div>
  )
}
