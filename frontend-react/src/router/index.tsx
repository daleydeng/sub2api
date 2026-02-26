import {
  createRouter,
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout'

// --- Root ---

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: lazyRouteComponent(() => import('@/views/NotFoundView')),
})

// --- Public routes ---

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home',
  component: lazyRouteComponent(() => import('@/views/HomeView')),
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: lazyRouteComponent(() => import('@/views/setup/SetupWizardView')),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    const { isAuthenticated, isAdmin } = useAuthStore.getState()
    if (isAuthenticated) {
      return { redirect: isAdmin ? '/admin/dashboard' : '/dashboard' }
    }
  },
  component: lazyRouteComponent(() => import('@/views/auth/LoginView')),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: () => {
    const { isAuthenticated, isAdmin } = useAuthStore.getState()
    if (isAuthenticated) {
      return { redirect: isAdmin ? '/admin/dashboard' : '/dashboard' }
    }
  },
  component: lazyRouteComponent(() => import('@/views/auth/RegisterView')),
})

const emailVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/email-verify',
  component: lazyRouteComponent(() => import('@/views/auth/EmailVerifyView')),
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: lazyRouteComponent(() => import('@/views/auth/OAuthCallbackView')),
})

const linuxdoCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/linuxdo/callback',
  component: lazyRouteComponent(() => import('@/views/auth/LinuxDoCallbackView')),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: lazyRouteComponent(() => import('@/views/auth/ForgotPasswordView')),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(() => import('@/views/auth/ResetPasswordView')),
})

// --- Auth layout (requires login) ---

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      return { redirect: '/login' }
    }
  },
  component: () => <AppLayout />,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/dashboard',
  component: lazyRouteComponent(() => import('@/views/user/DashboardView')),
})

const keysRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/keys',
  component: lazyRouteComponent(() => import('@/views/user/KeysView')),
})

const usageRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/usage',
  component: lazyRouteComponent(() => import('@/views/user/UsageView')),
})

const redeemRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/redeem',
  component: lazyRouteComponent(() => import('@/views/user/RedeemView')),
})

const profileRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('@/views/user/ProfileView')),
})

const subscriptionsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/subscriptions',
  component: lazyRouteComponent(() => import('@/views/user/SubscriptionsView')),
})

const purchaseRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/purchase',
  component: lazyRouteComponent(() => import('@/views/user/PurchaseSubscriptionView')),
})

// --- Admin layout (requires admin role) ---

const adminLayoutRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  id: 'admin',
  beforeLoad: () => {
    const { isAdmin } = useAuthStore.getState()
    if (!isAdmin) {
      return { redirect: '/dashboard' }
    }
  },
  component: () => <Outlet />,
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin',
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/dashboard',
  component: lazyRouteComponent(() => import('@/views/admin/DashboardView')),
})

const adminOpsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/ops',
  component: lazyRouteComponent(() => import('@/views/admin/ops/OpsDashboard')),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/users',
  component: lazyRouteComponent(() => import('@/views/admin/UsersView')),
})

const adminGroupsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/groups',
  component: lazyRouteComponent(() => import('@/views/admin/GroupsView')),
})

const adminSubscriptionsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/subscriptions',
  component: lazyRouteComponent(() => import('@/views/admin/SubscriptionsView')),
})

const adminAccountsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/accounts',
  component: lazyRouteComponent(() => import('@/views/admin/AccountsView')),
})

const adminAnnouncementsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/announcements',
  component: lazyRouteComponent(() => import('@/views/admin/AnnouncementsView')),
})

const adminProxiesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/proxies',
  component: lazyRouteComponent(() => import('@/views/admin/ProxiesView')),
})

const adminRedeemRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/redeem',
  component: lazyRouteComponent(() => import('@/views/admin/RedeemView')),
})

const adminPromoCodesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/promo-codes',
  component: lazyRouteComponent(() => import('@/views/admin/PromoCodesView')),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/settings',
  component: lazyRouteComponent(() => import('@/views/admin/SettingsView')),
})

const adminUsageRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/usage',
  component: lazyRouteComponent(() => import('@/views/admin/UsageView')),
})

// --- Route tree ---

const routeTree = rootRoute.addChildren([
  indexRoute,
  homeRoute,
  setupRoute,
  loginRoute,
  registerRoute,
  emailVerifyRoute,
  authCallbackRoute,
  linuxdoCallbackRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  authLayoutRoute.addChildren([
    dashboardRoute,
    keysRoute,
    usageRoute,
    redeemRoute,
    profileRoute,
    subscriptionsRoute,
    purchaseRoute,
    adminLayoutRoute.addChildren([
      adminIndexRoute,
      adminDashboardRoute,
      adminOpsRoute,
      adminUsersRoute,
      adminGroupsRoute,
      adminSubscriptionsRoute,
      adminAccountsRoute,
      adminAnnouncementsRoute,
      adminProxiesRoute,
      adminRedeemRoute,
      adminPromoCodesRoute,
      adminSettingsRoute,
      adminUsageRoute,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default router
