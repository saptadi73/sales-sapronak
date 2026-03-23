<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getCustomerQrPayloadById } from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

const customerId = ref<number | null>(null)
const format = ref<'ref' | 'json'>('ref')
const loading = ref(false)
const errorMessage = ref('')
const qrImageDataUrl = ref('')
const qrContent = ref('')
const customerName = ref('')
const customerRef = ref('')

type QrCodeModule = typeof import('qrcode')
let qrcodeModulePromise: Promise<QrCodeModule> | null = null

function loadQrCodeModule() {
  if (!qrcodeModulePromise) {
    qrcodeModulePromise = import('qrcode')
  }

  return qrcodeModulePromise
}

onMounted(() => {
  void loadQrCodeModule()
})

async function generateQr() {
  if (!customerId.value) {
    errorMessage.value = 'Customer ID wajib diisi.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getCustomerQrPayloadById(sessionStore.baseUrl, {
      customer_id: customerId.value,
      format: format.value,
    })

    qrContent.value = response.data.qr_content
    customerName.value = response.data.name
    customerRef.value = response.data.customer_qr_ref
    const qrcode = await loadQrCodeModule()
    qrImageDataUrl.value = await qrcode.toDataURL(response.data.qr_content, {
      width: 360,
      margin: 1,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal generate QR.'
  } finally {
    loading.value = false
  }
}

function downloadPng() {
  if (!qrImageDataUrl.value) {
    return
  }

  const anchor = document.createElement('a')
  anchor.href = qrImageDataUrl.value
  anchor.download = `${customerRef.value || 'customer-qr'}.png`
  anchor.click()
}

function printQr() {
  if (!qrImageDataUrl.value) {
    return
  }

  const printWindow = window.open('', '_blank', 'width=700,height=900')
  if (!printWindow) {
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Print QR Customer</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
          img { width: 280px; height: 280px; }
          h2, p { margin: 8px 0; }
        </style>
      </head>
      <body>
        <h2>${customerName.value}</h2>
        <p>${customerRef.value}</p>
        <img src="${qrImageDataUrl.value}" alt="Customer QR" />
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}
</script>

<template>
  <section class="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div>
      <h1 class="text-xl font-bold text-slate-900">Pembuatan QRCode Customer</h1>
      <p class="mt-1 text-sm text-slate-600">
        Masukkan customer ID untuk generate QR, simpan PNG, atau print.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <label class="space-y-1 sm:col-span-1">
        <span class="text-sm font-medium text-slate-700">Customer ID</span>
        <input
          v-model.number="customerId"
          type="number"
          min="1"
          placeholder="45"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
        />
      </label>

      <label class="space-y-1 sm:col-span-1">
        <span class="text-sm font-medium text-slate-700">Format QR</span>
        <select
          v-model="format"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
        >
          <option value="ref">ref</option>
          <option value="json">json</option>
        </select>
      </label>

      <div class="flex items-end">
        <button
          type="button"
          :disabled="loading"
          class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          @click="generateQr"
        >
          {{ loading ? 'Memproses...' : 'Generate QR' }}
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div
      v-if="qrImageDataUrl"
      class="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      <div class="space-y-2">
        <p class="text-sm text-slate-600">Customer</p>
        <p class="font-semibold text-slate-900">{{ customerName }}</p>
        <p class="text-sm text-slate-700">{{ customerRef }}</p>
        <p class="break-all text-xs text-slate-500">{{ qrContent }}</p>
      </div>

      <div class="space-y-3">
        <img
          :src="qrImageDataUrl"
          alt="QR Customer"
          class="mx-auto w-56 rounded-lg bg-white p-2 shadow"
        />
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            @click="downloadPng"
          >
            Save PNG
          </button>
          <button
            type="button"
            class="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
            @click="printQr"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
