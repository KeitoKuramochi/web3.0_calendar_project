"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, CalendarDays, Clock, MapPin, Monitor, Laptop, XCircle, ArrowLeft, User } from "lucide-react"
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

type View = "selecting" | "confirmed" | "rescheduling_form" | "rescheduled"

const FORMAT_INFO: Record<string, { icon: React.ReactNode; label: string; desc: string }> = {
  offline: {
    icon: <MapPin size={16} />,
    label: "対面",
    desc: "実際にお会いしてのミーティングです。場所の詳細は依頼者よりご連絡します。",
  },
  online: {
    icon: <Monitor size={16} />,
    label: "オンライン",
    desc: "Zoom・Google Meet などビデオ通話でのミーティングです。URLは依頼者より届きます。",
  },
  hybrid: {
    icon: <Laptop size={16} />,
    label: "対面 / オンライン",
    desc: "対面またはオンラインで対応可能です。確定後に依頼者と形式を相談してください。",
  },
}

export default function SchedulePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const [view, setView] = useState<View>("selecting")
  const [rescheduleFrom, setRescheduleFrom] = useState<"selecting" | "confirmed">("selecting")
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
      const d = await fetch(`/api/schedule/${token}`).then(r => r.json())
      setData(d)
      setConfirmedSlot(d.confirmedSlot)
      setView(d.status === "confirmed" ? "confirmed" : "rescheduled")
    }
    setConfirming(null)
  }

  const openRescheduleForm = (from: "selecting" | "confirmed") => {
    setRescheduleFrom(from)
    setRescheduleNote("")
    setRescheduleError("")
    setView("rescheduling_form")
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

  const senderLabel = data.senderDisplayName || data.senderName || "依頼者"
  const fmt = FORMAT_INFO[data.format] ?? FORMAT_INFO.hybrid

  // ── 確定済み ──────────────────────────────────────────
  if (view === "confirmed") return (
    <div className={styles.container}>
      <div className={styles.confirmedCard}>
        <div className={styles.confirmedIcon}><CheckCircle2 size={44} /></div>
        <h2>日程が確定しました！</h2>
        <div className={styles.confirmedSlot}>{confirmedSlot}</div>
        <p className={styles.confirmedNote}>
          <strong>{senderLabel}</strong>さんとの「{data.title}」が確定されました。<br />
          {data.format === "online"
            ? "ミーティングURLは依頼者よりご連絡します。"
            : data.format === "offline"
              ? "場所の詳細は依頼者よりご連絡します。"
              : "形式・場所の詳細は依頼者よりご連絡します。"}
        </p>
        <div className={styles.ctaBox}>
          <p>TaskelTaskal を使うと、あなたの予定を登録して<br />次回から日程調整をさらにスムーズにできます。</p>
          <a href="/" className={styles.ctaBtn}>アカウントを作成する（無料）</a>
        </div>
        <button className={styles.btnChangeConfirmed} onClick={() => openRescheduleForm("confirmed")}>
          日程を変更したい場合はこちら →
        </button>
      </div>
    </div>
  )

  // ── 再調整済み ────────────────────────────────────────
  if (view === "rescheduled") return (
    <div className={styles.container}>
      <div className={styles.confirmedCard}>
        <div className={styles.rescheduledIcon}><CheckCircle2 size={44} /></div>
        <h2>送信しました</h2>
        <p className={styles.confirmedNote}>
          <strong>{senderLabel}</strong>さんにあなたのご都合をお伝えしました。<br />
          確認後、改めてご連絡が届きます。
        </p>
        <div className={styles.ctaBox}>
          <p>TaskelTaskal を使うと、あなたの空き時間を登録して<br />次回から日程調整をさらにスムーズにできます。</p>
          <a href="/" className={styles.ctaBtn}>アカウントを作成する（無料）</a>
        </div>
      </div>
    </div>
  )

  // ── 別の日時を提案フォーム ────────────────────────────
  if (view === "rescheduling_form") {
    const isChange = rescheduleFrom === "confirmed"
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <button className={styles.btnBackTop} onClick={() => setView(rescheduleFrom)}>
            <ArrowLeft size={14} />
            戻る
          </button>

          <div className={styles.header}>
            <div className={styles.appName}>TaskelTaskal</div>
            <h1 className={styles.title}>
              {isChange ? "日程の変更を申請する" : "別の日時を提案する"}
            </h1>
            <p className={styles.subtitle}>
              {isChange
                ? `確定済みの「${data.title}」の日程変更を希望する場合、ご都合をテキストでお伝えください。`
                : `候補日時がすべて合わない場合、ご都合の良い日時をテキストでお伝えください。`}
            </p>
          </div>

          <div className={styles.rescheduleContext}>
            <User size={13} />
            <span>内容は <strong>{senderLabel}</strong>さんに通知されます</span>
          </div>

          <div className={styles.rescheduleForm}>
            <label className={styles.rescheduleLabel}>ご都合のよい日時（自由記述）</label>
            <textarea
              className={styles.rescheduleTextarea}
              placeholder={"例：来週の火曜か水曜の午後であれば対応可能です。\n月曜は終日難しいです。"}
              value={rescheduleNote}
              onChange={(e) => setRescheduleNote(e.target.value)}
              rows={5}
            />
            {rescheduleError && <p className={styles.rescheduleError}>{rescheduleError}</p>}
          </div>

          <div className={styles.rescheduleActions}>
            <button className={styles.btnBack} onClick={() => { setView(rescheduleFrom); setRescheduleError("") }}>
              キャンセル
            </button>
            <button
              className={styles.btnRescheduleSubmit}
              onClick={handleRescheduleSubmit}
              disabled={submittingReschedule || !rescheduleNote.trim()}
            >
              {submittingReschedule ? "送信中..." : isChange ? "変更を申請する" : "送信する"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 日時選択（メイン） ────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.card}>

        {/* ヘッダー */}
        <div className={styles.header}>
          <div className={styles.appName}>TaskelTaskal</div>
          {senderLabel !== "依頼者" && (
            <div className={styles.senderBadge}>
              <User size={13} />
              {senderLabel}さんよりご依頼
            </div>
          )}
          <h1 className={styles.title}>{data.title}</h1>
          <p className={styles.subtitle}>面談のご依頼が届いています。</p>
        </div>

        {/* 開催情報 */}
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <Clock size={15} />
            <span><strong>{data.duration}分</strong>のミーティング</span>
          </div>
          <div className={styles.infoDivider} />
          <div className={styles.infoRow}>
            {fmt.icon}
            <div>
              <div className={styles.infoFormatLabel}>{fmt.label}</div>
              <div className={styles.infoFormatDesc}>{fmt.desc}</div>
            </div>
          </div>
        </div>

        {/* 日時選択 */}
        <div className={styles.slotsLabel}>
          <CalendarDays size={15} />
          ご都合の良い日時を1つ選んでください
        </div>
        <p className={styles.slotsHint}>ボタンを押した瞬間に日程が確定されます</p>

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

        {/* 全部合わない */}
        <div className={styles.noMatchBox}>
          <button
            className={styles.btnNoMatch}
            onClick={() => openRescheduleForm("selecting")}
            disabled={!!confirming}
          >
            <XCircle size={15} />
            この候補日時はすべて都合がつきません
          </button>
          <p className={styles.noMatchHint}>
            押すと別の日時をテキストで伝える画面に移動します
          </p>
        </div>

        <p className={styles.footer}>
          ※ アカウント登録は不要です
        </p>
      </div>
    </div>
  )
}
