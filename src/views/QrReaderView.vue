<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import QrScanner from '@/components/QrScanner.vue'
import {
  getCustomerAccountingSummaryByQr,
  getCustomerDetailByQr,
  getOrdersByQr,
} from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'
import type {
  AccountingAging,
  CustomerAccountingSummaryData,
  CustomerDetailData,
  SalesOrderHistoryItem,
} from '@/types/odoo'
import { extractCustomerQrRef, formatCurrency } from '@/utils/qr'

const router = useRouter()
const sessionStore = useSessionStore()

const rawInput = ref('')
const customerQrRef = ref('')
const loading = ref(false)
const errorMessage = ref('')

const customer = ref<CustomerDetailData | null>(null)
const accounting = ref<CustomerAccountingSummaryData | null>(null)
const orders = ref<SalesOrderHistoryItem[]>([])

function resolveAgingAmount(aging: AccountingAging, keys: Array<keyof AccountingAging>) {
  for (const key of keys) {
    const value = aging[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return 0
}

function agingRangeValue(aging: AccountingAging, range: '1-10' | '11-30' | '31-60' | '61-90') {
  if (range === '1-10') {
    return resolveAgingAmount(aging, ['1_10'])
  }

  if (range === '11-30') {
    return resolveAgingAmount(aging, ['10_30', '11_30', '1_30'])
  }

  if (range === '31-60') {
    return resolveAgingAmount(aging, ['30_60', '31_60'])
  }

  return resolveAgingAmount(aging, ['60_90', '61_90'])
}

async function loadByQrRef(qrRef: string) {
  if (!qrRef) {
    errorMessage.value = 'QR customer tidak valid.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  customerQrRef.value = qrRef

  try {
    const [customerResponse, accountingResponse, ordersResponse] = await Promise.all([
      getCustomerDetailByQr(sessionStore.baseUrl, qrRef),
      getCustomerAccountingSummaryByQr(sessionStore.baseUrl, qrRef),
      getOrdersByQr(sessionStore.baseUrl, { customer_qr_ref: qrRef, limit: 20, offset: 0 }),
    ])

    customer.value = customerResponse.data
    accounting.value = accountingResponse.data
    orders.value = ordersResponse.data.items
  } catch (error) {
    customer.value = null
    accounting.value = null
    orders.value = []
    errorMessage.value =
      error instanceof Error ? error.message : 'Gagal memuat data customer dari QR.'
  } finally {
    loading.value = false
  }
}

function onScanDetected(value: string) {
  rawInput.value = value
  const qrRef = extractCustomerQrRef(value)
  loadByQrRef(qrRef)
}

function submitManual() {
  const qrRef = extractCustomerQrRef(rawInput.value)
  loadByQrRef(qrRef)
}

async function goToCreateOrder() {
  if (!customerQrRef.value) {
    return
  }

  await router.push({
    path: '/sales-order',
    query: { qr: customerQrRef.value },
  })
}
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 class="text-xl font-bold text-slate-900">Reader QR Customer</h1>
      <p class="mt-1 text-sm text-slate-600">
        Scan QR untuk membaca customer, posisi hutang/piutang, dan histori sales order.
      </p>
    </div>

    <QrScanner @detected="onScanDetected" />

    <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <label class="block space-y-1">
        <span class="text-sm font-medium text-slate-700">Input manual hasil QR (ref/json)</span>
        <textarea
          v-model="rawInput"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          placeholder="CUSTQR2603-000001 atau payload JSON"
        />
      </label>
      <button
        type="button"
        :disabled="loading"
        class="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        @click="submitManual"
      >
        {{ loading ? 'Memuat...' : 'Ambil Data Customer' }}
      </button>
      <p v-if="errorMessage" class="mt-2 text-sm text-rose-600">{{ errorMessage }}</p>
    </section>

    <section v-if="loading" class="space-y-5">
      <div class="grid gap-5 lg:grid-cols-2">
        <article
          class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div class="h-6 w-40 animate-pulse rounded bg-slate-200"></div>
          <div class="space-y-2">
            <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
            <div class="h-4 w-5/6 animate-pulse rounded bg-slate-100"></div>
            <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100"></div>
          </div>
          <div class="h-10 w-52 animate-pulse rounded-lg bg-slate-200"></div>
        </article>

        <article
          class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div class="h-6 w-52 animate-pulse rounded bg-slate-200"></div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="h-20 animate-pulse rounded-xl bg-slate-100"></div>
            <div class="h-20 animate-pulse rounded-xl bg-slate-100"></div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="h-24 animate-pulse rounded-xl bg-slate-100"></div>
            <div class="h-24 animate-pulse rounded-xl bg-slate-100"></div>
          </div>
        </article>
      </div>

      <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div class="h-6 w-44 animate-pulse rounded bg-slate-200"></div>
        <div class="mt-3 space-y-2">
          <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
          <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
          <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
        </div>
      </article>
    </section>

    <section v-if="customer && accounting" class="grid gap-5 lg:grid-cols-2">
      <article class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900">Detail Customer</h2>
        <div class="space-y-1 text-sm text-slate-700">
          <p><span class="font-medium">Nama:</span> {{ customer.name }}</p>
          <p><span class="font-medium">QR Ref:</span> {{ customer.customer_qr_ref }}</p>
          <p>
            <span class="font-medium">Wilayah Ongkir:</span>
            {{ customer.shipping_wilayah_name || '-' }}
          </p>
          <p><span class="font-medium">Kota:</span> {{ customer.city || '-' }}</p>
          <p>
            <span class="font-medium">Phone:</span> {{ customer.phone || customer.mobile || '-' }}
          </p>
          <p><span class="font-medium">Email:</span> {{ customer.email || '-' }}</p>
          <p>
            <span class="font-medium">Payment Term:</span> {{ customer.payment_term_name || '-' }}
          </p>
        </div>

        <p
          v-if="!customer.shipping_wilayah_id"
          class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          Customer belum memiliki Wilayah Ongkir. Backend akan menolak pembuatan order sampai
          wilayah dilengkapi.
        </p>

        <button
          type="button"
          class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          @click="goToCreateOrder"
        >
          Buat Sales Order dari Customer Ini
        </button>
      </article>

      <article class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900">Posisi Hutang / Piutang</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-emerald-50 p-3">
            <p class="text-xs text-slate-600">Total Piutang</p>
            <p class="text-lg font-bold text-emerald-700">
              {{ formatCurrency(accounting.receivable_total, accounting.currency) }}
            </p>
          </div>
          <div class="rounded-xl bg-amber-50 p-3">
            <p class="text-xs text-slate-600">Total Hutang</p>
            <p class="text-lg font-bold text-amber-700">
              {{ formatCurrency(accounting.payable_total, accounting.currency) }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 class="mb-2 text-sm font-semibold text-slate-800">Aging Piutang</h3>
            <ul class="space-y-1 text-sm text-slate-700">
              <li>
                Current:
                {{ formatCurrency(accounting.aging_receivable.current, accounting.currency) }}
              </li>
              <li>
                1-10:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_receivable, '1-10'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                11-30:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_receivable, '11-30'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                31-60:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_receivable, '31-60'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                61-90:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_receivable, '61-90'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                >90: {{ formatCurrency(accounting.aging_receivable.over_90, accounting.currency) }}
              </li>
            </ul>
          </div>
          <div>
            <h3 class="mb-2 text-sm font-semibold text-slate-800">Aging Hutang</h3>
            <ul class="space-y-1 text-sm text-slate-700">
              <li>
                Current: {{ formatCurrency(accounting.aging_payable.current, accounting.currency) }}
              </li>
              <li>
                1-10:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_payable, '1-10'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                11-30:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_payable, '11-30'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                31-60:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_payable, '31-60'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                61-90:
                {{
                  formatCurrency(
                    agingRangeValue(accounting.aging_payable, '61-90'),
                    accounting.currency,
                  )
                }}
              </li>
              <li>
                >90: {{ formatCurrency(accounting.aging_payable.over_90, accounting.currency) }}
              </li>
            </ul>
          </div>
        </div>
      </article>
    </section>

    <section
      v-if="customer"
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 class="text-lg font-semibold text-slate-900">Histori Sales Order</h2>
      <div class="mt-3 overflow-x-auto">
        <table class="min-w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th class="px-3 py-2">No</th>
              <th class="px-3 py-2">Date Order</th>
              <th class="px-3 py-2">Commitment</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">State</th>
              <th class="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in orders" :key="item.sale_order_id" class="border-b border-slate-100">
              <td class="px-3 py-2 font-medium">{{ item.name }}</td>
              <td class="px-3 py-2">{{ item.date_order }}</td>
              <td class="px-3 py-2">{{ item.commitment_date || '-' }}</td>
              <td class="px-3 py-2">{{ item.sale_order_type || '-' }}</td>
              <td class="px-3 py-2">{{ item.state }}</td>
              <td class="px-3 py-2">
                {{ formatCurrency(item.amount_total, accounting?.currency || 'IDR') }}
              </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="6" class="px-3 py-4 text-center text-slate-500">
                Belum ada histori order.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
