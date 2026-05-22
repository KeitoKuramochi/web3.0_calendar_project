"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Save, User, Mail, BookOpen, Clock, AlertTriangle, Plus, X } from "lucide-react"
import styles from "./profile.module.css"
import { UserProfile } from "@/types"
import { DUMMY_USERS, POPULAR_TOPICS, POPULAR_ROLES, MAIL_REQUIRED_INFO_OPTIONS } from "@/lib/dummyData"

const DEFAULT_PROFILE: UserProfile = {
  id: "user_default",
  name: "",
  email: "",
  role: "",
  department: "",
  bio: "",
  avatar: "👤",
  topics: [],
  customTopics: "",
  availableTimesFreeText: "",
  avoidTimesFreeText: "",
  absoluteNGTimes: [],
  mailPolicy: "",
  mailRequiredInfo: [],
  customMailRequiredInfo: "",
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? "guest"
  const storageKey = `profile_${userId}`

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [showToast, setShowToast] = useState(false)
  const [customTopicInput, setCustomTopicInput] = useState("")
  const [customMailInput, setCustomMailInput] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setProfile(parsed)
      } catch {}
    } else if (session?.user) {
      // Google から取得した情報をデフォルト値として使う
      setProfile((prev) => ({
        ...prev,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      }))
    }
  }, [storageKey, session])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const toggleTopic = (topic: string) => {
    setProfile((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic],
    }))
  }

  const addCustomTopic = () => {
    const t = customTopicInput.trim()
    if (!t) return
    if (!profile.topics.includes(t)) {
      setProfile((prev) => ({ ...prev, topics: [...prev.topics, t] }))
    }
    setCustomTopicInput("")
  }

  const removeTopic = (topic: string) => {
    setProfile((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }))
  }

  const toggleMailInfo = (info: string) => {
    setProfile((prev) => ({
      ...prev,
      mailRequiredInfo: prev.mailRequiredInfo.includes(info)
        ? prev.mailRequiredInfo.filter((i) => i !== info)
        : [...prev.mailRequiredInfo, info],
    }))
  }

  const addCustomMailInfo = () => {
    const t = customMailInput.trim()
    if (!t) return
    if (!profile.mailRequiredInfo.includes(t)) {
      setProfile((prev) => ({
        ...prev,
        mailRequiredInfo: [...prev.mailRequiredInfo, t],
      }))
    }
    setCustomMailInput("")
  }

  const removeMailInfo = (info: string) => {
    setProfile((prev) => ({
      ...prev,
      mailRequiredInfo: prev.mailRequiredInfo.filter((i) => i !== info),
    }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const toSave = { ...profile, id: userId }
    localStorage.setItem(storageKey, JSON.stringify(toSave))
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const loadDemoUser = (demoUserId: string) => {
    const found = DUMMY_USERS.find((u) => u.id === demoUserId)
    if (found) setProfile(found)
  }

  // POPULAR_TOPICS に含まれないカスタムトピックのみ表示
  const customOnlyTopics = profile.topics.filter((t) => !POPULAR_TOPICS.includes(t))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>プロフィール設定</h1>
        <p>あなたの予定感や連絡方針を登録すると、AIが日程調整とメール作成を最適化します。自由に書けます。</p>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>デモデータ:</span>
        {DUMMY_USERS.slice(1).map((u) => (
          <button key={u.id} type="button" onClick={() => loadDemoUser(u.id)} className={styles.infoTagButton}>
            {u.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="glass-card fade-in">
        <div className={styles.formGrid}>

          {/* 名前 */}
          <div className={styles.formGroup}>
            <label className={styles.label}><User size={15} />名前</label>
            <input type="text" name="name" value={profile.name} onChange={handleChange} className={styles.input} placeholder="例: 佐藤 拓海" required />
          </div>

          {/* メール */}
          <div className={styles.formGroup}>
            <label className={styles.label}><Mail size={15} />メールアドレス</label>
            <input type="email" name="email" value={profile.email} onChange={handleChange} className={styles.input} placeholder="例: sato@univ.ac.jp" required />
          </div>

          {/* ロール（自由入力 + 人気候補） */}
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
                  onClick={() => setProfile((p) => ({ ...p, role: r }))}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 所属（自由記述） */}
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

          {/* 自由記述（bio） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>自由記述（学年・専門・その他何でも）</label>
            <textarea
              name="bio"
              value={profile.bio ?? ""}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="自由に書いてください。AIがここの内容も参考にして相談先のマッチングや文章生成を行います。"
            />
          </div>

          {/* 相談トピック（タグ + カスタム） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><BookOpen size={15} />相談・対応できる内容（複数選択可）</label>

            <div className={styles.tagGrid}>
              {POPULAR_TOPICS.map((t) => (
                <button key={t} type="button"
                  className={`${styles.tagChip} ${profile.topics.includes(t) ? styles.tagChipActive : ""}`}
                  onClick={() => toggleTopic(t)}>
                  {t}
                </button>
              ))}
            </div>

            {/* カスタムトピック表示 */}
            {customOnlyTopics.length > 0 && (
              <div className={styles.customTagRow}>
                {customOnlyTopics.map((t) => (
                  <span key={t} className={`${styles.tagChip} ${styles.tagChipActive}`}>
                    {t}
                    <button type="button" onClick={() => removeTopic(t)} className={styles.removeBtn}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            <div className={styles.freeInputRow}>
              <input
                type="text"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTopic() } }}
                className={styles.input}
                placeholder="その他のトピックを入力して Enter"
              />
              <button type="button" onClick={addCustomTopic} className={styles.btnAddFree}><Plus size={16} /></button>
            </div>
          </div>

          {/* 会いやすい時間 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><Clock size={15} />会いやすい時間帯（自由記述）</label>
            <textarea
              name="availableTimesFreeText"
              value={profile.availableTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 金曜日の午前中は比較的空いています。平日の夕方16:30以降も対応可能です。"
            />
          </div>

          {/* 避けたい時間 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}><AlertTriangle size={15} />できれば避けたい時間帯（自由記述）</label>
            <textarea
              name="avoidTimesFreeText"
              value={profile.avoidTimesFreeText}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="例: 水曜日は会議が多いためできるだけ避けてください。"
            />
          </div>

          {/* メール方針 */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>連絡・メールに対する基本方針</label>
            <textarea
              name="mailPolicy"
              value={profile.mailPolicy}
              onChange={handleChange}
              className={styles.textarea}
              style={{ minHeight: "70px" }}
              placeholder="例: 事前に具体的な相談テーマと用件を送ってください。メールで済む内容はメールで完結希望。"
            />
          </div>

          {/* メールに入れてほしい情報（タグ + カスタム） */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>面談依頼のメールに含めてほしい情報</label>

            <div className={styles.tagGrid}>
              {MAIL_REQUIRED_INFO_OPTIONS.map((info) => (
                <button key={info} type="button"
                  className={`${styles.tagChip} ${profile.mailRequiredInfo.includes(info) ? styles.tagChipActive : ""}`}
                  onClick={() => toggleMailInfo(info)}>
                  {info}
                </button>
              ))}
            </div>

            {/* カスタム入力済みのもの */}
            {profile.mailRequiredInfo.filter((i) => !MAIL_REQUIRED_INFO_OPTIONS.includes(i)).map((info) => (
              <div key={info} className={styles.customTagRow}>
                <span className={`${styles.tagChip} ${styles.tagChipActive}`}>
                  {info}
                  <button type="button" onClick={() => removeMailInfo(info)} className={styles.removeBtn}><X size={11} /></button>
                </span>
              </div>
            ))}

            <div className={styles.freeInputRow}>
              <input
                type="text"
                value={customMailInput}
                onChange={(e) => setCustomMailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMailInfo() } }}
                className={styles.input}
                placeholder="その他（例: 研究テーマの概要）を入力して Enter"
              />
              <button type="button" onClick={addCustomMailInfo} className={styles.btnAddFree}><Plus size={16} /></button>
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.btnSave}>
            <Save size={16} />
            設定を保存
          </button>
        </div>
      </form>

      {showToast && (
        <div className={styles.toast}>
          <span>✓ プロフィールを保存しました</span>
        </div>
      )}
    </div>
  )
}
