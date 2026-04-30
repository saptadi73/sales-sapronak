import type {
  ApiResponse,
  CustomerAccountingSummaryData,
  CustomerDetailData,
  DraftOrderBonType,
  CustomerQrPayloadData,
  DraftOrderPayload,
  DraftOrderResult,
  OdooAuthData,
  OrderTypeItem,
  PaymentTermItem,
  ProductItem,
  SalesOrderHistoryItem,
} from '@/types/odoo'

export const ODOO_API_TOAST_EVENT = 'odoo-api-toast'

type ApiToastType = 'network-error' | 'session-expired'

interface ApiToastDetail {
  type: ApiToastType
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function coerceNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function coerceString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function coerceOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function coerceOptionalNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
}

function extractItems(data: unknown) {
  if (Array.isArray(data)) {
    return data
  }

  if (!isRecord(data)) {
    return []
  }

  const candidates = ['items', 'results', 'data', 'records']
  for (const key of candidates) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function extractCount(data: unknown, fallbackCount: number) {
  if (!isRecord(data)) {
    return fallbackCount
  }

  const count = data.count
  return typeof count === 'number' ? count : fallbackCount
}

export interface CorsDebugResult {
  timestamp: string
  appOrigin: string
  requestUrl: string
  method: 'POST'
  credentials: RequestCredentials
  contentType: string
  outcome: 'success' | 'http-error' | 'network-or-cors-error'
  status?: number
  statusText?: string
  responseHeaders?: {
    accessControlAllowOrigin: string | null
    accessControlAllowCredentials: string | null
    accessControlAllowMethods: string | null
    accessControlAllowHeaders: string | null
    vary: string | null
  }
  errorMessage?: string
  hint?: string
}

function emitApiToast(detail: ApiToastDetail) {
  window.dispatchEvent(new CustomEvent<ApiToastDetail>(ODOO_API_TOAST_EVENT, { detail }))
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '')
}

function unwrapApiResponse<T>(payload: unknown): ApiResponse<T> | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const direct = payload as Partial<ApiResponse<T>>
  if (typeof direct.status === 'string') {
    return direct as ApiResponse<T>
  }

  const maybeJsonRpc = payload as { result?: unknown }
  if (maybeJsonRpc.result && typeof maybeJsonRpc.result === 'object') {
    const result = maybeJsonRpc.result as Partial<ApiResponse<T>>
    if (typeof result.status === 'string') {
      return result as ApiResponse<T>
    }
  }

  return null
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  let rawJson: unknown = null

  try {
    rawJson = await response.json()
  } catch {
    rawJson = null
  }

  const json = unwrapApiResponse<T>(rawJson)
  const rawRpcErrorMessage =
    rawJson && typeof rawJson === 'object' && 'error' in rawJson
      ? ((rawJson as { error?: { message?: string } }).error?.message ?? '')
      : ''

  const message =
    json?.message || rawRpcErrorMessage || `Request failed with status ${response.status}`
  const sessionExpired =
    response.status === 401 ||
    response.status === 403 ||
    /session\s*expired|invalid\s*session|unauthori[sz]ed/i.test(message)

  if (!response.ok || json?.status === 'error') {
    if (sessionExpired) {
      emitApiToast({
        type: 'session-expired',
        message: 'Session Odoo berakhir. Silakan login ulang.',
      })
    }

    throw new Error(message)
  }

  if (!json) {
    throw new Error(message)
  }

  return json
}

async function postJsonRpc<T>(baseUrl: string, path: string, params: object) {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    })

    return parseResponse<T>(response)
  } catch (error) {
    if (error instanceof TypeError) {
      emitApiToast({
        type: 'network-error',
        message: 'Koneksi ke server Odoo bermasalah. Periksa internet atau base URL.',
      })
    }

    throw error
  }
}

async function getJson<T>(baseUrl: string, path: string) {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return parseResponse<T>(response)
  } catch (error) {
    if (error instanceof TypeError) {
      emitApiToast({
        type: 'network-error',
        message: 'Koneksi ke server Odoo bermasalah. Periksa internet atau base URL.',
      })
    }

    throw error
  }
}

