import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/forgot-password', component: () => import('../views/ForgotPasswordView.vue') },
    { path: '/reset-password', component: () => import('../views/ResetPasswordView.vue') },
    { path: '/', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/audio', component: () => import('../views/AudioListView.vue'), meta: { requiresAuth: true } },
    { path: '/audio/new', component: () => import('../views/AudioFormView.vue'), meta: { requiresAuth: true } },
    { path: '/audio/:id/edit', component: () => import('../views/AudioFormView.vue'), meta: { requiresAuth: true } },
    { path: '/articles', component: () => import('../views/ArticlesListView.vue'), meta: { requiresAuth: true } },
    { path: '/articles/new', component: () => import('../views/ArticleFormView.vue'), meta: { requiresAuth: true } },
    { path: '/articles/:id/edit', component: () => import('../views/ArticleFormView.vue'), meta: { requiresAuth: true } },
    { path: '/categories', component: () => import('../views/CategoriesView.vue'), meta: { requiresAuth: true } },
    { path: '/tags', component: () => import('../views/TagsView.vue'), meta: { requiresAuth: true } },
    { path: '/analytics', component: () => import('../views/AnalyticsView.vue'), meta: { requiresAuth: true } },
    { path: '/audit-logs', component: () => import('../views/AuditLogsView.vue'), meta: { requiresAuth: true } },
    { path: '/profile', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
    { path: '/users', component: () => import('../views/UsersListView.vue'), meta: { requiresAuth: true } },
    { path: '/users/new', component: () => import('../views/UserFormView.vue'), meta: { requiresAuth: true } },
    { path: '/users/:id/edit', component: () => import('../views/UserFormView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/smtp', component: () => import('../views/SmtpSettingsView.vue'), meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login'
  }
})

export default router
