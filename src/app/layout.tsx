import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/Navbar/Navbar"
import Providers from "@/components/Providers"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "SyncMatch AI - 相談マッチング・日程調整AI",
  description: "大学内・組織内での面談・相談の日程調整をAIでスマートに支援するアプリ。プライバシーに配慮した日程スコアリングと丁寧なメール生成をサポート。",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html lang="ja">
      <body>
        <Providers session={session}>
          {session && <Navbar />}
          <main style={{ flex: 1, padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
