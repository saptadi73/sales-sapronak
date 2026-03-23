import type {
  ApiResponse,
  CustomerAccountingSummaryData,
  CustomerDetailData,
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
  payload: { search?: string; limit?: number; offset?: number } = {},
) {
  return postJsonRpc<{ items: ProductItem[]; count: number }>(baseUrl, '/api/sales/products', {
    search: payload.search ?? '',
    limit: payload.limit ?? 50,
    offset: payload.offset ?? 0,
  })
}

export function getPaymentTerms(baseUrl: string) {
  return postJsonRpc<{ items: PaymentTermItem[] }>(baseUrl, '/api/sales/payment-terms', {})
}

export function getOrderTypes(baseUrl: string) {
  return getJson<{ items: OrderTypeItem[] }>(baseUrl, '/api/sales/order-types')
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
