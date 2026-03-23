<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { BrowserMultiFormatReader } from '@zxing/browser'

const emit = defineEmits<{
  detected: [value: string]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isScanning = ref(false)
const errorMessage = ref('')

let reader: BrowserMultiFormatReader | null = null
let stopControls: { stop: () => void } | null = null

async function ensureReader() {
  if (reader) {
    return reader
  }

  const zxingModule = await import('@zxing/browser')
  reader = new zxingModule.BrowserMultiFormatReader()
  return reader
}

async function startScan() {
  if (!videoRef.value || isScanning.value) {
    return
  }

  errorMessage.value = ''

  try {
    const activeReader = await ensureReader()
    stopControls = await activeReader.decodeFromVideoDevice(undefined, videoRef.value, (result) => {
      if (result) {
        emit('detected', result.getText())
        stopScan()
      }
    })
    isScanning.value = true
  } catch {
    errorMessage.value = 'Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.'
  }
}

function stopScan() {
  if (stopControls) {
    stopControls.stop()
    stopControls = null
  }

  isScanning.value = false
}

onBeforeUnmount(() => {
  stopScan()
})
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-base font-semibold text-slate-800">QR Reader Kamera</h3>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          @click="startScan"
        >
          Mulai Scan
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          @click="stopScan"
        >
          Stop
        </button>
      </div>
    </div>

    <video
      ref="videoRef"
      class="aspect-video w-full rounded-xl bg-slate-900 object-cover"
      muted
      playsinline
    />

    <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>
  </section>
</template>
