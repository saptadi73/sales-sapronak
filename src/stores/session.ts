import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { OdooAuthData } from '@/types/odoo'

interface SessionSnapshot {
  baseUrl: string
  db: string
  user?: OdooAuthData
}

const STORAGE_KEY = 'sales-odoo-session'

export const useSessionStore = defineStore('session', () => {
  const baseUrl = ref('')
  const db = ref('')
  const user = ref<OdooAuthData | null>(null)

  const isAuthenticated = computed(() => Boolean(user.value?.uid || user.value?.session_id))

  function saveToStorage() {
    const snapshot: SessionSnapshot = {
      baseUrl: baseUrl.value,
      db: db.value,
      user: user.value ?? undefined,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  function restoreSession() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as SessionSnapshot
      baseUrl.value = parsed.baseUrl || ''
      db.value = parsed.db || ''
      user.value = parsed.user ?? null
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function setSession(payload: { baseUrl: string; db: string; user: OdooAuthData }) {
    baseUrl.value = payload.baseUrl.replace(/\/$/, '')
    db.value = payload.db
    user.value = payload.user
    saveToStorage()
  }

  function logout() {
    baseUrl.value = ''
    db.value = ''
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    baseUrl,
    db,
    user,
    isAuthenticated,
    restoreSession,
    setSession,
    logout,
  }
})
