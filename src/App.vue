<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from '@/components/AppNavbar.vue'
import { useSessionStore } from '@/stores/session'
import { ODOO_API_TOAST_EVENT } from '@/services/odooApi'

type AppToastType = 'network-error' | 'session-expired'

interface AppToastDetail {
  type: AppToastType
  message: string
}

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const showNavbar = computed(() => route.path !== '/login')

const toastMessage = ref('')
const toastType = ref<AppToastType>('network-error')
const showToast = ref(false)

let toastTimer: ReturnType<typeof setTimeout> | null = null

function openToast(message: string, type: AppToastType) {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  toastTimer = setTimeout(() => {
    showToast.value = false
  }, 3500)
}

async function onApiToast(event: Event) {
  const customEvent = event as CustomEvent<AppToastDetail>
  const detail = customEvent.detail
  if (!detail) {
    return
  }

  openToast(detail.message, detail.type)

  if (detail.type === 'session-expired' && route.path !== '/login') {
    const redirectPath = route.fullPath
    sessionStore.logout()
    await router.push({
      path: '/login',
      query: { redirect: redirectPath },
    })
  }
}

onMounted(() => {
  window.addEventListener(ODOO_API_TOAST_EVENT, onApiToast)
})

onBeforeUnmount(() => {
  window.removeEventListener(ODOO_API_TOAST_EVENT, onApiToast)
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <div v-if="showToast" class="fixed inset-x-4 top-4 z-[60] flex justify-center">
      <div
        class="w-full max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
        :class="toastType === 'session-expired' ? 'bg-rose-600' : 'bg-amber-600'"
      >
        {{ toastMessage }}
      </div>
    </div>

    <AppNavbar v-if="showNavbar" />
    <main class="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <RouterView />
    </main>
  </div>
</template>
