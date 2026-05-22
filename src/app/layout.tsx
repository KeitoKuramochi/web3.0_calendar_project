import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar/Navbar";

export const metadata: Metadata = {
  title: "SyncMatch AI - 相談マッチング・日程調整AI",
  description: "大学内・組織内での面談・相談の日程調整をAIでスマートに支援するアプリ。プライバシーに配慮した日程スコアリングと丁寧なメール生成をサポート。",
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="ja">
      <body>
        <Navbar />
        <main style={{ flex: 1, padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
