"use client"

import { signIn } from "next-auth/react"
import { CalendarDays, Mail, CheckCircle2, ArrowRight, Clock, MapPin, User, Zap, Link2, MessageSquare } from "lucide-react"
import styles from "./login.module.css"

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

function StepCard({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepNum}>{n}</div>
      <div className={styles.stepIcon}>{icon}</div>
      <div className={styles.stepTitle}>{title}</div>
      <div className={styles.stepDesc}>{desc}</div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <div className={styles.featureTitle}>{title}</div>
      <div className={styles.featureDesc}>{desc}</div>
    </div>
  )
}

export default function LoginPage() {
  const handleLogin = () => signIn("google", { callbackUrl: "/" })

  return (
    <div className={styles.page}>

      {/* ── Navbar ─────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>TaskelTaskal</div>
        <button className={styles.btnNavLogin} onClick={handleLogin}>
          ログイン
        </button>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>🗓️ 日程調整をもっとシンプルに</div>
        <h1 className={styles.heroTitle}>
          ミーティングの依頼が<br />
          <span className={styles.heroAccent}>リンク1つ</span>で完結する
        </h1>
        <p className={styles.heroDesc}>
          丁寧なメールを書いて・候補を提案して・返信を待って・また調整して…<br />
          そのすべてをまとめて解決します。
        </p>
        <button className={styles.btnHeroLogin} onClick={handleLogin}>
          <GoogleIcon />
          Googleでログインして始める（無料）
        </button>
        <p className={styles.heroNote}>アカウント登録不要・Googleログインのみ</p>
      </section>

      {/* ── Flow ───────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>使い方</div>
        <h2 className={styles.sectionTitle}>こんな流れで使います</h2>

        {/* 送る側 */}
        <div className={styles.flowSide}>
          <div className={styles.flowSideLabel}>
            <User size={14} />
            送る側（あなた）
          </div>
          <div className={styles.flowSteps}>
            <StepCard
              n={1}
              icon={<MessageSquare size={20} />}
              title="相談内容を入力"
              desc="テーマ・所要時間・形式と、相手の名前・役職を入力するだけ"
            />
            <div className={styles.flowArrow}><ArrowRight size={18} /></div>
            <StepCard
              n={2}
              icon={<CalendarDays size={20} />}
              title="日程をスコアリング"
              desc="相手の役職から「教授は木曜午後が◎」など候補を自動採点"
            />
            <div className={styles.flowArrow}><ArrowRight size={18} /></div>
            <StepCard
              n={3}
              icon={<Mail size={20} />}
              title="メッセージを生成"
              desc="メール・Slack・LINE・Discordに合わせた文面を自動作成"
            />
          </div>
        </div>

        {/* 中継ブリッジ */}
        <div className={styles.flowBridge}>
          <div className={styles.flowBridgeLine} />
          <div className={styles.flowBridgeText}>
            <Link2 size={14} />
            コピーして送信 → メール本文に確定リンクが自動挿入されます
          </div>
          <div className={styles.flowBridgeLine} />
        </div>

        {/* 受け取る側 */}
        <div className={styles.flowSide}>
          <div className={styles.flowSideLabel} style={{ background: "rgba(74,144,226,0.08)", color: "#4a90e2", borderColor: "rgba(74,144,226,0.2)" }}>
            <User size={14} />
            受け取る側（相手）
          </div>
          <div className={styles.flowSteps}>
            <StepCard
              n={4}
              icon={<Link2 size={20} />}
              title="リンクをクリック"
              desc="アカウント登録不要。メール内のリンクを開くだけ"
            />
            <div className={styles.flowArrow}><ArrowRight size={18} /></div>
            <StepCard
              n={5}
              icon={<CheckCircle2 size={20} />}
              title="ボタンを押して確定"
              desc="候補日時の中から都合のよい日時を選ぶだけ。返信メール不要"
            />
          </div>
        </div>

        {/* 結果 */}
        <div className={styles.flowResult}>
          <CheckCircle2 size={18} />
          あなたのダッシュボードに「確定済み」が自動表示されます
        </div>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionLabel}>できること</div>
        <h2 className={styles.sectionTitle}>主な機能</h2>
        <div className={styles.featureGrid}>
          <FeatureCard
            icon={<Zap size={22} />}
            title="役職から空き時間を推測"
            desc="「教授」「TA」「職員」「先輩」などの役職から、一般的に対応しやすい時間帯を自動推測してスコアリングします"
          />
          <FeatureCard
            icon={<Mail size={22} />}
            title="形式を選んで文面を自動生成"
            desc="メール・Slack・LINE・Discord・短文の5形式に対応。相手の役職・連絡方針に合わせた文体で生成します"
          />
          <FeatureCard
            icon={<CheckCircle2 size={22} />}
            title="確定リンクで往復ゼロ"
            desc="相手はアカウント不要。リンクから候補日時を選ぶだけで確定。何度もメールをやり取りしなくて済みます"
          />
          <FeatureCard
            icon={<CalendarDays size={22} />}
            title="全部合わない場合も対応"
            desc="相手が候補日時をすべて断った場合も、代替の日時をテキストで提案できます。その内容があなたに通知されます"
          />
        </div>
      </section>

      {/* ── Profile info ───────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>プロフィール設定</div>
        <h2 className={styles.sectionTitle}>登録すると精度が上がる情報</h2>
        <div className={styles.profileCards}>
          <div className={styles.profileCard}>
            <div className={styles.profileCardTitle}>
              <User size={16} />
              基本情報
            </div>
            <ul className={styles.profileList}>
              <li>名前・表示名</li>
              <li>役割（学部生、教員、社会人など）</li>
              <li>所属（学科・研究室・会社名など）</li>
              <li>自己紹介文（メール文面に使用）</li>
            </ul>
          </div>
          <div className={styles.profileCard}>
            <div className={styles.profileCardTitle}>
              <Clock size={16} />
              スケジュール情報
            </div>
            <ul className={styles.profileList}>
              <li>対応しやすい時間帯</li>
              <li>できれば避けたい時間帯</li>
              <li>絶対NGな時間・曜日</li>
              <li>メールで必須の情報（学籍番号など）</li>
            </ul>
          </div>
          <div className={styles.profileCard}>
            <div className={styles.profileCardTitle}>
              <MapPin size={16} />
              連絡先
            </div>
            <ul className={styles.profileList}>
              <li>メールアドレス</li>
              <li>Slack / Discord / LINE ID（任意）</li>
              <li>希望する連絡方法</li>
            </ul>
          </div>
        </div>
        <p className={styles.profileNote}>※ プロフィールはログイン後にいつでも設定・変更できます。未設定でも使えます。</p>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>今すぐ無料で始める</h2>
        <p className={styles.ctaDesc}>
          Googleアカウントでログインするだけ。<br />
          登録フォームの入力は一切不要です。
        </p>
        <button className={styles.btnCtaLogin} onClick={handleLogin}>
          <GoogleIcon />
          Googleでログインして始める
        </button>
        <p className={styles.ctaNote}>完全無料 · アカウント不要（受け取る側）</p>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>TaskelTaskal</div>
        <p className={styles.footerNote}>© 2026 TaskelTaskal</p>
      </footer>

    </div>
  )
}
