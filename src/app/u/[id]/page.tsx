"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Mail, ArrowLeft, CalendarPlus, AtSign, MessageCircle, Hash, Globe, ExternalLink, Link2 } from "lucide-react"
import { DUMMY_USERS } from "@/lib/dummyData"
import { UserProfile, ContactMethod, ContactType } from "@/types"
import styles from "./page.module.css"

function getContactUrl(method: ContactMethod): string | null {
  const v = method.value
  switch (method.type) {
    case "twitter": return `https://x.com/${v.replace(/^@/, "")}`
    case "github":  return `https://github.com/${v.replace(/^@/, "")}`
    case "line":    return `line://ti/p/${v}`
    case "custom":  return v.startsWith("http") ? v : null
    default:        return null
  }
}

const CONTACT_ICONS: Record<ContactType, React.ReactNode> = {
  discord: <MessageCircle size={15} />,
  slack:   <Hash size={15} />,
  line:    <MessageCircle size={15} />,
  twitter: <AtSign size={15} />,
  github:  <Link2 size={15} />,
  custom:  <Globe size={15} />,
}

export default function PublicProfilePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // DUMMY_USERS から検索
    const found = DUMMY_USERS.find((u) => u.id === id)
    if (found) { setProfile(found); return }

    // localStorage から検索（ログイン中のユーザー自身）
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith("profile_")) {
        try {
          const parsed: UserProfile = JSON.parse(localStorage.getItem(key)!)
          if (parsed.id === id || id === "me") { setProfile(parsed); return }
        } catch {}
      }
    }

    setNotFound(true)
  }, [id])

  if (notFound) {
    return (
      <div className={styles.centerBox}>
        <p className={styles.notFoundText}>プロフィールが見つかりませんでした</p>
        <button className={styles.btnBack} onClick={() => router.back()}>
          <ArrowLeft size={15} /> 戻る
        </button>
      </div>
    )
  }

  if (!profile) return <div className={styles.centerBox}><p className={styles.loadingText}>読み込み中...</p></div>

  const methods = profile.contactMethods ?? []

  return (
    <div className={styles.wrapper}>
      <button className={styles.btnBack} onClick={() => router.back()}>
        <ArrowLeft size={15} /> 戻る
      </button>

      <div className={`${styles.card} glass-card fade-in`}>
        {/* ヘッダー */}
        <div className={styles.cardHeader}>
          <div className={styles.avatarCircle}>{profile.avatar ?? "👤"}</div>
          <div>
            <h1 className={styles.name}>{profile.name}</h1>
            <p className={styles.role}>{profile.role}</p>
            <p className={styles.dept}>{profile.department}</p>
          </div>
        </div>

        {/* 自己紹介文 */}
        {profile.publicIntro && (
          <div className={styles.intro}>
            <p>{profile.publicIntro}</p>
          </div>
        )}

        {/* 相談できるトピック */}
        {profile.topics.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionLabel}>相談できるトピック</h2>
            <div className={styles.topicList}>
              {profile.topics.map((t) => (
                <span key={t} className={styles.topicChip}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* 連絡先 */}
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>連絡先</h2>
          <div className={styles.contactList}>
            {/* メール（常に表示） */}
            <a href={`mailto:${profile.email}`} className={styles.contactItem}>
              <span className={styles.contactIcon}><Mail size={15} /></span>
              <span className={styles.contactLabel}>メール</span>
              <span className={styles.contactValue}>{profile.email}</span>
              <ExternalLink size={12} className={styles.extIcon} />
            </a>

            {/* 追加の連絡先 */}
            {methods.map((method, i) => {
              const url = getContactUrl(method)
              return url ? (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.contactItem}>
                  <span className={styles.contactIcon}>{CONTACT_ICONS[method.type]}</span>
                  <span className={styles.contactLabel}>{method.label}</span>
                  <span className={styles.contactValue}>{method.value}</span>
                  <ExternalLink size={12} className={styles.extIcon} />
                </a>
              ) : (
                <div key={i} className={`${styles.contactItem} ${styles.contactItemNoLink}`}>
                  <span className={styles.contactIcon}>{CONTACT_ICONS[method.type]}</span>
                  <span className={styles.contactLabel}>{method.label}</span>
                  <span className={styles.contactValue}>{method.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 連絡方針 */}
        {profile.mailPolicy && (
          <div className={styles.section}>
            <h2 className={styles.sectionLabel}>連絡・相談の方針</h2>
            <p className={styles.policy}>{profile.mailPolicy}</p>
          </div>
        )}

        {/* CTA */}
        <div className={styles.cta}>
          <button className={styles.btnRequest} onClick={() => router.push("/request")}>
            <CalendarPlus size={15} />
            この方への相談を作成する
          </button>
        </div>
      </div>
    </div>
  )
}
