<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authenticate, debugAuthenticateCors, type CorsDebugResult } from '@/services/odooApi'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()

const loading = ref(false)
const errorMessage = ref('')
const corsDebugLoading = ref(false)
const corsDebugResult = ref<CorsDebugResult | null>(null)

const form = reactive({
  baseUrl: sessionStore.baseUrl || '',
  db: sessionStore.db || '',
  login: '',
  password: '',
})

async function submitLogin() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await authenticate(form.baseUrl, {
      login: form.login,
      password: form.password,
      db: form.db,
    })

    sessionStore.setSession({
      baseUrl: form.baseUrl,
      db: form.db,
      user: response.data,
    })

    const nextPath =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/qr-generator'
    await router.push(nextPath)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login gagal'
  } finally {
    loading.value = false
  }
}

async function runCorsDebug() {
  corsDebugLoading.value = true
  corsDebugResult.value = null

  try {
    const result = await debugAuthenticateCors(form.baseUrl, {
      db: form.db,
      login: form.login,
      password: form.password,
    })

    corsDebugResult.value = result

    console.group('[CORS Debug] Authenticate Endpoint')
    console.table({
      timestamp: result.timestamp,
      appOrigin: result.appOrigin,
      requestUrl: result.requestUrl,
      outcome: result.outcome,
      status: result.status ?? '-',
      statusText: result.statusText ?? '-',
      errorMessage: result.errorMessage ?? '-',
    })
    console.log('Response CORS headers:', result.responseHeaders)
    console.log('Hint:', result.hint)
    console.groupEnd()
  } finally {
    corsDebugLoading.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-4 py-8 sm:py-14">
    <section
      class="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h1 class="text-2xl font-bold text-slate-900">Login Odoo Sales</h1>
      <p class="mt-2 text-sm text-slate-600">Autentikasi JSON-RPC untuk session Odoo.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submitLogin">
        <label class="block space-y-1">
          <span class="text-sm font-medium text-slate-700">Base URL Odoo</span>
          <input
            v-model="form.baseUrl"
            type="url"
            required
            placeholder="https://your-odoo-host"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm font-medium text-slate-700">Database</span>
          <input
            v-model="form.db"
            type="text"
            required
            placeholder="database_name"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm font-medium text-slate-700">Login</span>
          <input
            v-model="form.login"
            type="text"
            required
            placeholder="user@example.com"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm font-medium text-slate-700">Password</span>
          <input
            v-model="form.password"
            type="password"
            required
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
          />
        </label>

        <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {{ loading ? 'Memproses...' : 'Login' }}
        </button>

        <button
          type="button"
          :disabled="corsDebugLoading || !form.baseUrl"
          class="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          @click="runCorsDebug"
        >
          {{ corsDebugLoading ? 'Mengecek CORS...' : 'Cek CORS Endpoint (Production)' }}
        </button>
      </form>

      <section
        v-if="corsDebugResult"
        class="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
      >
        <p class="font-semibold text-slate-900">Hasil Debug CORS</p>
        <p><span class="font-medium">Waktu:</span> {{ corsDebugResult.timestamp }}</p>
        <p><span class="font-medium">App Origin:</span> {{ corsDebugResult.appOrigin }}</p>
        <p><span class="font-medium">Endpoint:</span> {{ corsDebugResult.requestUrl }}</p>
        <p><span class="font-medium">Outcome:</span> {{ corsDebugResult.outcome }}</p>
        <p v-if="corsDebugResult.status !== undefined">
          <span class="font-medium">HTTP:</span>
          {{ corsDebugResult.status }} {{ corsDebugResult.statusText || '' }}
        </p>
        <p v-if="corsDebugResult.errorMessage">
          <span class="font-medium">Error:</span> {{ corsDebugResult.errorMessage }}
        </p>
        <p v-if="corsDebugResult.responseHeaders">
          <span class="font-medium">ACAO:</span>
          {{ corsDebugResult.responseHeaders.accessControlAllowOrigin || '(kosong)' }}
        </p>
        <p v-if="corsDebugResult.hint" class="text-amber-700">
          <span class="font-medium">Hint:</span> {{ corsDebugResult.hint }}
        </p>
      </section>
    </section>
  </main>
</template>
