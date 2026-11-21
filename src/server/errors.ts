import { BitsnapApiError } from 'bitsnap-js/errors'
import { ZodError } from 'zod'

type MappedError = {
  message: string
  status?: number
}

function resolveReason(error: BitsnapApiError): string | undefined {
  const raw = error.reason ?? error.code
  return typeof raw === 'string' && raw.length > 0 ? raw.toLowerCase() : undefined
}

function mapReason(error: BitsnapApiError, reason: string | undefined): MappedError {
  switch (reason) {
    case 'revision_conflict':
      return {
        message: 'Produkt zmienił się w Bitsnapie — kliknij Odśwież',
        status: 409,
      }
    case 'product_not_found':
      return {
        message: 'Nie znaleziono produktu w Bitsnapie',
        status: 404,
      }
    case 'missing_scope':
      return {
        message: 'Klucz API Bitsnapa nie ma uprawnień do zarządzania produktami',
        status: 403,
      }
    case 'writes_disabled':
      return {
        message: 'Klucz API Bitsnapa działa w trybie tylko do odczytu',
        status: 403,
      }
    case 'invalid_request':
      return {
        message: error.detail || 'Nieprawidłowe dane żądania',
        status: 400,
      }
    case 'rate_limited':
      return {
        message: 'Zbyt wiele zapytań do Bitsnapa — spróbuj ponownie za chwilę',
        status: 429,
      }
    case 'unauthorized':
    case 'invalid_api_key':
      return {
        message: 'Nieprawidłowy klucz API Bitsnapa',
        status: 401,
      }
    case 'test_mode_only':
      return {
        message: 'Ta operacja jest dostępna tylko dla klucza testowego',
        status: 403,
      }
    case 'live_mode_only':
      return {
        message: 'Ta operacja jest dostępna tylko dla klucza produkcyjnego',
        status: 403,
      }
    default:
      return {
        message: `Bitsnap odrzucił żądanie (${error.status})`,
      }
  }
}

/**
 * Maps a Bitsnap API error onto the user-facing message shown in the Payload admin.
 */
export function bitsnapErrorMessage(error: BitsnapApiError): string {
  return mapReason(error, resolveReason(error)).message
}

/**
 * Turns a Zod validation error into a 400 JSON response with structured `issues`.
 */
export function zodErrorResponse(error: ZodError): Response {
  return Response.json(
    {
      error: 'Nieprawidłowe dane żądania',
      issues: error.issues,
    },
    { status: 400 },
  )
}

/**
 * Turns any error thrown by the Bitsnap SDK (or Zod validation) into a JSON response.
 */
export function bitsnapErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return zodErrorResponse(error)
  }

  if (error instanceof BitsnapApiError) {
    const reason = resolveReason(error)
    const mapped = mapReason(error, reason)
    const status =
      mapped.status ?? (error.status >= 400 && error.status <= 599 ? error.status : 502)

    const headers: Record<string, string> = {}
    if (reason === 'rate_limited' && error.retryAfter !== undefined) {
      headers['Retry-After'] = String(error.retryAfter)
    }

    return Response.json(
      {
        error: mapped.message,
        code: error.code,
        reason: error.reason,
        requestId: error.requestId,
        ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}),
      },
      { status, headers },
    )
  }

  console.error('Bitsnap request failed:', error)

  return Response.json({ error: 'Nie udało się połączyć z Bitsnapem' }, { status: 502 })
}
