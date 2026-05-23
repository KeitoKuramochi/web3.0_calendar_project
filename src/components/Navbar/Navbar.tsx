"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { LayoutDashboard, User, CalendarPlus, CalendarCheck, LogOut, Menu, X } from "lucide-react"
import styles from "./Navbar.module.css"
import { clearActiveId } from "@/lib/storage"

export default function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
    { href: "/profile", label: "プロフィール", icon: User },
    { href: "/request", label: "相談予約", icon: CalendarPlus },
  ]

  const handleLogout = () => {
    clearActiveId()
    signOut({ callbackUrl: "/login" })
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        <CalendarCheck size={22} />
        <span>Calmo</span>
      </Link>

      {/* デスクトップナビ */}
      <ul className={styles.navLinks}>
        {links.map((link) => {
          const Icon = link.icon
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href))
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.activeLink : ""}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* デスクトップ右側 */}
      <div className={styles.userArea}>
        {session?.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? "user"}
            className={styles.avatar}
          />
        )}
        <span className={styles.userName}>{session?.user?.name}</span>
        <button className={styles.btnLogout} onClick={handleLogout} title="ログアウト">
          <LogOut size={16} />
        </button>
      </div>

      {/* モバイルハンバーガー */}
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="メニュー"
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* モバイルメニュー */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          {links.map((link) => {
            const Icon = link.icon
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`}
                onClick={closeMobile}
              >
                <Icon size={19} />
                <span>{link.label}</span>
              </Link>
            )
          })}
          <div className={styles.mobileDivider} />
          <div className={styles.mobileUserRow}>
            {session?.user?.image && (
              <img src={session.user.image} alt="" className={styles.avatar} />
            )}
            <span className={styles.mobileUserName}>{session?.user?.name}</span>
            <button className={styles.btnLogout} onClick={handleLogout} title="ログアウト">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
