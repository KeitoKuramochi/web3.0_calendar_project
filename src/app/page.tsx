"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Plus, ArrowRight, Clock, CheckCircle2, Trash2, User, CalendarDays } from "lucide-react"
import styles from "./page.module.css"
import { getConsultations, deleteConsultation, setActiveId, clearActiveId } from "@/lib/storage"
import type { ConsultationRecord, ConsultationStatus } from "@/types"
import { DUMMY_USERS } from "@/lib/dummyData"

const STATUS_META: Record<ConsultationStatus, { label: string; nextPath: string; actionLabel: string }> = {
  draft:    { label: "下書き",          nextPath: "/match", actionLabel: "相談先を探す" },
  matched:  { label: "日程候補あり",    nextPath: "/mail",  actionLabel: "メッセージを作成" },
  composed: { label: "メッセージ完成",  nextPath: "/mail",  actionLabel: "メッセージを確認" },
  sent:     { label: "送信済み",        nextPath: "/",      actionLabel: "" },
}

export default function Home() {
  const { data: session } = useSession()
  const router = useRouter()
  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    setRecords(getConsultations())
  }, [])

  const handleResume = (record: ConsultationRecord) => {
    setActiveId(record.id)
    router.push(STATUS_META[record.status].nextPath)
  }

  const handleNewRequest = () => {
    clearActiveId()
    router.push("/request")
  }

  const handleDelete = (id: string) => {
    deleteConsultation(id)
    setRecords(getConsultations())
    setDeleteConfirm(null)
  }

  const getTargetUser = (record: ConsultationRecord) =>
    record.match ? DUMMY_USERS.find((u) => u.id === record.match!.targetUserId) : null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  const active = records.filter((r) => r.status !== "sent")
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
              const target = getTargetUser(record)
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
                      {target && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {target.name}
                        </span>
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

      {/* プロフィール設定カード */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <User size={16} />
          設定
        </h2>
        <Link href="/profile" className={`${styles.quickCard} glass-card`}>
          <div className={styles.quickCardIcon}>
            <User size={20} />
          </div>
          <div className={styles.quickCardBody}>
            <div className={styles.quickCardTitle}>プロフィール設定</div>
            <div className={styles.quickCardDesc}>
              名前・空き時間・連絡方針を登録するとより精度の高いメッセージが生成されます
            </div>
          </div>
          <ArrowRight size={16} className={styles.quickCardArrow} />
        </Link>
      </section>

      {/* 送信済み */}
      {sent.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <CheckCircle2 size={16} />
            送信済みの相談
          </h2>
          <div className={styles.cardList}>
            {sent.map((record) => {
              const target = getTargetUser(record)
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
                      {target && (
                        <span className={styles.consultMetaItem}>
                          <User size={13} />
                          {target.name}
                        </span>
                      )}
                      <span className={styles.consultMetaItem}>
                        <CalendarDays size={13} />
                        {formatDate(record.updatedAt)}送信
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
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
    </div>
  )
}
