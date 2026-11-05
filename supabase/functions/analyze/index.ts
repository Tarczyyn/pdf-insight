// Edge Function "analyze": przyjmuje tekst PDF (i obrazy stron-skanów) z przeglądarki,
// wywołuje Gemini z kluczem trzymanym w secrets i zwraca wynik zwalidowany schematem Zod.
import {
  aiOutputSchema,
  analysisResultSchema,
  analyzeRequestSchema,
  LIMITS,
  type AiOutput,
  type AnalysisResult,
  type AnalyzeRequest,
  type ApiErrorCode,
} from '../_shared/schema.ts'
import { extractNumbers, isValueInText } from '../_shared/numbers.ts'
import { buildDocumentText, RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT } from './prompt.ts'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
const DEFAULT_ORIGINS = [
  'https://tarczyyn.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]
const AI_TIMEOUT_MS = 45_000
const RATE_LIMITS = [
  { name: 'minute', limit: 6, windowSeconds: 60 },
  { name: 'day', limit: 60, windowSeconds: 86_400 },
]

const env = (name: string): string | undefined => Deno.env.get(name)?.trim() || undefined

const allowedOrigins = new Set(
  (env('ALLOWED_ORIGINS')?.split(',') ?? DEFAULT_ORIGINS).map((o) => o.trim()).filter(Boolean),
)
const models =
  env('GEMINI_MODELS')
    ?.split(',')
    .map((m) => m.trim())
    .filter(Boolean) ?? DEFAULT_MODELS

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function errorResponse(e: HttpError, origin: string | null): Response {
  return json({ error: { code: e.code, message: e.message } }, e.status, origin)
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Limit żądań per IP w Postgresie (funkcja check_rate_limit z migracji). IP jest hashowane.
 * Gdy baza nie odpowiada, żądanie przechodzi (fail-open): awaria limitera nie może wyłączyć demo.
 */
async function enforceRateLimit(req: Request): Promise<void> {
  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const ipHash = await sha256(`pdf-insight:${ip}`)
  for (const rule of RATE_LIMITS) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_key: `${rule.name}:${ipHash}`,
          p_limit: rule.limit,
          p_window_seconds: rule.windowSeconds,
        }),
        signal: AbortSignal.timeout(3_000),
      })
      if (!res.ok) {
        console.error('rate limit rpc failed', res.status)
        return
      }
      if ((await res.json()) === false) {
        throw new HttpError(
          429,
          'rate_limited',
          rule.name === 'minute'
            ? 'Za dużo analiz w krótkim czasie. Spróbuj ponownie za minutę.'
            : 'Wykorzystano dzienny limit analiz dla tego adresu. Spróbuj jutro.',
        )
      }
    } catch (e) {
      if (e instanceof HttpError) throw e
      console.error('rate limit unavailable', e)
      return
    }
  }
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
}

/** Jedno wywołanie Gemini z przejściem na kolejny model przy limicie albo awarii dostawcy. */
async function callGemini(parts: GeminiPart[]): Promise<{ text: string; model: string }> {
  const apiKey = env('GEMINI_API_KEY')
  if (!apiKey) throw new HttpError(500, 'internal', 'Serwer nie ma skonfigurowanego klucza AI.')

  let lastStatus = 0
  for (const model of models) {
    let res: Response
    try {
      res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseJsonSchema: RESPONSE_JSON_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'TimeoutError') {
        throw new HttpError(504, 'timeout', 'Analiza trwała zbyt długo. Spróbuj ponownie.')
      }
      console.error('gemini network error', model, e)
      lastStatus = 503
      continue
    }
    if (res.status === 429 || res.status >= 500 || res.status === 404) {
      console.error('gemini unavailable, trying next model', model, res.status, await res.text())
      lastStatus = res.status
      continue
    }
    if (!res.ok) {
      console.error('gemini error', model, res.status, await res.text())
      throw new HttpError(502, 'ai_unavailable', 'Usługa AI odrzuciła żądanie. Spróbuj ponownie.')
    }
    const body = (await res.json()) as GeminiResponse
    if (body.promptFeedback?.blockReason) {
      throw new HttpError(422, 'ai_invalid', 'Usługa AI odmówiła analizy tego dokumentu.')
    }
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
    return { text, model }
  }
  throw new HttpError(
    lastStatus === 429 ? 429 : 503,
    lastStatus === 429 ? 'rate_limited' : 'ai_unavailable',
    lastStatus === 429
      ? 'Wyczerpano limit darmowego API AI. Spróbuj ponownie za kilka minut.'
      : 'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie.',
  )
}

function parseAiOutput(
  text: string,
): { ok: true; data: AiOutput } | { ok: false; problem: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'The answer was not valid JSON.' }
  }
  const parsed = aiOutputSchema.safeParse(raw)
  if (parsed.success) return { ok: true, data: parsed.data }
  const issues = parsed.error.issues
    .slice(0, 10)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
  return { ok: false, problem: issues }
}

