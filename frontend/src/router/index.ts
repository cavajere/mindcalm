import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import { buildAdminUrl } from '../utils/appUrls'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { publicOnly: true, hideChrome: true } },
    { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { publicOnly: true, hideChrome: true } },
    { path: '/forgot-password', component: () => import('../views/ForgotPasswordView.vue'), meta: { hideChrome: true } },
    { path: '/reset-password', component: () => import('../views/ResetPasswordView.vue'), meta: { hideChrome: true } },
    { path: '/verify-registration', component: () => import('../views/VerifyRegistrationView.vue'), meta: { publicOnly: true, hideChrome: true } },
    { path: '/accept-invite', component: () => import('../views/AcceptInviteView.vue'), meta: { publicOnly: true, hideChrome: true } },
    { path: '/unsubscribe', component: () => import('../views/UnsubscribeView.vue'), meta: { hideChrome: true } },
    { path: '/license-expired', component: () => import('../views/LicenseExpiredView.vue'), meta: { hideChrome: true } },
    { path: '/', component: HomeView },
    { path: '/termini-e-condizioni', component: () => import('../views/LegalDocumentView.vue'), props: { documentType: 'terms' } },
    { path: '/privacy-policy', component: () => import('../views/LegalDocumentView.vue'), props: { documentType: 'privacy' } },
    { path: '/audio', component: () => import('../views/AudioView.vue'), meta: { requiresAuth: true } },
    { path: '/audio/:id', component: () => import('../views/AudioDetailView.vue'), meta: { requiresAuth: true } },
    { path: '/articles', component: () => import('../views/ArticlesView.vue') },
    { path: '/articles/:slug', component: () => import('../views/ArticleDetailView.vue') },
    { path: '/events', component: () => import('../views/EventsView.vue') },
    { path: '/events/:slug', component: () => import('../views/EventDetailView.vue') },
    { path: '/downloads', redirect: '/audio' },
    { path: '/profile', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (import.meta.env.DEV && to.path.startsWith('/admin')) {
    window.location.replace(buildAdminUrl(to.fullPath))
    return false
  }

  if (!to.matched.length) {
    return '/'
  }

  const shouldInitializeAuth = !auth.initialized && !to.meta.publicOnly

  if (shouldInitializeAuth) {
    await auth.initialize()
  }

  if (to.meta.requiresAuth && auth.isLicenseExpired) {
    return auth.getLicenseExpiredRouteLocation()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login'
  }

  if (to.meta.publicOnly && auth.isAuthenticated) {
    return '/'
  }
})

export default router
