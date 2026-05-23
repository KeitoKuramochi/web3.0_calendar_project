import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/Navbar/Navbar"
import Providers from "@/components/Providers"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "TaskelTaskal - 助ける、助かる",
  description: "相手のプライバシーに配慮した日程調整と丁寧なメッセージ作成を手伝います。大学・組織内での相談・面談をスムーズに。",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers session={session}>
          {session && <Navbar />}
          <main style={{ flex: 1, padding: "36px 20px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
