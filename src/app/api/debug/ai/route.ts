import { NextResponse } from "next/server"

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN = process.env.CLOUDFLARE_AI_API_TOKEN
const MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct"
const MODEL_QUALITY = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"

export async function GET() {
  const hasCredentials = !!(ACCOUNT_ID && API_TOKEN)

  if (!hasCredentials) {
    return NextResponse.json({
      ok: false,
      error: "Cloudflare AI credentials not set (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_API_TOKEN)",
      env: {
        CLOUDFLARE_ACCOUNT_ID: !!ACCOUNT_ID,
        CLOUDFLARE_AI_API_TOKEN: !!API_TOKEN,
      },
    })
  }

  const results: Record<string, unknown> = {
    env: { CLOUDFLARE_ACCOUNT_ID: true, CLOUDFLARE_AI_API_TOKEN: true },
  }

  // fast model test (used for analyzeRecipient)
  const fastStart = Date.now()
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL_FAST}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: 'Return ONLY valid JSON: {"status":"ok","model":"fast"}' }],
          temperature: 0, seed: 42,
        }),
      }
    )
    const data = await res.json() as { result?: { response?: string | object }; success: boolean; errors?: unknown[] }
    const raw = typeof data.result?.response === "string" ? data.result.response : JSON.stringify(data.result?.response ?? "")
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    results.fastModel = {
      ok: res.ok && data.success,
      statusCode: res.status,
      responseMs: Date.now() - fastStart,
      responseType: typeof data.result?.response,
      rawSnippet: raw.slice(0, 200),
      jsonParsed: jsonMatch ? JSON.parse(jsonMatch[0]) : null,
      cfErrors: data.errors,
    }
  } catch (e) {
    results.fastModel = { ok: false, error: String(e), responseMs: Date.now() - fastStart }
  }

  // quality model test (used for generateMail / checkMailWithAI)
  const qualityStart = Date.now()
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL_QUALITY}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: 'Return ONLY valid JSON: {"status":"ok","model":"quality"}' }],
          temperature: 0, seed: 42,
        }),
      }
    )
    const data = await res.json() as { result?: { response?: string | object }; success: boolean; errors?: unknown[] }
    const raw = typeof data.result?.response === "string" ? data.result.response : JSON.stringify(data.result?.response ?? "")
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    results.qualityModel = {
      ok: res.ok && data.success,
      statusCode: res.status,
      responseMs: Date.now() - qualityStart,
      responseType: typeof data.result?.response,
      rawSnippet: raw.slice(0, 200),
      jsonParsed: jsonMatch ? JSON.parse(jsonMatch[0]) : null,
      cfErrors: data.errors,
    }
  } catch (e) {
    results.qualityModel = { ok: false, error: String(e), responseMs: Date.now() - qualityStart }
  }

  return NextResponse.json({ ok: true, ...results })
}
