// ─── PUNTO DE ENTRADA — ENRUTAMIENTO PRINCIPAL ─────────────────
// Define la topología de rutas de la plataforma SaaS:
//
//   /           → Landing pública (StorefrontPage)
//   /login      → Login Universal (redirige por rol)
//   /admin/*    → Panel de control protegido por RBAC
//   /mi-cuenta  → Zona de cliente (futuro)
//
// ARQUITECTURA:
//   • TenantProvider es GLOBAL — una sola instancia envuelve todo
//     el árbol. Esto elimina queries duplicadas y permite que
//     login, admin y storefront compartan el mismo contexto.
//   • AuthProvider envuelve TenantProvider para que el perfil
//     del usuario esté disponible en todo el árbol.
//
// MODELO DE NIVELES (Nuevo):
//   NIVEL 1: Acceso total a /admin (Dashboard, Catálogo, Pedidos,
//            Equipo, Store Builder). Ventas vía WhatsApp.
//   NIVEL 2: + Pasarela Stripe/PayPal, Guest Checkout, Push.
//   NIVEL 3: + Logística, GPS, App Repartidores.
// ────────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { TenantProvider, useTenant } from './context/TenantContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { isPlatformDomain } from './lib/domain.ts'
import FeatureGate from './components/FeatureGate.tsx'
import RoleProtectedRoute from './components/auth/RoleProtectedRoute.tsx'
import { RoleGuard } from './components/auth/RoleGuard.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastContainer } from './components/ui/ToastContainer.tsx'
import { Loader2 } from 'lucide-react'
import './index.css'
import '@tabler/icons-webfont/dist/tabler-icons.min.css';

