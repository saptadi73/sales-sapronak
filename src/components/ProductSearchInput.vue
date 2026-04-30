<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getProducts } from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'
import type { ProductItem } from '@/types/odoo'
import { formatCurrency } from '@/utils/qr'

const props = defineProps<{
  modelValue: number | null
  disabled?: boolean
  customerId?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  select: [product: ProductItem]
}>()

const sessionStore = useSessionStore()

const query = ref('')
const displayLabel = ref('')
const results = ref<ProductItem[]>([])
const loading = ref(false)
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const inputWrapRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      query.value = ''
      displayLabel.value = ''
    }
  },
)

function productLabel(p: ProductItem) {
  const code = p.default_code?.trim()
  const name = p.name?.trim() ?? ''

  if (!code) {
    return name
  }

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const repeatedCodePrefixPattern = new RegExp(
    `^(?:(?:\\[\\s*${escapedCode}\\s*\\]|${escapedCode})\\s*)+`,
    'i',
  )
  const nameWithoutRepeatedCode = name.replace(repeatedCodePrefixPattern, '').trim()

  if (!nameWithoutRepeatedCode) {
    return `[${code}]`
  }

  return `[${code}] ${nameWithoutRepeatedCode}`
}

function productNameOnly(p: ProductItem) {
  const code = p.default_code?.trim()
  const name = p.name?.trim() ?? ''

  if (!code) {
    return name
  }

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const repeatedCodePrefixPattern = new RegExp(
    `^(?:(?:\\[\\s*${escapedCode}\\s*\\]|${escapedCode})\\s*)+`,
    'i',
  )

  const nameWithoutRepeatedCode = name.replace(repeatedCodePrefixPattern, '').trim()
  return nameWithoutRepeatedCode || name
}

async function runSearch(q: string) {
  if (q.trim().length < 2) {
    results.value = []
    open.value = false
    loading.value = false
    return
  }

  loading.value = true
  try {
    const res = await getProducts(sessionStore.baseUrl, {
      search: q,
      limit: 20,
      offset: 0,
      partner_id: props.customerId ?? undefined,
    })
    results.value = res.data.items
    open.value = results.value.length > 0
    if (open.value) {
      await nextTick()
      updateDropdownPlacement()
    }
  } catch {
    results.value = []
    open.value = false
  } finally {
    loading.value = false
  }
}

function updateDropdownPlacement() {
  const anchorElement = inputWrapRef.value ?? rootRef.value
  if (!anchorElement) {
    return
  }

  const rect = anchorElement.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const desiredHeight = 256
  const gap = 4
  const edgePadding = 8
  const availableAbove = Math.max(0, rect.top - edgePadding)
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - edgePadding)
  const openUpward = availableBelow < 180 && availableAbove > availableBelow
  const maxHeight = Math.max(
    96,
    Math.min(desiredHeight, openUpward ? availableAbove - gap : availableBelow - gap),
  )
  const top = openUpward
    ? Math.max(edgePadding, rect.top - maxHeight - gap)
    : Math.min(viewportHeight - maxHeight - edgePadding, rect.bottom + gap)
  const width = Math.max(220, rect.width)
  const left = Math.min(
    Math.max(edgePadding, rect.left),
    Math.max(edgePadding, viewportWidth - width - edgePadding),
  )

  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function onInput() {
  open.value = false
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSearch(query.value), 350)
}

function onFocus() {
  open.value = results.value.length > 0
  if (open.value) {
    nextTick(updateDropdownPlacement)
  }
}

function select(product: ProductItem) {
  displayLabel.value = productLabel(product)
  query.value = displayLabel.value
  open.value = false
  results.value = []
  emit('update:modelValue', product.product_id)
  emit('select', product)
}

function clear() {
  query.value = ''
  displayLabel.value = ''
  results.value = []
  open.value = false
  emit('update:modelValue', null)
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    if (query.value !== displayLabel.value) {
      query.value = displayLabel.value
    }
  }, 200)
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    return
  }

  await nextTick()
  updateDropdownPlacement()
})

onMounted(() => {
  const syncDropdownPlacement = () => {
    if (open.value) {
      updateDropdownPlacement()
    }
  }

  window.addEventListener('resize', syncDropdownPlacement)
  window.addEventListener('scroll', syncDropdownPlacement, true)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncDropdownPlacement()
    })

    if (inputWrapRef.value) {
      resizeObserver.observe(inputWrapRef.value)
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncDropdownPlacement)
    window.removeEventListener('scroll', syncDropdownPlacement, true)
    resizeObserver?.disconnect()
  })
})
</script>

<template>
  <div ref="rootRef" class="relative w-full min-w-45">
    <div ref="inputWrapRef" class="relative flex items-center">
      <input
        v-model="query"
        type="text"
        :disabled="disabled"
        placeholder="Ketik nama / kode produk..."
        autocomplete="off"
        :class="
          open
            ? 'border-emerald-400 bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
            : 'border-slate-300 bg-white'
        "
        class="w-full rounded-xl py-2 pl-3 pr-8 text-sm text-slate-700 outline-none transition ring-emerald-500 placeholder:text-slate-400 focus:ring disabled:bg-slate-50 disabled:text-slate-400"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button
        v-if="modelValue"
        type="button"
        tabindex="-1"
        class="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-rose-500"
        @mousedown.prevent="clear"
      >
        ✕
      </button>
      <span
        v-else-if="loading"
        class="absolute right-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
      />
    </div>

    <Teleport to="body">
      <ul
        v-if="open && results.length > 0"
        :style="dropdownStyle"
        class="z-100 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-950/5 backdrop-blur-sm"
        @wheel.stop
      >
        <li
          v-for="product in results"
          :key="product.product_id"
          class="group cursor-pointer rounded-xl px-3 py-2.5 transition last:border-0 hover:bg-emerald-50/80"
          @mousedown.prevent="select(product)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  {{ product.default_code || 'Tanpa Kode' }}
                </span>
                <span v-if="product.uom_name" class="text-slate-400">{{ product.uom_name }}</span>
              </div>
              <p
                class="mt-1 whitespace-normal wrap-break-word text-sm font-medium leading-5 text-slate-800 transition group-hover:text-emerald-700"
              >
                {{ productNameOnly(product) }}
              </p>
            </div>
            <span
              v-if="product.list_price"
              class="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
            >
              {{ product.currency_name ?? 'IDR' }} {{ formatCurrency(product.list_price) }}
            </span>
          </div>
        </li>
      </ul>
    </Teleport>

    <p
      v-if="!loading && query.trim().length >= 2 && !open && results.length === 0 && !modelValue"
      class="mt-1 text-xs text-slate-400"
    >
      Produk tidak ditemukan.
    </p>
  </div>
</template>