/** Wywołanie + walidacja; przy błędnej odpowiedzi dokładnie jedna ponowna próba (wymóg briefu). */
async function analyzeWithRetry(req: AnalyzeRequest): Promise<{ data: AiOutput; model: string }> {
  const parts: GeminiPart[] = [{ text: buildDocumentText(req) }]
  for (const image of req.images) {
    parts.push({ text: `Strona ${image.page} (skan):` })
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } })
  }

  const first = await callGemini(parts)
  const firstParsed = parseAiOutput(first.text)
  if (firstParsed.ok) return { data: firstParsed.data, model: first.model }

  console.error('invalid AI output, retrying', firstParsed.problem)
  const retryParts: GeminiPart[] = [
    ...parts,
    {
      text: `Your previous answer failed validation: ${firstParsed.problem}\nPrevious answer:\n${first.text.slice(0, 4000)}\nReturn the complete corrected JSON.`,
    },
  ]
  const second = await callGemini(retryParts)
  const secondParsed = parseAiOutput(second.text)
  if (secondParsed.ok) return { data: secondParsed.data, model: second.model }

  console.error('invalid AI output after retry', secondParsed.problem)
  throw new HttpError(
    502,
    'ai_invalid',
    'Model AI dwukrotnie zwrócił odpowiedź niezgodną ze schematem. Spróbuj ponownie.',
  )
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function buildResult(req: AnalyzeRequest, ai: AiOutput, model: string): AnalysisResult {
  const numbers = extractNumbers(req.pages.map((p) => p.text).join('\n'))
  const ocrPages = req.images.map((i) => i.page)
  const amounts = dedupe(
    ai.amounts,
    (a) => `${a.value}|${a.currency}|${a.context.toLowerCase()}`,
  ).map((a) => ({ ...a, verified: isValueInText(a.value, numbers) }))
  const warnings = [...ai.warnings]
  if (ocrPages.length > 0) {
    warnings.push(
      `Strony ${ocrPages.join(', ')} nie mają warstwy tekstowej i zostały odczytane z obrazu. Dane z nich warto sprawdzić z oryginałem.`,
    )
  }
  const result: AnalysisResult = {
    document: { fileName: req.fileName, pages: req.pageCount, ...ai.document },
    summary: ai.summary,
    keyPoints: ai.keyPoints,
    entities: {
      organizations: dedupe(ai.entities.organizations, (o) => o.toLowerCase()),
      people: dedupe(ai.entities.people, (p) => p.toLowerCase()),
    },
    amounts,
    dates: dedupe(ai.dates, (d) => `${d.date}|${d.context.toLowerCase()}`),
    keywords: dedupe(ai.keywords, (k) => k.toLowerCase()),
    warnings: dedupe(warnings, (w) => w),
    meta: { model, analyzedAt: new Date().toISOString(), ocrPages, hiddenTextPages: [] },
  }
  return analysisResultSchema.parse(result)
}

async function readRequest(req: Request): Promise<AnalyzeRequest> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > LIMITS.maxRequestBytes) {
    throw new HttpError(413, 'payload_too_large', 'Dokument jest za duży do analizy.')
  }
  const body = await req.text()
  if (body.length > LIMITS.maxRequestBytes) {
    throw new HttpError(413, 'payload_too_large', 'Dokument jest za duży do analizy.')
  }
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new HttpError(400, 'bad_request', 'Niepoprawne żądanie.')
  }
  const parsed = analyzeRequestSchema.safeParse(raw)
  if (!parsed.success) throw new HttpError(400, 'bad_request', 'Niepoprawne żądanie.')
  const chars = parsed.data.pages.reduce((n, p) => n + p.text.length, 0)
  if (chars > LIMITS.maxTextChars) {
    throw new HttpError(413, 'payload_too_large', 'Dokument zawiera za dużo tekstu do analizy.')
  }
  if (chars === 0 && parsed.data.images.length === 0) {
    throw new HttpError(400, 'bad_request', 'Dokument nie zawiera tekstu do analizy.')
  }
  return parsed.data
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (!origin || !allowedOrigins.has(origin)) {
    return errorResponse(
      new HttpError(403, 'forbidden_origin', 'Żądanie z niedozwolonej domeny.'),
      origin,
    )
  }
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') {
    return errorResponse(
      new HttpError(405, 'bad_request', 'Dozwolona jest tylko metoda POST.'),
      origin,
    )
  }

  try {
    await enforceRateLimit(req)
    const input = await readRequest(req)
    const { data, model } = await analyzeWithRetry(input)
    return json(buildResult(input, data, model), 200, origin)
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e, origin)
    console.error('unexpected error', e)
    return errorResponse(
      new HttpError(500, 'internal', 'Wystąpił nieoczekiwany błąd serwera.'),
      origin,
    )
  }
})
