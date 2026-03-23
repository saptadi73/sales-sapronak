import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      redirect: '/qr-generator',
    },
    {
      path: '/qr-generator',
      name: 'qr-generator',
      component: () => import('@/views/QrGeneratorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/qr-reader',
      name: 'qr-reader',
      component: () => import('@/views/QrReaderView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sales-order',
      name: 'sales-order',
      component: () => import('@/views/SalesOrderView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const sessionStore = useSessionStore()
  sessionStore.restoreSession()

  if (to.path === '/login' && sessionStore.isAuthenticated) {
    return '/qr-generator'
  }

  if (to.meta.requiresAuth && !sessionStore.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

export default router
