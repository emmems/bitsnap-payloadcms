import type { Endpoint, PayloadRequest } from 'payload'

import type { BitsnapAccessArgs, SanitizedBitsnapPluginConfig } from '../types.js'
import { type BitsnapServerClient, createBitsnapServerClient } from './client.js'
import { bitsnapErrorResponse, zodErrorResponse } from './errors.js'
import {
  bitsnapListProductsQuerySchema,
  bitsnapUpdateSchema,
  createBitsnapCreateSchema,
} from './schemas.js'

type RequestWithParams = PayloadRequest & {
  params?: {
    id?: unknown
  }
}

type BodyResult =
  | {
      ok: true
      data: unknown
    }
  | {
      ok: false
    }

function unauthorized(): Response {
  return Response.json({ error: 'Brak autoryzacji' }, { status: 401 })
}

function forbidden(): Response {
  return Response.json({ error: 'Brak uprawnień' }, { status: 403 })
}

function invalidBody(): Response {
  return Response.json({ error: 'Nieprawidłowe dane żądania' }, { status: 400 })
}

function missingApiKey(): Response {
  return Response.json({ error: 'Brak klucza API Bitsnap' }, { status: 500 })
}

function hasParams(req: PayloadRequest): req is RequestWithParams {
  return 'params' in req
}

/**
 * Default access control for Bitsnap endpoints:
 * requires an authenticated user belonging to the Payload admin user collection.
 */
export function defaultBitsnapAccess({ req }: BitsnapAccessArgs): boolean {
  if (!req.user) {
    return false
  }

  const adminUserCollection = req.payload?.config?.admin?.user
  if (!adminUserCollection) {
    return false
  }

  return req.user.collection === adminUserCollection
}

async function authorize(
  req: PayloadRequest,
  config: SanitizedBitsnapPluginConfig,
): Promise<Response | null> {
  if (config.access) {
    const allowed = await config.access({ req })
    if (!allowed) {
      return req.user ? forbidden() : unauthorized()
    }
    return null
  }

  if (!req.user) {
    return unauthorized()
  }

  if (!defaultBitsnapAccess({ req })) {
    return forbidden()
  }

  return null
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

function getQueryObject(req: PayloadRequest): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (req.searchParams instanceof URLSearchParams) {
    for (const [key, value] of req.searchParams.entries()) {
      result[key] = value
    }
    return result
  }

  if (typeof req.url === 'string' && req.url.length > 0) {
    try {
      const parsed = new URL(req.url, 'http://localhost')
      for (const [key, value] of parsed.searchParams.entries()) {
        result[key] = value
      }
      return result
    } catch {
      // fall through to req.query
    }
  }

  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      result[key] = value
    }
  }

  return result
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
export function createBitsnapEndpoints(
  config: SanitizedBitsnapPluginConfig,
  injectedClient?: BitsnapServerClient,
): Endpoint[] {
  const createSchema = createBitsnapCreateSchema(config.currency)

  let memoizedClient: BitsnapServerClient | null = injectedClient ?? null

  const getClient = (): BitsnapServerClient | null => {
    if (memoizedClient) {
      return memoizedClient
    }

    const apiKey = config.bitsnapApiKey || process.env.BITSNAP_API_KEY || ''
    if (apiKey.trim() === '') {
      return null
    }

    memoizedClient = createBitsnapServerClient({
      apiKey,
      host: config.host,
      currency: config.currency,
      fetch: config.fetch,
      timeoutMs: config.timeoutMs,
    })

    return memoizedClient
  }

  const getAccount = async (req: PayloadRequest): Promise<Response> => {
    const denied = await authorize(req, config)
    if (denied) {
      return denied
    }

    const client = getClient()
    if (!client) {
      return missingApiKey()
    }

    try {
      const account = await client.getAccount()
      return Response.json(account)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const createProduct = async (req: PayloadRequest): Promise<Response> => {
    const denied = await authorize(req, config)
    if (denied) {
      return denied
    }

    const client = getClient()
    if (!client) {
      return missingApiKey()
    }

    const body = await readJsonBody(req)
    if (!body.ok) {
      return invalidBody()
    }

    const parsed = createSchema.safeParse(body.data)
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }

    try {
      const result = await client.createProduct(parsed.data)
      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const readProduct = async (req: PayloadRequest): Promise<Response> => {
    const denied = await authorize(req, config)
    if (denied) {
      return denied
    }

    const client = getClient()
    if (!client) {
      return missingApiKey()
    }

    const id = getRouteId(req)
    if (!id) {
      return invalidBody()
    }

    try {
      const product = await client.getProduct(id)
      return Response.json({ product })
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const updateProduct = async (req: PayloadRequest): Promise<Response> => {
    const denied = await authorize(req, config)
    if (denied) {
      return denied
    }

    const client = getClient()
    if (!client) {
      return missingApiKey()
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
      return zodErrorResponse(parsed.error)
    }

    try {
      const result = await client.updateProduct(id, parsed.data)
      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  const listShopProducts = async (req: PayloadRequest): Promise<Response> => {
    const denied = await authorize(req, config)
    if (denied) {
      return denied
    }

    const client = getClient()
    if (!client) {
      return missingApiKey()
    }

    const parsed = bitsnapListProductsQuerySchema.safeParse(getQueryObject(req))
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }

    try {
      const result = await client.listProducts(parsed.data)
      return Response.json(result)
    } catch (error) {
      return bitsnapErrorResponse(error)
    }
  }

  return [
    {
      handler: getAccount,
      method: 'get',
      path: `${config.apiBasePath}/account`,
    },
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
