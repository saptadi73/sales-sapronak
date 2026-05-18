<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmFrontendOrder, getOrdersByQr, listFrontendOrders } from '@/services/odooApi'
import type { FrontendOrderListItem, FrontendOrderScope } from '@/types/odoo'
import { useSessionStore } from '@/stores/session'
import { formatCurrency } from '@/utils/qr'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const scope = ref<FrontendOrderScope>('susu-olahan')
const loading = ref(false)
const loadingConfirm = ref<number | null>(null)
const errorMessage = ref('')
const successMessage = ref('')

const filters = reactive({
  unpaid_only: true,
  include_accounting: false,
  date_from: '',
  date_to: '',
  payment_status: '',
  payment_statuses: [] as string[],
  customer_qr_ref: '',
})

const paymentStatusOptions = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

const orders = ref<FrontendOrderListItem[]>([])

const sortedOrders = computed(() => {
  return [...orders.value].sort((a, b) => {
    const left = a.date_order ?? a.commitment_date ?? ''
    const right = b.date_order ?? b.commitment_date ?? ''
    return left < right ? 1 : -1
  })
})
const hasQrFilter = computed(() => Boolean(filters.customer_qr_ref.trim()))

function togglePaymentStatus(value: string) {
  const exists = filters.payment_statuses.includes(value)
  if (exists) {
    filters.payment_statuses = filters.payment_statuses.filter((item) => item !== value)
    return
  }

  filters.payment_statuses = [...filters.payment_statuses, value]
}

function parseBooleanQuery(value: unknown, fallback = false) {
  if (typeof value !== 'string') {
    return fallback
  }

  if (value === '1' || value.toLowerCase() === 'true') {
    return true
  }

  if (value === '0' || value.toLowerCase() === 'false') {
    return false
  }

  return fallback
}

function syncUrlWithFilters() {
  const query: Record<string, string> = {}

  if (scope.value !== 'susu-olahan') {
    query.scope = scope.value
  }

  if (filters.date_from) {
    query.date_from = filters.date_from
  }

  if (filters.date_to) {
    query.date_to = filters.date_to
  }

  if (!filters.unpaid_only) {
    query.unpaid_only = '0'
  }

  if (filters.include_accounting) {
    query.include_accounting = '1'
  }

  if (filters.payment_status) {
    query.payment_status = filters.payment_status
  }

  if (filters.payment_statuses.length > 0) {
    query.payment_statuses = filters.payment_statuses.join(',')
  }

  if (filters.customer_qr_ref.trim()) {
    query.customer_qr_ref = filters.customer_qr_ref.trim()
  }

  void router.replace({ path: '/sales-orders', query })
}

function resetFilters() {
  scope.value = 'susu-olahan'
  filters.unpaid_only = true
  filters.include_accounting = false
  filters.date_from = ''
  filters.date_to = ''
  filters.payment_status = ''
  filters.payment_statuses = []
  filters.customer_qr_ref = ''
}

async function resetAndLoadOrders() {
  resetFilters()
  await loadOrders()
}

async function loadOrders() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  syncUrlWithFilters()

  try {
    const qrRef = filters.customer_qr_ref.trim()
    if (qrRef) {
      const response = await getOrdersByQr(sessionStore.baseUrl, {
        customer_qr_ref: qrRef,
        limit: 100,
        offset: 0,
      })

      orders.value = (response.data.items ?? []).map((item) => ({
        sale_order_id: item.sale_order_id,
        name: item.name,
        date_order: item.date_order,
        commitment_date: item.commitment_date,
        amount_total: item.amount_total,
        state: item.state,
        approval_state: item.approval_state ?? undefined,
        sale_order_type: item.sale_order_type ?? undefined,
      }))
      return
    }

    const paymentStatuses = filters.payment_statuses

    const response = await listFrontendOrders(
      sessionStore.baseUrl,
      {
        unpaid_only: filters.unpaid_only,
        include_accounting: filters.include_accounting,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        payment_status:
          paymentStatuses.length === 0 ? filters.payment_status || undefined : undefined,
        payment_statuses: paymentStatuses.length > 0 ? paymentStatuses : undefined,
        frontend_only: true,
        limit: 100,
        offset: 0,
      },
      scope.value,
    )

    orders.value = response.data.items ?? []
  } catch (error) {
    orders.value = []
    errorMessage.value = error instanceof Error ? error.message : 'Gagal memuat daftar Sales Order.'
  } finally {
    loading.value = false
  }
}

async function confirmOrder(orderId: number) {
  loadingConfirm.value = orderId
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await confirmFrontendOrder(sessionStore.baseUrl, orderId, scope.value)
    successMessage.value = `Order ${response.data.name} berhasil dikonfirmasi.`
    await loadOrders()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal konfirmasi Sales Order.'
  } finally {
    loadingConfirm.value = null
  }
}

async function editOrder(orderId: number) {
  await router.push({
    path: '/sales-order',
    query: { edit_id: String(orderId), scope: scope.value },
  })
}

