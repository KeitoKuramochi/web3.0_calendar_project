import Anthropic from "@anthropic-ai/sdk"

// APIキー未設定の場合は null（フォールバックでモック関数を使用）
export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null
