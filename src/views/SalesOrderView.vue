<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import ProductSearchInput from '@/components/ProductSearchInput.vue'
import QrScanner from '@/components/QrScanner.vue'
import {
  createDraftOrderByBonType,
  getCustomerDetailByQr,
  getPaymentTerms,
} from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'
import type {
  DraftOrderBonType,
  CustomerDetailData,
  DraftOrderResult,
  PaymentTermItem,
  ProductItem,
} from '@/types/odoo'
import { extractCustomerQrRef, formatCurrency, toOdooDateTime } from '@/utils/qr'

interface OrderLineForm {
  rowId: number
  product_id: number | null
  product_uom_qty: number
  price_unit: number
}

const route = useRoute()
const sessionStore = useSessionStore()

const loadingMaster = ref(false)
const loadingSubmit = ref(false)
const loadingCustomer = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const customerQrInput = ref('')
const customer = ref<CustomerDetailData | null>(null)
const createdOrder = ref<DraftOrderResult | null>(null)
const selectedBonType = ref<DraftOrderBonType | ''>('')

const paymentTerms = ref<PaymentTermItem[]>([])
const bonTypeOptions: Array<{ value: DraftOrderBonType; label: string }> = [
  { value: 'bon-kering', label: 'Bon Kering' },
  { value: 'bon-partus', label: 'Bon Partus' },
  { value: 'bon-reguler', label: 'Bon Reguler' },
]

const form = reactive({
  commitment_date: '',
  payment_term_id: null as number | null,
  lines: [
    {
      rowId: 1,
      product_id: null,
      product_uom_qty: 1,
      price_unit: 0,
    },
  ] as OrderLineForm[],
})

const grandTotal = computed(() =>
  form.lines.reduce((sum, item) => sum + item.product_uom_qty * item.price_unit, 0),
)

const customerHasShippingWilayah = computed(() => Boolean(customer.value?.shipping_wilayah_id))

function lineSubtotal(line: OrderLineForm) {
  return line.product_uom_qty * line.price_unit
}

function onLineProductSelect(line: OrderLineForm, product: ProductItem) {
  line.price_unit = product.list_price ?? 0
}

function addLine() {
  form.lines.push({
    rowId: Date.now(),
    product_id: null,
    product_uom_qty: 1,
    price_unit: 0,
  })
}

function removeLine(rowId: number) {
  form.lines = form.lines.filter((item) => item.rowId !== rowId)
  if (form.lines.length === 0) {
    addLine()
  }
}

async function fetchCustomerByQrValue(rawValue: string) {
  const qrRef = extractCustomerQrRef(rawValue)
  if (!qrRef) {
    errorMessage.value = 'QR customer tidak valid.'
    return
  }

  loadingCustomer.value = true
  errorMessage.value = ''

  try {
    const response = await getCustomerDetailByQr(sessionStore.baseUrl, qrRef)
    customer.value = response.data
    customerQrInput.value = qrRef

    if (response.data.payment_term_id && !form.payment_term_id) {
      form.payment_term_id = response.data.payment_term_id
    }
  } catch (error) {
    customer.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Gagal memuat customer dari QR.'
  } finally {
    loadingCustomer.value = false
  }
}

async function handleManualQr() {
  await fetchCustomerByQrValue(customerQrInput.value)
}

function handleDetectedQr(value: string) {
  customerQrInput.value = value
  fetchCustomerByQrValue(value)
}

async function loadMaster() {
  loadingMaster.value = true
  errorMessage.value = ''

  try {
    const paymentTermResult = await getPaymentTerms(sessionStore.baseUrl)

    paymentTerms.value = paymentTermResult.data.items
  } catch {
    paymentTerms.value = []
    errorMessage.value = 'Master data term of payment belum berhasil dimuat dari API.'
  } finally {
    loadingMaster.value = false
  }
}

