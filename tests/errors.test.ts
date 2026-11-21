import { BitsnapApiError } from 'bitsnap-js/errors'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bitsnapErrorMessage, bitsnapErrorResponse } from '../src/server/errors.js'

describe('bitsnapErrorResponse', () => {
  const cases: Array<{
    reason: string
    expectedStatus: number
    detail?: string
    retryAfter?: number
  }> = [
    { reason: 'revision_conflict', expectedStatus: 409 },
    { reason: 'product_not_found', expectedStatus: 404 },
    { reason: 'missing_scope', expectedStatus: 403 },
    { reason: 'writes_disabled', expectedStatus: 403 },
    { reason: 'invalid_request', expectedStatus: 400, detail: 'price.currency is invalid' },
    { reason: 'rate_limited', expectedStatus: 429, retryAfter: 12 },
    { reason: 'unauthorized', expectedStatus: 401 },
    { reason: 'invalid_api_key', expectedStatus: 401 },
    { reason: 'test_mode_only', expectedStatus: 403 },
    { reason: 'live_mode_only', expectedStatus: 403 },
  ]

  for (const testCase of cases) {
    it(`maps BitsnapApiError reason "${testCase.reason}" to HTTP ${testCase.expectedStatus}`, async () => {
      const error = new BitsnapApiError({
        status: testCase.expectedStatus,
        body: {},
        reason: testCase.reason,
        requestId: 'req_abc123',
        detail: testCase.detail,
        retryAfter: testCase.retryAfter,
      })

      const response = bitsnapErrorResponse(error)
      expect(response.status).toBe(testCase.expectedStatus)

      if (testCase.retryAfter !== undefined) {
        expect(response.headers.get('Retry-After')).toBe(String(testCase.retryAfter))
      }

      const json = (await response.json()) as Record<string, unknown>
      expect(json.error).toBe(bitsnapErrorMessage(error))
      expect(json.reason).toBe(testCase.reason)
      expect(json.requestId).toBe('req_abc123')
      if (testCase.detail) {
        expect(json.error).toBe(testCase.detail)
      }
      if (testCase.retryAfter !== undefined) {
        expect(json.retryAfter).toBe(testCase.retryAfter)
      }
    })
  }

  it('returns 400 with issues array for ZodError', async () => {
    const schema = z.object({ name: z.string().min(1) })
    const parsed = schema.safeParse({ name: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    const response = bitsnapErrorResponse(parsed.error)
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string; issues: unknown[] }
    expect(Array.isArray(json.issues)).toBe(true)
    expect(json.issues.length).toBeGreaterThan(0)
  })

  it('returns 502 for unexpected non-SDK errors', async () => {
    const response = bitsnapErrorResponse(new Error('network down'))
    expect(response.status).toBe(502)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBeTruthy()
  })
})
