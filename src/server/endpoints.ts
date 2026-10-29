import type { Endpoint, PayloadRequest } from 'payload'

import type { SanitizedBitsnapPluginConfig } from '../types.js'
import {
  configureBitsnapBackend,
  createManagedProduct,
  getManagedProduct,
  getShopProducts,
  isBitsnapApiKeyConfigured,
  updateManagedProduct,
} from './client.js'
import { bitsnapErrorResponse } from './errors.js'
import { bitsnapCreateSchema, bitsnapUpdateSchema, setBitsnapCurrency } from './schemas.js'

type RequestWithParams = PayloadRequest & {
  params?: {
    id?: unknown
  }
}

type BodyResult = {
  ok: true
  data: unknown
} | {
  ok: false
}

function unauthorized(): Response {
  return Response.json({ error: 'Brak autoryzacji' }, { status: 401 })
}

function invalidBody(): Response {
  return Response.json({ error: 'Nieprawidłowe dane żądania' }, { status: 400 })
}

function missingProject(): Response {
  return Response.json({ error: 'Brak identyfikatora projektu Bitsnap' }, { status: 500 })
}

function hasParams(req: PayloadRequest): req is RequestWithParams {
  return 'params' in req
}

/**
 * Reads the product id from the matched route. Payload puts path params into
 * `req.routeParams`; `req.params` is accepted as a fallback.
 */
function getRouteId(req: PayloadRequest): string | null {
  const fromRouteParams = req.routeParams?.id
  if (typeof fromRouteParams === 'string' && fromRouteParams.length > 0) {
    return fromRouteParams
  }

  if (hasParams(req)) {
    const fromParams = req.params?.id
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams
    }
  }

  return null
}

async function readJsonBody(req: PayloadRequest): Promise<BodyResult> {
  if (typeof req.json !== 'function') {
    return { ok: false }
  }

  try {
    const data = await req.json()

    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

/**
 * Builds the REST endpoints the admin UI talks to.
 *
 * They are mounted relative to Payload's API root, so with the default
 * `apiBasePath` they are served at `/api/bitsnap/...`.
 */
export function createBitsnapEndpoints(config: SanitizedBitsnapPluginConfig): Endpoint[] {
  setBitsnapCurrency(config.currency)

  const createProduct = async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return unauthorized()
    }

    if (!config.projectId) {
      return missingProject()
    }

    const body = await readJsonBody(req)
    if (!body.ok) {
      return invalidBody()
    }

    const parsed = bitsnapCreateSchema.safeParse(body.data)
    if (!parsed.success) {
      return invalidBody()
    }

    try {
      configureBitsnapBackend({ apiKey: config.bitsnapApiKey })

      const result = await createManagedProduct(config.projectId, parsed.data)

      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const readProduct = async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return unauthorized()
    }

    if (!config.projectId) {
      return missingProject()
    }

    const id = getRouteId(req)
    if (!id) {
      return invalidBody()
    }

    try {
      configureBitsnapBackend({ apiKey: config.bitsnapApiKey })

      const product = await getManagedProduct(config.projectId, id)

      return Response.json({ product })
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const updateProduct = async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return unauthorized()
    }

    if (!config.projectId) {
      return missingProject()
    }

    const id = getRouteId(req)
    if (!id) {
      return invalidBody()
    }

    const body = await readJsonBody(req)
    if (!body.ok) {
      return invalidBody()
    }

    const parsed = bitsnapUpdateSchema.safeParse(body.data)
    if (!parsed.success) {
      return invalidBody()
    }

    try {
      configureBitsnapBackend({ apiKey: config.bitsnapApiKey })

      const result = await updateManagedProduct(config.projectId, id, parsed.data)

      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const listShopProducts = async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return unauthorized()
    }

    if (!config.projectId) {
      return missingProject()
    }

    configureBitsnapBackend({ apiKey: config.bitsnapApiKey })

    if (!isBitsnapApiKeyConfigured()) {
      req.payload.logger.warn(
        'Bitsnap: BITSNAP_API_KEY is not set — the product picker lists published products only',
      )
    }

    try {
      const result = await getShopProducts(config.projectId)

      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  return [
    {
      handler: createProduct,
      method: 'post',
      path: `${config.apiBasePath}/products`,
    },
    {
      handler: readProduct,
      method: 'get',
      path: `${config.apiBasePath}/products/:id`,
    },
    {
      handler: updateProduct,
      method: 'patch',
      path: `${config.apiBasePath}/products/:id`,
    },
    {
      handler: listShopProducts,
      method: 'get',
      path: `${config.apiBasePath}/shop-products`,
    },
  ]
}