function validateForm() {
  if (!customer.value?.customer_qr_ref) {
    return 'Customer dari QR wajib dipilih.'
  }

  if (!customerHasShippingWilayah.value) {
    return 'Customer belum memiliki Wilayah Ongkir. Lengkapi data wilayah customer terlebih dahulu.'
  }

  if (!form.commitment_date) {
    return 'Tanggal pengiriman wajib diisi.'
  }

  if (!form.payment_term_id) {
    return 'Term of Payment wajib dipilih.'
  }

  if (!selectedBonType.value) {
    return 'Jenis bon wajib dipilih.'
  }

  const validLines = form.lines.filter((line) => line.product_id && line.product_uom_qty > 0)
  if (validLines.length === 0) {
    return 'Minimal satu item produk wajib diisi.'
  }

  return ''
}

async function submitDraftOrder() {
  errorMessage.value = ''
  successMessage.value = ''
  createdOrder.value = null

  const validationMessage = validateForm()
  if (validationMessage) {
    errorMessage.value = validationMessage
    return
  }

  loadingSubmit.value = true

  try {
    const bonType = selectedBonType.value
    if (!bonType) {
      throw new Error('Jenis bon belum dipilih.')
    }

    const payloadLines = form.lines
      .filter((line) => line.product_id && line.product_uom_qty > 0)
      .map((line) => ({
        product_id: Number(line.product_id),
        product_uom_qty: Number(line.product_uom_qty),
        price_unit: Number(line.price_unit),
      }))

    const response = await createDraftOrderByBonType(sessionStore.baseUrl, bonType, {
      partner_id: customer.value?.partner_id,
      customer_qr_ref: customer.value?.customer_qr_ref,
      commitment_date: toOdooDateTime(form.commitment_date),
      payment_term_id: form.payment_term_id ?? undefined,
      order_line: payloadLines,
    })

    createdOrder.value = response.data
    successMessage.value = 'Draft Sales Order berhasil dibuat.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal membuat draft Sales Order.'
  } finally {
    loadingSubmit.value = false
  }
}

