"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, CalendarPlus, ArrowRight, Clock, CalendarOff } from "lucide-react";
import styles from "./page.module.css";

interface RecentData {
  match: { targetUserId: string; selectedTimeSlot: string }
  req: { title: string }
}

export default function Home() {
  const [recentData, setRecentData] = useState<RecentData | null>(null)

  useEffect(() => {
    const savedMatch = localStorage.getItem("consult_match")
    const savedReq = localStorage.getItem("consult_request")
    if (savedMatch && savedReq) {
      try {
        setRecentData({ match: JSON.parse(savedMatch), req: JSON.parse(savedReq) })
      } catch {}
    }
  }, [])

  const hasHistory = recentData !== null

  return (
    <div className={styles.container}>
      {/* 初回のみ表示するウェルカムバナー */}
      {!hasHistory && (
        <div className={styles.welcomeBanner}>
          <span className={styles.welcomeLeaf}>🌿</span>
          <p>プロフィールを設定して、相談リクエストを作成してみましょう</p>
        </div>
      )}

      {/* クイックアクションカード */}
      <section className={styles.grid}>
        <Link href="/profile" className={`${styles.card} glass-card`}>
          <div className={styles.iconWrapper}>
            <User size={24} />
          </div>
          <h2>プロフィール設定</h2>
          <p>
            会いやすい時間帯・避けたい時間・メール方針などを登録します。AIがここの内容を参考にして最適化します。
          </p>
          <div className={styles.cardLink}>
            プロフィールを開く <ArrowRight size={16} />
          </div>
        </Link>

        <Link href="/request" className={`${styles.card} glass-card`}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperSecondary}`}>
            <CalendarPlus size={24} />
          </div>
          <h2>相談リクエスト作成</h2>
          <p>
            「来週くらいに進路相談したい」といった自然な文章を入力するだけで、AIが相談先と日程を絞り込みます。
          </p>
          <div className={styles.cardLink}>
            相談予約を始める <ArrowRight size={16} />
          </div>
        </Link>
      </section>

      {/* 調整状況 */}
      <section className={styles.timelineSection}>
        <h2 className={styles.sectionTitle}>
          <Clock size={18} />
          <span>調整状況</span>
        </h2>

        <div className={styles.timeline}>
          {hasHistory ? (
            <div className={styles.timelineItem} style={{ borderLeft: "4px solid var(--color-secondary)" }}>
              <div className={styles.timelineLeft}>
                <div className={styles.timelineAvatar} style={{ background: "rgba(6, 182, 212, 0.1)" }}>💬</div>
                <div className={styles.timelineInfo}>
                  <h4>{recentData!.req.title}</h4>
                  <p>確定候補: {recentData!.match.selectedTimeSlot}</p>
                </div>
              </div>
              <span className={`${styles.statusBadge} ${styles.statusWait}`}>メール送信待ち</span>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <CalendarOff size={32} className={styles.emptyIcon} />
              <p>まだ調整履歴がありません</p>
              <p className={styles.emptyHint}>「相談リクエスト作成」から始めてみましょう</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