export function authenticate(
  baseUrl: string,
  payload: { login: string; password: string; db: string },
) {
  return postJsonRpc<OdooAuthData>(baseUrl, '/api/sales/authenticate', payload)
}

export function getProducts(
  baseUrl: string,
  payload: { search?: string; limit?: number; offset?: number; partner_id?: number | null } = {},
) {
  const body: Record<string, unknown> = {
    search: payload.search ?? '',
    limit: payload.limit ?? 50,
    offset: payload.offset ?? 0,
  }

  if (payload.partner_id) {
    body.partner_id = payload.partner_id
  }

  return postJsonRpc<unknown>(baseUrl, '/api/sales/products', body).then((response) => {
    const items = extractItems(response.data)
      .map((item): ProductItem | null => {
        if (!isRecord(item)) {
          return null
        }

        const productId = coerceNumber(item.product_id ?? item.id)
        const name = coerceString(item.name)
        if (!productId || !name) {
          return null
        }

        return {
          product_id: productId,
          default_code: coerceOptionalString(item.default_code),
          name,
          list_price: coerceNumber(item.list_price ?? item.price ?? item.lst_price),
          uom_id: coerceOptionalNumber(item.uom_id),
          uom_name: coerceOptionalString(item.uom_name),
          currency_id: coerceOptionalNumber(item.currency_id),
          currency_name: coerceOptionalString(item.currency_name),
        }
      })
      .filter((item): item is ProductItem => Boolean(item))

    return {
      ...response,
      data: {
        items,
        count: extractCount(response.data, items.length),
      },
    } satisfies ApiResponse<{ items: ProductItem[]; count: number }>
  })
}

export function getPaymentTerms(baseUrl: string) {
  return postJsonRpc<unknown>(baseUrl, '/api/sales/payment-terms', {}).then((response) => {
    const items = extractItems(response.data)
      .map((item) => {
        if (!isRecord(item)) {
          return null
        }

        const paymentTermId = coerceNumber(item.payment_term_id ?? item.id)
        const name = coerceString(item.name)
        if (!paymentTermId || !name) {
          return null
        }

        return {
          payment_term_id: paymentTermId,
          name,
        } satisfies PaymentTermItem
      })
      .filter((item): item is PaymentTermItem => Boolean(item))

    return {
      ...response,
      data: { items },
    } satisfies ApiResponse<{ items: PaymentTermItem[] }>
  })
}

export async function getOrderTypes(baseUrl: string) {
  let response: ApiResponse<unknown>

  try {
    response = await getJson<unknown>(baseUrl, '/api/sales/order-types')
  } catch {
    response = await postJsonRpc<unknown>(baseUrl, '/api/sales/order-types', {})
  }

  const mappedItems = extractItems(response.data)
    .map((item): OrderTypeItem | null => {
      if (typeof item === 'string') {
        const value = item.trim()
        if (!value) {
          return null
        }

        return {
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
        }
      }

      if (!isRecord(item)) {
        return null
      }

      const value = coerceString(
        item.value ?? item.code ?? item.sale_order_type ?? item.id ?? item.key,
      ).trim()
      const label = coerceString(item.label ?? item.name ?? item.display_name, value).trim()
      if (!value) {
        return null
      }

      return {
        value,
        label: label || value,
      } satisfies OrderTypeItem
    })
    .filter((item): item is OrderTypeItem => Boolean(item))

  const dedupedItems = mappedItems.filter(
    (item, index, arr) => arr.findIndex((candidate) => candidate.value === item.value) === index,
  )

  const items =
    dedupedItems.length > 0
      ? dedupedItems
      : [
          { value: 'kering', label: 'Kering' },
          { value: 'basah', label: 'Basah' },
        ]

  return {
    ...response,
    data: { items },
  } satisfies ApiResponse<{ items: OrderTypeItem[] }>
}