onMounted(async () => {
  if (typeof route.query.scope === 'string' && route.query.scope === 'minimarket') {
    scope.value = 'minimarket'
  }

  if (typeof route.query.date_from === 'string') {
    filters.date_from = route.query.date_from
  }

  if (typeof route.query.date_to === 'string') {
    filters.date_to = route.query.date_to
  }

  filters.unpaid_only = parseBooleanQuery(route.query.unpaid_only, true)
  filters.include_accounting = parseBooleanQuery(route.query.include_accounting, false)

  if (typeof route.query.payment_status === 'string') {
    filters.payment_status = route.query.payment_status
  }

  if (typeof route.query.payment_statuses === 'string' && route.query.payment_statuses) {
    filters.payment_statuses = route.query.payment_statuses
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof route.query.customer_qr_ref === 'string' && route.query.customer_qr_ref) {
    filters.customer_qr_ref = route.query.customer_qr_ref
  }

  await loadOrders()
})
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 class="text-xl font-bold text-slate-900">Manajemen Sales Order Frontend</h1>
      <p class="mt-1 text-sm text-slate-600">
        Lihat daftar SO frontend, edit draft/sent, dan confirm order langsung dari aplikasi.
      </p>
      <p class="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Semua data list, histori per QR, dan ringkasan yang tampil di halaman ini mengikuti
        active/default Business Category akun login.
      </p>
    </div>

    <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div class="grid gap-3 md:grid-cols-8">
        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700">Scope</span>
          <select
            v-model="scope"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          >
            <option value="susu-olahan">Susu Olahan</option>
            <option value="minimarket">Minimarket</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700">Date From</span>
          <input
            v-model="filters.date_from"
            type="date"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700">Date To</span>
          <input
            v-model="filters.date_to"
            type="date"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input v-model="filters.unpaid_only" type="checkbox" class="h-4 w-4 rounded" />
          <span>Unpaid only</span>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-sm font-medium text-slate-700">Payment Status</span>
          <select
            v-model="filters.payment_status"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          >
            <option value="">Semua status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </label>

        <div class="space-y-1 md:col-span-2">
          <span class="text-sm font-medium text-slate-700">Payment Statuses</span>
          <div class="flex flex-wrap gap-2 rounded-lg border border-slate-300 p-2">
            <button
              v-for="status in paymentStatusOptions"
              :key="status.value"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-semibold transition"
              :class="
                filters.payment_statuses.includes(status.value)
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              "
              @click="togglePaymentStatus(status.value)"
            >
              {{ status.label }}
            </button>
          </div>
        </div>

        <label class="space-y-1 md:col-span-2">
          <span class="text-sm font-medium text-slate-700">Customer QR Ref</span>
          <input
            v-model="filters.customer_qr_ref"
            type="text"
            placeholder="CUSTQR2603-000001"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <div class="flex items-end gap-2 md:col-span-2">
          <button
            type="button"
            :disabled="loading"
            class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            @click="resetAndLoadOrders"
          >
            Reset Filter
          </button>
          <button
            type="button"
            :disabled="loading"
            class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            @click="loadOrders"
          >
            {{ loading ? 'Memuat...' : 'Muat Daftar SO' }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-emerald-700">{{ successMessage }}</p>
      <p v-if="!loading && sortedOrders.length === 0 && hasQrFilter" class="text-sm text-amber-700">
        Tidak ada data untuk QR ini pada Business Category aktif akun login. Coba cek/minta admin
        menyesuaikan active/default Business Category user.
      </p>

      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th class="px-3 py-2">SO</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Tanggal</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">State</th>
              <th class="px-3 py-2">Payment</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loading && sortedOrders.length === 0">
              <td colspan="8" class="px-3 py-5 text-center text-slate-500">Data SO kosong.</td>
            </tr>
            <tr
              v-for="order in sortedOrders"
              :key="order.sale_order_id"
              class="border-b border-slate-100"
            >
              <td class="px-3 py-2 font-medium text-slate-900">{{ order.name }}</td>
              <td class="px-3 py-2">{{ order.partner_name || '-' }}</td>
              <td class="px-3 py-2">{{ order.commitment_date || order.date_order || '-' }}</td>
              <td class="px-3 py-2">
                {{ order.sale_order_type_label || order.sale_order_type || '-' }}
              </td>
              <td class="px-3 py-2">{{ order.state }}</td>
              <td class="px-3 py-2">{{ order.payment_status || '-' }}</td>
              <td class="px-3 py-2 font-semibold">{{ formatCurrency(order.amount_total) }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    @click="editOrder(order.sale_order_id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    :disabled="
                      loadingConfirm === order.sale_order_id ||
                      !['draft', 'sent'].includes(order.state)
                    "
                    class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    @click="confirmOrder(order.sale_order_id)"
                  >
                    {{ loadingConfirm === order.sale_order_id ? 'Proses...' : 'Confirm' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
