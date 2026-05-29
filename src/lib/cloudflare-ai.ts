const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN = process.env.CLOUDFLARE_AI_API_TOKEN

// 認証情報が未設定の場合は false → 各 Server Action でモックにフォールバック
export const hasCloudflareAI = !!(ACCOUNT_ID && API_TOKEN)

export async function callCloudflareAI(
  model: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  maxTokens = 1024
): Promise<string> {
  if (!ACCOUNT_ID || !API_TOKEN) throw new Error("Cloudflare AI credentials not set")

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, temperature: 0, seed: 42, max_tokens: maxTokens }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cloudflare AI error ${res.status}: ${err}`)
  }

  const data = await res.json() as { result?: { response?: string | object }; success: boolean }
  if (!data.success || !data.result?.response) {
    throw new Error("Cloudflare AI returned empty response")
  }

  const response = data.result.response
  // llama-3.3-70b など一部モデルは JSON をオブジェクトのまま返す
  if (typeof response === "string") return response
  return JSON.stringify(response)
}