export function getCustomerQrPayloadById(
  baseUrl: string,
  payload: { customer_id: number; format?: 'ref' | 'json' },
) {
  return postJsonRpc<CustomerQrPayloadData>(baseUrl, '/api/sales/customer-qr-payload-by-id', {
    customer_id: payload.customer_id,
    format: payload.format ?? 'ref',
  })
}

export function getCustomerQrPayloadByRef(
  baseUrl: string,
  payload: { customer_qr_ref: string; format?: 'ref' | 'json' },
) {
  return postJsonRpc<CustomerQrPayloadData>(baseUrl, '/api/sales/customer-qr-payload-by-ref', {
    customer_qr_ref: payload.customer_qr_ref,
    format: payload.format ?? 'ref',
  })
}

export function getCustomerDetailByQr(baseUrl: string, customerQrRef: string) {
  return postJsonRpc<CustomerDetailData>(baseUrl, '/api/sales/customer-detail-by-qr', {
    customer_qr_ref: customerQrRef,
  })
}

export function getCustomerAccountingSummaryByQr(baseUrl: string, customerQrRef: string) {
  return postJsonRpc<CustomerAccountingSummaryData>(
    baseUrl,
    '/api/sales/customer-accounting-summary-by-qr',
    {
      customer_qr_ref: customerQrRef,
    },
  )
}

export function getOrdersByQr(
  baseUrl: string,
  payload: { customer_qr_ref: string; limit?: number; offset?: number },
) {
  return postJsonRpc<{ items: SalesOrderHistoryItem[]; count: number }>(
    baseUrl,
    '/api/sales/orders-by-qr',
    {
      customer_qr_ref: payload.customer_qr_ref,
      limit: payload.limit ?? 20,
      offset: payload.offset ?? 0,
    },
  )
}

export function createDraftOrder(baseUrl: string, payload: DraftOrderPayload) {
  return postJsonRpc<DraftOrderResult>(baseUrl, '/api/sales/draft-order', payload)
}

export function createDraftOrderByBonType(
  baseUrl: string,
  bonType: DraftOrderBonType,
  payload: DraftOrderPayload,
) {
  return postJsonRpc<DraftOrderResult>(baseUrl, `/api/sales/draft-order/${bonType}`, payload)
}

export async function debugAuthenticateCors(
  baseUrl: string,
  payload: { login?: string; password?: string; db?: string } = {},
): Promise<CorsDebugResult> {
  const requestUrl = `${normalizeBaseUrl(baseUrl)}${'/api/sales/authenticate'}`

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        params: {
          login: payload.login ?? 'debug-user',
          password: payload.password ?? 'debug-password',
          db: payload.db ?? 'debug-db',
        },
      }),
    })

    const result: CorsDebugResult = {
      timestamp: new Date().toISOString(),
      appOrigin: window.location.origin,
      requestUrl,
      method: 'POST',
      credentials: 'include',
      contentType: 'application/json',
      outcome: response.ok ? 'success' : 'http-error',
      status: response.status,
      statusText: response.statusText,
      responseHeaders: {
        accessControlAllowOrigin: response.headers.get('Access-Control-Allow-Origin'),
        accessControlAllowCredentials: response.headers.get('Access-Control-Allow-Credentials'),
        accessControlAllowMethods: response.headers.get('Access-Control-Allow-Methods'),
        accessControlAllowHeaders: response.headers.get('Access-Control-Allow-Headers'),
        vary: response.headers.get('Vary'),
      },
    }

    if (!response.ok) {
      result.hint =
        'Request sampai ke server tapi ditolak (HTTP error). Jika tetap muncul isu CORS, cek konfigurasi Access-Control-Allow-Origin di API/reverse proxy.'
    }

    return result
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      appOrigin: window.location.origin,
      requestUrl,
      method: 'POST',
      credentials: 'include',
      contentType: 'application/json',
      outcome: 'network-or-cors-error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Kemungkinan preflight CORS gagal atau API tidak bisa dijangkau. Pastikan server mengembalikan Access-Control-Allow-Origin untuk origin aplikasi ini.',
    }
  }
}