// Lazy Loading de páginas para Code Splitting (Mejora de rendimiento)
const StorefrontPage = lazy(() => import('./pages/public/StorefrontPage.tsx'))
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage.tsx'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage.tsx'))
const SaasLandingPage = lazy(() => import('./pages/public/SaasLandingPage.tsx'))
const StoreNotFoundPage = lazy(() => import('./pages/public/StoreNotFoundPage.tsx'))
const GuestTrackingPage = lazy(() => import('./pages/public/GuestTrackingPage.tsx'))
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage.tsx'))
const CustomerAccountPage = lazy(() => import('./pages/storefront/CustomerAccountPage.tsx'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.tsx'))
const AdminPedidos = lazy(() => import('./pages/admin/AdminPedidos.tsx'))
const AdminProductos = lazy(() => import('./pages/admin/AdminProductos.tsx'))
const AdminEquipo = lazy(() => import('./pages/admin/AdminEquipo.tsx'))
const AdminConfiguracion = lazy(() => import('./pages/admin/AdminConfiguracion.tsx'))
const AdminReportes = lazy(() => import('./pages/admin/AdminReportes.tsx'))
const AdminNotificaciones = lazy(() => import('./pages/admin/AdminNotificaciones.tsx'))
const AdminRepartidores = lazy(() => import('./pages/admin/AdminRepartidores.tsx'))
const SuperadminDashboard = lazy(() => import('./pages/superadmin/SuperadminDashboard.tsx'))
const SuperadminSuscripciones = lazy(() => import('./pages/superadmin/SuperadminSuscripciones.tsx'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout.tsx'))
const SuperadminLayout = lazy(() => import('./layouts/SuperadminLayout.tsx'))
const StorefrontLayout = lazy(() => import('./layouts/StorefrontLayout.tsx'))

const LoadingScreen = () => (
  <div className="min-h-screen bg-[var(--color-background-secondary)] flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
  </div>
)

// ── RootRouter ─────────────────────────────────────────────────────
// Decide qué página mostrar en la ruta raíz ("/") basándose
// en el estado de resolución del tenant (TenantContext.status).
//
// • 'platform'  → SaasLandingPage (botaniq.com, localhost, staging base)
// • 'ready'     → StorefrontPage  (flores.botaniq.com, custom domain)
// • 'not_found' → StoreNotFoundPage (subdominio inválido)
// • 'loading'   → LoadingScreen (spinner mientras resuelve)
// ────────────────────────────────────────────────────────────────
function RootRouter() {
  const { status } = useTenant()

  if (status === 'loading')    return <LoadingScreen />
  if (status === 'not_found')  return <StoreNotFoundPage />

  // Si estamos en el dominio de producción/staging real de la plataforma (no localhost),
  // siempre mostramos la landing page del SaaS en la ruta raíz.
  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  if (!isLocal && isPlatformDomain(hostname)) {
    return <SaasLandingPage />
  }

  if (status === 'platform')   return <SaasLandingPage />
  if (status === 'ready')      return <StorefrontPage />

  return <LoadingScreen /> // Fallback defensivo
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <AuthProvider>
      {/* ── FIX DT-03: TenantProvider global único ────────────────
          Una sola instancia envuelve TODO el BrowserRouter.
          Elimina el fetch duplicado a Supabase y permite que
          /login y /admin compartan el mismo TenantConfig. */}
      <TenantProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* 🌐 Ruta Raíz — Resolución dinámica por hostname
                    RootRouter evalúa TenantContext.status para decidir
                    entre SaasLandingPage, StorefrontPage o StoreNotFoundPage. */}
                <Route element={<StorefrontLayout />}>
                  <Route path="/" element={<RootRouter />} />
                  <Route path="/demo" element={<StorefrontPage />} />
                  <Route path="/producto/:slug" element={<ProductDetailPage />} />
                  <Route path="/rastreo" element={<GuestTrackingPage />} />
                </Route>
                <Route path="/plataforma" element={<SaasLandingPage />} />

                {/* 🔑 Login Universal — redirige por rol
                    Clientes → /mi-cuenta, Dueños/Staff → /admin */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />

                {/* 👤 Zona Cliente (Nivel 2)
                    Protegido para que solo clientes logueados accedan. */}
                <Route 
                  path="/mi-cuenta" 
                  element={
                    <RoleProtectedRoute allowedRoles={['cliente']}>
                      <CustomerAccountPage />
                    </RoleProtectedRoute>
                  } 
                />

                {/* ─────────────────────────────────────────────────────────
                    🛡️ Zona Admin — Dashboard SaaS (Protegida por RBAC)
                    
                    FIX DT-05: Incluimos 'empleado' en allowedRoles.
                    En el nuevo modelo, Nivel 1 = acceso total a /admin.
                    ───────────────────────────────────────────────────────── */}
                <Route 
                  path="/admin" 
                  element={
                    <RoleProtectedRoute allowedRoles={['superadmin', 'dueño', 'empleado']} />
                  }
                >
                  <Route element={<AdminLayout />}>
                    {/* NIVEL 1: Dashboard — siempre disponible */}
                    <Route index element={<AdminDashboardPage />} />

                    {/* NIVEL 1: Gestión de pedidos.
                        Tabla completa con filtros de estado, buscador y panel
                        lateral de detalle (datos_envio + pedido_items). */}
                    <Route path="pedidos" element={<AdminPedidos />} />

                    {/* NIVEL 1: Gestión de Catálogo y Variantes. */}
                    <Route path="catalogo" element={<AdminProductos />} />

                    {/* NIVEL 2: Gestión de Equipo. */}
                    <Route 
                      path="equipo" 
                      element={
                        <FeatureGate requiredLevel={2} fallback={<Navigate to="/admin" replace />}>
                          <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                            <AdminEquipo />
                          </RoleGuard>
                        </FeatureGate>
                      } 
                    />

                    {/* NIVEL 1: Configuración / Store Builder refactorizado en secciones directas */}
                    <Route path="ajustes" element={<Navigate to="diseno" replace />} />
                    <Route 
                      path="diseno" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="tema" />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="contenido" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="contenido" />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="seo" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="general" />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="cobertura" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="cobertura" />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="horarios" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="horarios" />
                        </RoleGuard>
                      } 
                    />
                    <Route 
                      path="pagos" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminConfiguracion section="pagos" />
                        </RoleGuard>
                      } 
                    />

                    {/* NIVEL 1: Reportes */}
                    <Route 
                      path="reportes" 
                      element={
                        <RoleGuard allowedRoles={['dueño', 'superadmin']}>
                          <AdminReportes />
                        </RoleGuard>
                      } 
                    />

                    {/* NIVEL 1: Notificaciones */}
                    <Route path="notificaciones" element={<AdminNotificaciones />} />

                    {/* NIVEL 3: Repartidores */}
                    <Route 
                      path="repartidores" 
                      element={
                        <FeatureGate requiredLevel={4} fallback={<Navigate to="/admin" replace />}>
                          <AdminRepartidores />
                        </FeatureGate>
                      } 
                    />
                  </Route>
                </Route>

                {/* ─────────────────────────────────────────────────────────
                    ⚡ Zona Superadmin — Control Global del SaaS
                    
                    Panel exclusivo para el dueño de la plataforma.
                    Tema oscuro con violeta para diferenciarlo visualmente.
                    Solo accesible con rol 'superadmin'.
                    ───────────────────────────────────────────────────────── */}
                <Route 
                  path="/superadmin" 
                  element={
                    <RoleProtectedRoute allowedRoles={['superadmin']} />
                  }
                >
                  <Route element={<SuperadminLayout />}>
                    <Route index element={<SuperadminDashboard />} />
                    <Route path="suscripciones" element={<SuperadminSuscripciones />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
            <ToastContainer />
          </BrowserRouter>
        </ThemeProvider>
      </TenantProvider>
    </AuthProvider>
    </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
)
