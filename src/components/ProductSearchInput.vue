<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getProducts } from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'
import type { ProductItem } from '@/types/odoo'
import { formatCurrency } from '@/utils/qr'

const props = defineProps<{
  modelValue: number | null
  disabled?: boolean
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
const dropdownStyle = ref<Record<string, string>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

async function runSearch(q: string) {
  if (q.trim().length < 2) {
    results.value = []
    open.value = false
    loading.value = false
    return
  }

  loading.value = true
  try {
    const res = await getProducts(sessionStore.baseUrl, { search: q, limit: 20, offset: 0 })
    results.value = res.data.items
    open.value = results.value.length > 0
    if (open.value) {
      await nextTick()
      updateDropdownPosition()
    }
  } catch {
    results.value = []
    open.value = false
  } finally {
    loading.value = false
  }
}

function updateDropdownPosition() {
  const rootElement = rootRef.value
  if (!rootElement) {
    return
  }

  const rect = rootElement.getBoundingClientRect()
  const viewportBottom = window.innerHeight
  const estimatedHeight = 260
  const spaceBelow = viewportBottom - rect.bottom
  const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight
  const top = openUpward ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4

  dropdownStyle.value = {
    position: 'fixed',
    top: `${Math.max(8, top)}px`,
    left: `${Math.max(8, rect.left)}px`,
    width: `${Math.max(220, rect.width)}px`,
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
    nextTick(updateDropdownPosition)
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

onMounted(() => {
  const syncPosition = () => {
    if (open.value) {
      updateDropdownPosition()
    }
  }

  window.addEventListener('resize', syncPosition)
  window.addEventListener('scroll', syncPosition, true)

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncPosition)
    window.removeEventListener('scroll', syncPosition, true)
  })
})
</script>

<template>
  <div ref="rootRef" class="relative w-full min-w-45">
    <div class="relative flex items-center">
      <input
        v-model="query"
        type="text"
        :disabled="disabled"
        placeholder="Ketik nama / kode produk..."
        autocomplete="off"
        class="w-full rounded-lg border border-slate-300 py-1.5 pl-3 pr-8 text-sm outline-none ring-emerald-500 focus:ring disabled:bg-slate-50 disabled:text-slate-400"
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
        class="z-50 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-xl"
        @wheel.stop
      >
        <li
          v-for="product in results"
          :key="product.product_id"
          class="cursor-pointer border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-emerald-50"
          @mousedown.prevent="select(product)"
        >
          <p class="truncate font-medium text-slate-800">{{ productLabel(product) }}</p>
          <div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span v-if="product.list_price">
              {{ product.currency_name ?? 'IDR' }} {{ formatCurrency(product.list_price) }}
            </span>
            <span v-if="product.uom_name" class="text-slate-400">/ {{ product.uom_name }}</span>
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