onMounted(async () => {
  await loadMaster()

  if (typeof route.query.qr === 'string' && route.query.qr) {
    customerQrInput.value = route.query.qr
    await fetchCustomerByQrValue(route.query.qr)
  }
})
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 class="text-xl font-bold text-slate-900">Create Draft Sales Order</h1>
      <p class="mt-1 text-sm text-slate-600">
        Scan QR customer untuk autofill data. Ongkos kirim/angkut ditentukan backend dari Wilayah
        Ongkir customer, lalu isi tanggal pengiriman, payment term, jenis bon, dan item produk.
      </p>
      <p v-if="loadingMaster" class="mt-2 text-sm text-slate-500">Memuat master data...</p>
      <div v-if="loadingMaster" class="mt-3 space-y-2">
        <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
        <div class="h-4 w-3/4 animate-pulse rounded bg-slate-100"></div>
      </div>
    </div>

    <QrScanner @detected="handleDetectedQr" />

    <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div class="relative z-0 grid gap-4 md:grid-cols-3">
        <label class="space-y-1 md:col-span-2">
          <span class="text-sm font-medium text-slate-700">Customer QR (scan/manual)</span>
          <input
            v-model="customerQrInput"
            type="text"
            placeholder="CUSTQR2603-000001 atau JSON"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>
        <div class="flex items-end">
          <button
            type="button"
            :disabled="loadingCustomer"
            class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            @click="handleManualQr"
          >
            {{ loadingCustomer ? 'Mencari...' : 'Ambil Customer' }}
          </button>
        </div>
      </div>

      <div v-if="loadingCustomer" class="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
        <div class="h-4 w-3/4 animate-pulse rounded bg-slate-200"></div>
        <div class="h-4 w-1/2 animate-pulse rounded bg-slate-200"></div>
        <div class="h-4 w-2/3 animate-pulse rounded bg-slate-200"></div>
      </div>

      <div v-if="customer" class="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <p><span class="font-medium">Nama:</span> {{ customer.name }}</p>
        <p><span class="font-medium">QR Ref:</span> {{ customer.customer_qr_ref }}</p>
        <p>
          <span class="font-medium">Wilayah Ongkir:</span>
          {{ customer.shipping_wilayah_name || '-' }}
        </p>
        <p>
          <span class="font-medium">Payment Term:</span> {{ customer.payment_term_name || '-' }}
        </p>
      </div>

      <p
        v-if="customer && !customerHasShippingWilayah"
        class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        Data customer ini belum punya Wilayah Ongkir, sehingga draft order tidak bisa dibuat.
      </p>

      <p
        v-if="customerHasShippingWilayah"
        class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      >
        Ongkos kirim/angkut akan ditambahkan otomatis oleh backend berdasarkan Wilayah Ongkir
        customer.
      </p>
    </section>

    <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div v-if="loadingMaster" class="space-y-2">
        <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
        <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
        <div class="h-10 w-full animate-pulse rounded bg-slate-100"></div>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700">Tanggal Pengiriman</span>
          <input
            v-model="form.commitment_date"
            type="datetime-local"
            :disabled="loadingMaster"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="space-y-1">
          <span class="text-sm font-medium text-slate-700">Term of Payment</span>
          <select
            v-model.number="form.payment_term_id"
            :disabled="loadingMaster"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          >
            <option :value="null">Pilih Term</option>
            <option
              v-for="term in paymentTerms"
              :key="term.payment_term_id"
              :value="term.payment_term_id"
            >
              {{ term.name }}
            </option>
          </select>
        </label>

        <div class="space-y-1 md:col-span-3">
          <span class="text-sm font-medium text-slate-700">Jenis Bon</span>
          <select
            v-model="selectedBonType"
            :disabled="loadingMaster"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          >
            <option value="">Pilih Jenis Bon</option>
            <option v-for="option in bonTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="relative z-10 overflow-x-auto overflow-y-visible">
        <table class="min-w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th class="px-3 py-2">Product</th>
              <th class="px-3 py-2">Qty</th>
              <th class="px-3 py-2">Price Unit</th>
              <th class="px-3 py-2">Sub Total</th>
              <th class="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in form.lines"
              :key="line.rowId"
              class="border-b border-slate-100 align-top"
            >
              <td class="relative overflow-visible px-3 py-2">
                <ProductSearchInput
                  v-model="line.product_id"
                  :disabled="loadingMaster"
                  @select="onLineProductSelect(line, $event)"
                />
              </td>
              <td class="px-3 py-2">
                <input
                  v-model.number="line.product_uom_qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  :disabled="loadingMaster"
                  class="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none ring-emerald-500 focus:ring"
                />
              </td>
              <td class="px-3 py-2">
                <input
                  v-model.number="line.price_unit"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="loadingMaster"
                  class="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none ring-emerald-500 focus:ring"
                />
              </td>
              <td class="px-3 py-2 font-medium">{{ formatCurrency(lineSubtotal(line)) }}</td>
              <td class="px-3 py-2">
                <button
                  type="button"
                  :disabled="loadingMaster"
                  class="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  @click="removeLine(line.rowId)"
                >
                  Hapus
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          :disabled="loadingMaster"
          class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          @click="addLine"
        >
          + Tambah Product
        </button>
        <p class="text-base font-bold text-slate-900">Total: {{ formatCurrency(grandTotal) }}</p>
      </div>

      <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-emerald-700">{{ successMessage }}</p>

      <div
        v-if="createdOrder"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
      >
        <p><span class="font-semibold">Order:</span> {{ createdOrder.name }}</p>
        <p><span class="font-semibold">State:</span> {{ createdOrder.state }}</p>
        <p><span class="font-semibold">Line:</span> {{ createdOrder.line_count }}</p>
        <p>
          <span class="font-semibold">Amount Total:</span>
          {{ formatCurrency(createdOrder.amount_total) }}
        </p>
        <p v-if="createdOrder.wilayah_name">
          <span class="font-semibold">Wilayah Customer:</span> {{ createdOrder.wilayah_name }}
        </p>
        <p v-if="createdOrder.shipping_product_name">
          <span class="font-semibold">Produk Ongkir/Angkut:</span>
          {{ createdOrder.shipping_product_name }}
        </p>
      </div>

      <button
        type="button"
        :disabled="loadingSubmit || loadingMaster"
        class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        @click="submitDraftOrder"
      >
        {{ loadingSubmit ? 'Menyimpan...' : 'Create Draft Sales Order' }}
      </button>
    </section>
  </section>
</template>
