"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, CalendarPlus, CheckSquare } from "lucide-react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
    { href: "/profile", label: "プロフィール", icon: User },
    { href: "/request", label: "相談予約", icon: CalendarPlus },
  ];

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logo}>
        <CheckSquare size={22} className="text-indigo-500" />
        <span>SyncMatch AI</span>
      </Link>
      
      <ul className={styles.navLinks}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          
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
          );
        })}
      </ul>
    </nav>
  );
}
