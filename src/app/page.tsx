"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Plus, ArrowRight, Clock, CheckCircle2, Trash2, User, CalendarDays, Send, RefreshCw, Copy, Share2, Mail } from "lucide-react"
import styles from "./page.module.css"
import { getConsultations, deleteConsultation, upsertConsultation, setActiveId, clearActiveId } from "@/lib/storage"
import type { ConsultationRecord, ConsultationStatus, UserProfile } from "@/types"


const STATUS_META: Record<ConsultationStatus, { label: string; nextPath: string; actionLabel: string }> = {
  draft:     { label: "下書き",          nextPath: "/match", actionLabel: "相談先を探す" },
  matched:   { label: "日程候補あり",    nextPath: "/mail",  actionLabel: "メッセージを作成" },
  composed:  { label: "メッセージ完成",  nextPath: "/mail",  actionLabel: "メッセージを確認" },
  sent:         { label: "送信済み",      nextPath: "/",        actionLabel: "" },
  waiting:      { label: "確定待ち",      nextPath: "/",        actionLabel: "" },
  confirmed:    { label: "確定済み",      nextPath: "/",        actionLabel: "" },
  rescheduling: { label: "要再調整",      nextPath: "/request", actionLabel: "新しい候補で作り直す" },
}

export default function Home() {
  const { data: session } = useSession()
  const router = useRouter()
  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deletedTitle, setDeletedTitle] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [recopyToast, setRecopyToast] = useState<string | null>(null)
  const [expandedMail, setExpandedMail] = useState<Set<string>>(new Set())

  useEffect(() => {
    getConsultations().then(setRecords)
    fetch("/api/profile").then(r => r.ok ? r.json() : null).then(setProfile)
  }, [session])

  const handleResume = (record: ConsultationRecord) => {
    setActiveId(record.id)
    router.push(STATUS_META[record.status].nextPath)
  }

  const handleNewRequest = () => {
    clearActiveId()
    router.push("/request")
  }

  const handleDelete = async (id: string) => {
    const title = records.find((r) => r.id === id)?.request?.title ?? "相談"
    await deleteConsultation(id)
    getConsultations().then(setRecords)
    setDeleteConfirm(null)
    setDeletedTitle(title)
    setTimeout(() => setDeletedTitle(null), 2500)
  }

  const handleResetConfirmed = async (id: string) => {
    const record = records.find((r) => r.id === id)
    if (!record) return
    const reset: ConsultationRecord = {
      ...record,
      status: "draft",
      match: undefined,
      mail: undefined,
      scheduleToken: undefined,
      confirmedSlot: undefined,
      recipientNote: undefined,
      updatedAt: new Date().toISOString(),
    }
    await upsertConsultation(reset)
    setResetConfirm(null)
    setActiveId(id)
    router.push("/match")
  }

  const handleRecopy = (record: ConsultationRecord) => {
    if (!record.mail) return
    const text = record.mail.format === "email" && record.mail.subject
      ? `件名: ${record.mail.subject}\n\n${record.mail.body}`
      : record.mail.body
    navigator.clipboard.writeText(text).then(() => {
      setRecopyToast(record.id)
      setTimeout(() => setRecopyToast(null), 2000)
    })
  }

  const getTargetName = (record: ConsultationRecord): string | null =>
    record.match?.inferredProfile?.name ?? record.request?.recipient?.name ?? null

  const getTargetEmail = (record: ConsultationRecord): string | null =>
    record.request?.recipient?.email ?? null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return "今日"
    if (diffDays === 1) return "昨日"
    if (diffDays < 7) return `${diffDays}日前`
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  const active = records.filter((r) => !["sent", "waiting", "confirmed", "rescheduling"].includes(r.status))
  const rescheduling = records.filter((r) => r.status === "rescheduling")
  const waiting = records.filter((r) => r.status === "waiting")
  const confirmed = records.filter((r) => r.status === "confirmed").slice(0, 5)
  const sent = records.filter((r) => r.status === "sent").slice(0, 5)

  return (
    <div className={styles.container}>

      {/* ページヘッダー */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.greeting}>
            {session?.user?.name
              ? `${session.user.name.split(/[\s　]/)[0]}さん、こんにちは`
              : "ダッシュボード"}
          </h1>
          <p className={styles.greetingSub}>今日もスムーズに日程調整しましょう</p>
        </div>
        <button className={styles.btnNewRequest} onClick={handleNewRequest}>
          <Plus size={17} />
          新しい相談を作成
        </button>
      </div>

      {/* プロフィールサマリー（全体がリンク） */}
      <Link href="/profile" className={styles.profileSummary}>
        {profile?.name ? (
          <>
            <div className={styles.profileSummaryInfo}>
              <div className={styles.profileSummaryName}>{profile.name}</div>
              <div className={styles.profileSummaryMeta}>
                {[profile.role, profile.department].filter(Boolean).join(" · ")}
              </div>
            </div>
            <span className={styles.profileSummaryLink}>編集する →</span>
          </>
        ) : (
          <>
            <div className={styles.profileSummaryMeta}>プロフィールを設定すると、より精度の高いメッセージが生成されます</div>
            <span className={styles.profileSummaryLink}>設定する →</span>
          </>
        )}
      </Link>

      {/* 進行中の相談 */}
      {active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Clock size={16} />
            進行中の相談
          </h2>
          <div className={styles.cardList}>
            {active.map((record) => {
              const meta = STATUS_META[record.status]
              const targetName = getTargetName(record)
              const targetEmail = getTargetEmail(record)
              return (
                <div key={record.id} className={styles.consultCard}>
                  <div className={styles.consultCardTop}>
                    <span className={`${styles.statusBadge} ${styles[record.status]}`}>
                      {meta.label}
                    </span>
                    <button
                      className={styles.btnDelete}
                      onClick={() => setDeleteConfirm(record.id)}
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className={styles.consultCardBody}>
                    <h3 className={styles.consultTitle}>
                      {record.request?.title || "（タイトルなし）"}
                    </h3>
                    <div className={styles.consultMeta}>
                      {targetName && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {targetName}
                        </span>
                      )}
                      {targetEmail && (
                        <a href={`mailto:${targetEmail}`} className={styles.consultMetaItem} style={{ textDecoration: "none" }}>
                          <Mail size={13} />
                          {targetEmail}
                        </a>
                      )}
                      <span className={styles.consultMetaItem}>
                        <CalendarDays size={13} />
                        {formatDate(record.createdAt)}作成
                      </span>
                    </div>
                    {record.match?.selectedTimeSlots && record.match.selectedTimeSlots.length > 0 && (
                      <div className={styles.slotPreview}>
                        候補: {record.match.selectedTimeSlots[0]}
                        {record.match.selectedTimeSlots.length > 1 &&
                          ` 他${record.match.selectedTimeSlots.length - 1}件`}
                      </div>
                    )}
                  </div>
                  <div className={styles.consultCardFooter}>
                    <button className={styles.btnResume} onClick={() => handleResume(record)}>
                      {meta.actionLabel}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 空状態 */}
      {records.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🌿</span>
          <p className={styles.emptyTitle}>まだ相談がありません</p>
          <p className={styles.emptyHint}>「新しい相談を作成」から始めましょう</p>
          <button className={styles.btnStart} onClick={handleNewRequest}>
            最初の相談を作成する
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* 要再調整 */}
      {rescheduling.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <RefreshCw size={16} />
            要再調整の相談
          </h2>
          <div className={styles.cardList}>
            {rescheduling.map((record) => {
              const targetName = getTargetName(record)
              const targetEmail = getTargetEmail(record)
              return (
                <div key={record.id} className={`${styles.consultCard} ${styles.reschedulingCard}`}>
                  <div className={styles.consultCardTop}>
                    <span className={`${styles.statusBadge} ${styles.rescheduling}`}>要再調整</span>
                    <button className={styles.btnDelete} onClick={() => setDeleteConfirm(record.id)} title="削除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className={styles.consultCardBody}>
                    <h3 className={styles.consultTitle}>{record.request?.title || "（タイトルなし）"}</h3>
                    <div className={styles.consultMeta}>
                      {targetName && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {targetName}
                        </span>
                      )}
                      {targetEmail && (
                        <a href={`mailto:${targetEmail}`} className={styles.consultMetaItem} style={{ textDecoration: "none" }}>
                          <Mail size={13} />
                          {targetEmail}
                        </a>
                      )}
                    </div>
                    {record.recipientNote && (
                      <div className={styles.recipientNote}>
                        <div className={styles.recipientNoteLabel}>相手からの返信:</div>
                        <div className={styles.recipientNoteText}>{record.recipientNote}</div>
                      </div>
                    )}
                  </div>
                  <div className={styles.consultCardFooter}>
                    <button className={styles.btnResume} onClick={() => handleResume(record)}>
                      新しい候補で作り直す
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 確定待ち */}
      {waiting.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Send size={16} />
            確定待ちの相談
          </h2>
          <div className={styles.cardList}>
            {waiting.map((record) => {
              return (
                <div key={record.id} className={styles.consultCard}>
                  <div className={styles.consultCardTop}>
                    <span className={`${styles.statusBadge} ${styles.waiting}`}>確定待ち</span>
                    <button className={styles.btnDelete} onClick={() => setDeleteConfirm(record.id)} title="削除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className={styles.consultCardBody}>
                    <h3 className={styles.consultTitle}>{record.request?.title || "（タイトルなし）"}</h3>
                    <div className={styles.consultMeta}>
                      {record.request?.recipient?.name && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {record.request.recipient.name}
                        </span>
                      )}
                      {record.request?.recipient?.email && (
                        <a href={`mailto:${record.request.recipient.email}`} className={styles.consultMetaItem} style={{ textDecoration: "none" }}>
                          <Mail size={13} />
                          {record.request.recipient.email}
                        </a>
                      )}
                      <span className={styles.consultMetaItem}>
                        <CalendarDays size={13} />
                        {formatDate(record.updatedAt)}送信
                      </span>
                    </div>
                    {record.mail && (() => {
                      const isExpanded = expandedMail.has(record.id)
                      const lines = record.mail.body.split("\n").filter(l => l.trim())
                      const preview = lines.slice(0, 3).join("\n")
                      const hasMore = lines.length > 3
                      return (
                        <div className={styles.mailPreview}>
                          {record.mail.format === "email" && record.mail.subject && (
                            <div className={styles.mailPreviewSubject}>件名: {record.mail.subject}</div>
                          )}
                          <div className={isExpanded ? styles.mailPreviewBodyFull : styles.mailPreviewBody}>
                            {isExpanded ? record.mail.body : preview}
                          </div>
                          <div className={styles.mailPreviewActions}>
                            {hasMore && (
                              <button
                                className={styles.btnExpandMail}
                                onClick={() => setExpandedMail(prev => {
                                  const next = new Set(prev)
                                  isExpanded ? next.delete(record.id) : next.add(record.id)
                                  return next
                                })}
                              >
                                {isExpanded ? "閉じる ▲" : "全文を見る ▼"}
                              </button>
                            )}
                            <button
                              className={`${styles.btnRecopy} ${recopyToast === record.id ? styles.btnRecopyDone : ""}`}
                              onClick={() => handleRecopy(record)}
                            >
                              <Copy size={12} />
                              {recopyToast === record.id ? "コピーしました！" : "もう一度コピー"}
                            </button>
                            {record.scheduleToken && typeof navigator !== "undefined" && "share" in navigator && (
                              <button
                                className={styles.btnRecopy}
                                onClick={() => {
                                  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/schedule/${record.scheduleToken}`
                                  navigator.share({ url, title: record.request?.title ?? "日程確定リンク" })
                                }}
                              >
                                <Share2 size={12} />
                                送る
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 確定済み */}
      {confirmed.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <CheckCircle2 size={16} />
            確定済みの相談
          </h2>
          <div className={styles.cardList}>
            {confirmed.map((record) => (
              <div key={record.id} className={`${styles.consultCard} ${styles.confirmedCard}`}>
                <div className={styles.consultCardTop}>
                  <span className={`${styles.statusBadge} ${styles.confirmed}`}>確定済み</span>
                  <button className={styles.btnDelete} onClick={() => setDeleteConfirm(record.id)} title="削除">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className={styles.consultCardBody}>
                  <h3 className={styles.consultTitle}>{record.request?.title || "（タイトルなし）"}</h3>
                  {(record.request?.recipient?.name || record.request?.recipient?.email) && (
                    <div className={styles.consultMeta}>
                      {record.request.recipient?.name && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {record.request.recipient.name}
                        </span>
                      )}
                      {record.request.recipient?.email && (
                        <a href={`mailto:${record.request.recipient.email}`} className={styles.consultMetaItem} style={{ textDecoration: "none" }}>
                          <Mail size={13} />
                          {record.request.recipient.email}
                        </a>
                      )}
                    </div>
                  )}
                  {record.confirmedSlot && (
                    <div style={{
                      marginTop: 8, padding: "8px 12px",
                      background: "rgba(138,180,104,0.12)",
                      border: "1.5px solid rgba(138,180,104,0.3)",
                      borderRadius: 10, fontSize: "0.88rem", fontWeight: 700,
                      color: "var(--color-excellent)",
                    }}>
                      ✓ {record.confirmedSlot}
                    </div>
                  )}
                  {(record.recipientName || record.recipientContact) && (
                    <div className={styles.recipientContact}>
                      <span className={styles.recipientContactLabel}>相手：</span>
                      <span className={styles.recipientContactValue}>
                        {[record.recipientName, record.recipientContact].filter(Boolean).join(" / ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.consultCardFooter}>
                  <button
                    className={styles.btnChangeSchedule}
                    onClick={() => setResetConfirm(record.id)}
                  >
                    <RefreshCw size={14} />
                    日程を変更する
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 送信済み */}
      {sent.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <CheckCircle2 size={16} />
            送信済みの相談
          </h2>
          <div className={styles.cardList}>
            {sent.map((record) => {
              const targetName = getTargetName(record)
              const targetEmail = getTargetEmail(record)
              return (
                <div key={record.id} className={`${styles.consultCard} ${styles.sentCard}`}>
                  <div className={styles.consultCardTop}>
                    <span className={`${styles.statusBadge} ${styles.sent}`}>送信済み</span>
                    <button
                      className={styles.btnDelete}
                      onClick={() => setDeleteConfirm(record.id)}
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className={styles.consultCardBody}>
                    <h3 className={styles.consultTitle}>
                      {record.request?.title || "（タイトルなし）"}
                    </h3>
                    <div className={styles.consultMeta}>
                      {targetName && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {targetName}
                        </span>
                      )}
                      {targetEmail && (
                        <a href={`mailto:${targetEmail}`} className={styles.consultMetaItem} style={{ textDecoration: "none" }}>
                          <Mail size={13} />
                          {targetEmail}
                        </a>
                      )}
                      <span className={styles.consultMetaItem}>
                        <CalendarDays size={13} />
                        {formatDate(record.updatedAt)}送信
                      </span>
                    </div>
                    {record.mail && (() => {
                      const isExpanded = expandedMail.has(record.id)
                      const lines = record.mail.body.split("\n").filter(l => l.trim())
                      const preview = lines.slice(0, 3).join("\n")
                      const hasMore = lines.length > 3
                      return (
                        <div className={styles.mailPreview}>
                          {record.mail.format === "email" && record.mail.subject && (
                            <div className={styles.mailPreviewSubject}>件名: {record.mail.subject}</div>
                          )}
                          <div className={isExpanded ? styles.mailPreviewBodyFull : styles.mailPreviewBody}>
                            {isExpanded ? record.mail.body : preview}
                          </div>
                          <div className={styles.mailPreviewActions}>
                            {hasMore && (
                              <button
                                className={styles.btnExpandMail}
                                onClick={() => setExpandedMail(prev => {
                                  const next = new Set(prev)
                                  isExpanded ? next.delete(record.id) : next.add(record.id)
                                  return next
                                })}
                              >
                                {isExpanded ? "閉じる ▲" : "全文を見る ▼"}
                              </button>
                            )}
                            <button
                              className={`${styles.btnRecopy} ${recopyToast === record.id ? styles.btnRecopyDone : ""}`}
                              onClick={() => handleRecopy(record)}
                            >
                              <Copy size={12} />
                              {recopyToast === record.id ? "コピーしました！" : "もう一度コピー"}
                            </button>
                            {typeof navigator !== "undefined" && "share" in navigator && record.mail && (
                              <button
                                className={styles.btnRecopy}
                                onClick={() => {
                                  const text = record.mail!.format === "email" && record.mail!.subject
                                    ? `${record.mail!.subject}\n\n${record.mail!.body}`
                                    : record.mail!.body
                                  navigator.share({ text, title: record.request?.title })
                                }}
                              >
                                <Share2 size={12} />
                                送る
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 削除トースト */}
      {deletedTitle && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "var(--text-primary)", color: "white",
          padding: "12px 20px", borderRadius: 16,
          fontWeight: 700, fontSize: "0.875rem",
          boxShadow: "0 4px 20px rgba(74, 55, 40, 0.25)",
          display: "flex", alignItems: "center", gap: 8,
          zIndex: 1000, animation: "slideIn 0.25s ease forwards",
        }}>
          🗑️ 「{deletedTitle}」を削除しました
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteConfirm && (
        <div className={styles.dialogOverlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.dialogText}>この相談を削除しますか？</p>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={() => setDeleteConfirm(null)}>
                キャンセル
              </button>
              <button
                className={styles.btnConfirmDelete}
                onClick={() => handleDelete(deleteConfirm)}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日程変更確認ダイアログ */}
      {resetConfirm && (
        <div className={styles.dialogOverlay} onClick={() => setResetConfirm(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.dialogText}>確定済みの日程を変更しますか？</p>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", textAlign: "center", marginBottom: 20 }}>
              相手への確定リンクは無効になります。<br />新しい候補を選んでメッセージを送り直してください。
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={() => setResetConfirm(null)}>
                キャンセル
              </button>
              <button
                className={styles.btnConfirmReset}
                onClick={() => handleResetConfirmed(resetConfirm)}
              >
                変更する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
