export type ApiStatus = 'success' | 'error'

export interface ApiResponse<T> {
  status: ApiStatus
  message?: string
  data: T
}

export interface OdooAuthData {
  uid: number
  session_id: string
  db: string
  login: string
  name: string
  partner_id: number
  company_id: number
  company_name: string
}

export interface ProductItem {
  product_id: number
  default_code?: string
  name: string
  list_price: number
  uom_id?: number
  uom_name?: string
  currency_id?: number
  currency_name?: string
}

export interface PaymentTermItem {
  payment_term_id: number
  name: string
}

export interface OrderTypeItem {
  value: 'kering' | 'basah' | string
  label: string
}

export interface CustomerQrPayloadData {
  partner_id: number
  customer_id: number
  name: string
  customer_qr_ref: string
  format: 'ref' | 'json' | string
  qr_content: string
  qr_payload: {
    customer_id: number
    customer_qr_ref: string
    customer_name: string
  }
}

export interface CustomerDetailData {
  partner_id: number
  name: string
  customer_qr_ref: string
  street?: string | null
  street2?: string | null
  city?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  payment_term_id?: number | null
  payment_term_name?: string | null
}

export interface AccountingAging {
  current: number
  '1_30': number
  '31_60': number
  '61_90': number
  over_90: number
}

export interface CustomerAccountingSummaryData {
  partner_id: number
  customer_qr_ref: string
  receivable_total: number
  payable_total: number
  currency: string
  aging_receivable: AccountingAging
  aging_payable: AccountingAging
}

export interface SalesOrderHistoryItem {
  sale_order_id: number
  name: string
  date_order: string
  commitment_date?: string | null
  amount_total: number
  state: string
  approval_state?: string | null
  sale_order_type?: string | null
}

export interface DraftOrderLineInput {
  product_id: number
  product_uom_qty: number
  price_unit?: number
  name?: string
}

export type DraftOrderBonType = 'bon-kering' | 'bon-partus' | 'bon-reguler'

export interface DraftOrderPayload {
  partner_id?: number
  customer_qr_ref?: string
  commitment_date?: string
  sale_order_type?: string
  payment_term_id?: number
  order_line: DraftOrderLineInput[]
}

export interface DraftOrderResult {
  sale_order_id: number
  name: string
  state: string
  amount_total: number
  line_count: number
}
