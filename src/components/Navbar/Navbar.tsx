"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { LayoutDashboard, User, CalendarPlus, CalendarCheck, LogOut } from "lucide-react"
import styles from "./Navbar.module.css"

export default function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const links = [
    { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
    { href: "/profile", label: "プロフィール", icon: User },
    { href: "/request", label: "相談予約", icon: CalendarPlus },
  ]

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        <CalendarCheck size={22} />
        <span>SyncMatch AI</span>
      </Link>

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

      <div className={styles.userArea}>
        {session?.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? "user"}
            className={styles.avatar}
          />
        )}
        <span className={styles.userName}>{session?.user?.name}</span>
        <button
          className={styles.btnLogout}
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="ログアウト"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  )
}
