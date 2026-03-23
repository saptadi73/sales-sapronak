export function extractCustomerQrRef(rawValue: string): string {
  const value = rawValue.trim()

  if (!value) {
    return ''
  }

  try {
    const parsed = JSON.parse(value) as {
      customer_qr_ref?: string
      qr_payload?: { customer_qr_ref?: string }
    }

    if (parsed.customer_qr_ref) {
      return parsed.customer_qr_ref
    }

    if (parsed.qr_payload?.customer_qr_ref) {
      return parsed.qr_payload.customer_qr_ref
    }
  } catch {
    return value
  }

  return value
}

export function toOdooDateTime(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) {
    return ''
  }

  const normalized = datetimeLocalValue.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

export function formatCurrency(value: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}
