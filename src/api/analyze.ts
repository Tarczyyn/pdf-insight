import type { AnalyzeRequest, ApiErrorBody } from '@shared/schema.ts'

const API_URL = import.meta.env.VITE_API_URL
const CLIENT_TIMEOUT_MS = 90_000

export class ApiError extends Error {
  readonly userMessage: string
  readonly retryable: boolean
  constructor(userMessage: string, retryable = true) {
    super(userMessage)
    this.name = 'ApiError'
    this.userMessage = userMessage
    this.retryable = retryable
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'message' in error
}

/** Wysyła wyciągnięty tekst do Edge Function. Zwraca surowy JSON; walidacja jest w warstwie wyżej. */
export async function requestAnalysis(
  payload: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!API_URL) {
    throw new ApiError('Brak adresu API (VITE_API_URL). To błąd konfiguracji aplikacji.', false)
  }
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('Serwer nie odpowiedział na czas. Spróbuj ponownie.')
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.')
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = isApiErrorBody(body)
      ? body.error.message
      : `Serwer zwrócił błąd (${res.status}). Spróbuj ponownie.`
    throw new ApiError(message, res.status !== 400 && res.status !== 413)
  }
  return body
}
