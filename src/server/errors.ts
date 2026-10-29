import { BitsnapApiError } from 'bitsnap-js/errors'

/**
 * Maps a Bitsnap API error onto the message shown in the Payload admin.
 */
export function bitsnapErrorMessage(error: BitsnapApiError): string {
  switch (error.code) {
    case 'REVISION_CONFLICT':
      return 'Produkt zmienił się w Bitsnapie — kliknij Odśwież'
    case 'PRODUCT_NOT_FOUND':
      return 'Nie znaleziono produktu w Bitsnapie'
    case 'MISSING_SCOPE':
      return 'Klucz API Bitsnapa nie ma uprawnień do zarządzania produktami'
    default:
      return `Bitsnap odrzucił żądanie (${error.status})`
  }
}

/**
 * Turns any error thrown by the Bitsnap SDK into a JSON response.
 */
export function bitsnapErrorResponse(error: unknown): Response {
  if (error instanceof BitsnapApiError) {
    return Response.json(
      { error: bitsnapErrorMessage(error), code: error.code },
      { status: error.status },
    )
  }

  console.error('Bitsnap request failed:', error)

  return Response.json({ error: 'Nie udało się połączyć z Bitsnapem' }, { status: 502 })
}
