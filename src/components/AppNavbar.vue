<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const mobileOpen = ref(false)

const links = computed(() => [
  { label: 'QR Generator', to: '/qr-generator' },
  { label: 'QR Reader', to: '/qr-reader' },
  { label: 'Sales Order', to: '/sales-order' },
])

async function logout() {
  sessionStore.logout()
  mobileOpen.value = false
  await router.push('/login')
}

function closeMobile() {
  mobileOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
      <RouterLink
        to="/qr-generator"
        class="text-base font-bold text-slate-800"
        @click="closeMobile"
      >
        Odoo Sales Mobile
      </RouterLink>

      <button
        type="button"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 lg:hidden"
        @click="mobileOpen = !mobileOpen"
      >
        Menu
      </button>

      <nav class="hidden items-center gap-2 lg:flex">
        <RouterLink
          v-for="item in links"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="
            route.path === item.to
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          "
        >
          {{ item.label }}
        </RouterLink>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
          @click="logout"
        >
          Logout
        </button>
      </nav>
    </div>

    <nav v-if="mobileOpen" class="space-y-2 border-t border-slate-200 px-4 py-3 lg:hidden">
      <RouterLink
        v-for="item in links"
        :key="item.to"
        :to="item.to"
        class="block rounded-lg px-3 py-2 text-sm font-medium"
        :class="
          route.path === item.to
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        "
        @click="closeMobile"
      >
        {{ item.label }}
      </RouterLink>
      <button
        type="button"
        class="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
        @click="logout"
      >
        Logout
      </button>
    </nav>
  </header>
</template>
