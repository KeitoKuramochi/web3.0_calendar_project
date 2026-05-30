"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Save, User, Mail, BookOpen, CheckCircle2, Loader } from "lucide-react"
import styles from "./profile.module.css"
import { UserProfile } from "@/types"
import { POPULAR_ROLES } from "@/lib/dummyData"

const DEFAULT_PROFILE: UserProfile = {
  id: "user_default",
  name: "",
  email: "",
  role: "",
  department: "",
  bio: "",
  publicIntro: "",
  avatar: "👤",
  topics: [],
  customTopics: "",
  contactMethods: [],
  availableTimesFreeText: "",
  avoidTimesFreeText: "",
  absoluteNGTimes: [],
  mailPolicy: "",
  mailRequiredInfo: [],
  customMailRequiredInfo: "",
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const userEditedRef = useRef(false)

  const markEdited = () => { userEditedRef.current = true }

  useEffect(() => {
    fetch("/api/profile").then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        if (data) { setProfile(data); return }
      }
      if (session?.user) {
        setProfile((prev) => ({
          ...prev,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        }))
      }
    })
  }, [session])

  useEffect(() => {
    if (!userEditedRef.current) return
    setSaveStatus("unsaved")
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      setSaveStatus("saved")
    }, 1500)
    return () => clearTimeout(timerRef.current)
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    markEdited()
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const loadPreset = () => {
    markEdited()
    setProfile((prev) => ({
      ...prev,
      name: prev.name || "佐藤 拓海",
      email: prev.email || "sato@example.ac.jp",
      role: "学部生",
      department: "情報工学科3年",
      bio: "情報工学科3年生。就活・研究室選び・履修について相談したい。",
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    clearTimeout(timerRef.current)
    setSaveStatus("saving")
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
    setSaveStatus("saved")
    router.push("/")
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>プロフィール設定</h1>
        <p>名前・所属を登録すると、AIが生成するメッセージの精度が上がります。</p>
      </div>

      <div style={{ textAlign: "right", marginBottom: 8 }}>
        <button type="button" onClick={loadPreset} style={{
          fontSize: "0.8rem", fontWeight: 600, color: "var(--color-primary)",
          background: "none", border: "1.5px solid var(--color-primary)",
          borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit",
        }}>
          サンプルを入力してみる
        </button>
      </div>

      {!profile.name && saveStatus === "idle" && (
        <div style={{
          padding: "11px 16px", background: "var(--color-secondary-bg)",
          border: "2px solid rgba(245, 200, 74, 0.3)", borderRadius: 14,
          fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>🌱</span>
          まだプロフィールが設定されていません。名前とメールアドレスだけでも入力すると、メッセージ生成の精度が上がります。
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card fade-in">
        <div className={styles.formGrid}>

          {/* ── 基本情報 ── */}
          <div className={styles.formSectionHeader}>
            <User size={15} /><span>基本情報</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}><User size={15} />名前</label>
            <input type="text" name="name" value={profile.name} onChange={handleChange} className={styles.input} placeholder="例: 佐藤 拓海" required />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}><Mail size={15} />メールアドレス</label>
            <input type="email" name="email" value={profile.email} onChange={handleChange} className={styles.input} placeholder="例: sato@univ.ac.jp" required />
          </div>

          {/* ── 役割・所属 ── */}
          <div className={styles.formSectionHeader}>
            <BookOpen size={15} /><span>役割・所属</span>
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.label}>ロール・役割</label>
            <input
              type="text"
              name="role"
              value={profile.role}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 学部生、大学院生、研究室教員、TA、サークル代表…"
            />
            <div className={styles.suggestRow}>
              {POPULAR_ROLES.map((r) => (
                <button key={r} type="button"
                  className={`${styles.suggestChip} ${profile.role === r ? styles.suggestChipActive : ""}`}
                  onClick={() => { markEdited(); setProfile((p) => ({ ...p, role: r })) }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.label}>所属・部署・学科など（自由記述）</label>
            <input
              type="text"
              name="department"
              value={profile.department}
              onChange={handleChange}
              className={styles.input}
              placeholder="例: 情報工学科3年、計算機アーキテクチャ研究室、学生支援本部…"
            />
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.label}>自由記述（学年・専門・その他何でも）</label>
            <textarea
              name="bio"
              value={profile.bio ?? ""}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="自由に書いてください。AIがここの内容も参考にしてメッセージ生成を行います。"
            />
          </div>

        </div>

        <div className={styles.footer}>
          <span className={styles.saveStatus}>
            {saveStatus === "saving" && (
              <><Loader size={14} className={styles.spinIcon} />保存中…</>
            )}
            {saveStatus === "saved" && (
              <><CheckCircle2 size={14} style={{ color: "var(--color-excellent)" }} />保存済み</>
            )}
            {saveStatus === "unsaved" && (
              <span style={{ color: "var(--color-fair)" }}>未保存の変更があります</span>
            )}
          </span>
          <button type="submit" className={styles.btnSave}>
            <Save size={16} />
            今すぐ保存
          </button>
        </div>
      </form>
    </div>
  )
}
