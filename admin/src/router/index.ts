import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/login', component: LoginView, meta: { publicOnly: true } },
    { path: '/forgot-password', component: () => import('../views/ForgotPasswordView.vue'), meta: { publicOnly: true } },
    { path: '/reset-password', component: () => import('../views/ResetPasswordView.vue'), meta: { publicOnly: true } },
    { path: '/setup', component: () => import('../views/BootstrapSetupView.vue'), meta: { requiresBootstrap: true } },
    { path: '/', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/audio', component: () => import('../views/AudioListView.vue'), meta: { requiresAuth: true } },
    { path: '/audio/new', component: () => import('../views/AudioFormView.vue'), meta: { requiresAuth: true } },
    { path: '/audio/:id/edit', component: () => import('../views/AudioFormView.vue'), meta: { requiresAuth: true } },
    { path: '/articles', component: () => import('../views/ArticlesListView.vue'), meta: { requiresAuth: true } },
    { path: '/articles/new', component: () => import('../views/ArticleFormView.vue'), meta: { requiresAuth: true } },
    { path: '/articles/:id/edit', component: () => import('../views/ArticleFormView.vue'), meta: { requiresAuth: true } },
    { path: '/album', component: () => import('../views/AlbumView.vue'), meta: { requiresAuth: true } },
    { path: '/categories', component: () => import('../views/CategoriesView.vue'), meta: { requiresAuth: true } },
    { path: '/tags', component: () => import('../views/TagsView.vue'), meta: { requiresAuth: true } },
    { path: '/analytics', component: () => import('../views/AnalyticsView.vue'), meta: { requiresAuth: true } },
    { path: '/invite-codes', component: () => import('../views/InviteCodesView.vue'), meta: { requiresAuth: true } },
    { path: '/audit-logs', component: () => import('../views/AuditLogsView.vue'), meta: { requiresAuth: true } },
    { path: '/profile', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
    { path: '/users', component: () => import('../views/UsersListView.vue'), meta: { requiresAuth: true } },
    { path: '/users/new', component: () => import('../views/UserFormView.vue'), meta: { requiresAuth: true } },
    { path: '/users/:id/edit', component: () => import('../views/UserFormView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/notifications', component: () => import('../views/NotificationSettingsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/legal', redirect: '/settings/legal/privacy', meta: { requiresAuth: true } },
    { path: '/settings/legal/privacy', component: () => import('../views/PrivacySettingsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/legal/terms', component: () => import('../views/TermsSettingsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/notifications/pipeline', component: () => import('../views/NotificationPipelineView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/smtp', component: () => import('../views/SmtpSettingsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/storage', component: () => import('../views/StorageView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/backup-restore', component: () => import('../views/BackupRestoreView.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.initialize()
  }

  if (!to.matched.length) {
    return auth.isAuthenticated ? auth.getDefaultRoute() : '/login'
  }

  if (to.meta.requiresBootstrap && !auth.isBootstrapMode) {
    return auth.isAuthenticated ? auth.getDefaultRoute() : '/login'
  }

  if (to.meta.requiresAuth && !auth.isAdminMode) {
    if (auth.isBootstrapMode) {
      return '/setup'
    }

    return {
      path: '/login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
    }
  }

  if (to.meta.publicOnly && auth.isAuthenticated) {
    return auth.getDefaultRoute()
  }
})

export default router
