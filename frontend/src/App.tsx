import { useEffect, useLayoutEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import restartCircleLinear from '@iconify-icons/solar/restart-circle-linear'
import { Route, Routes, useLocation } from 'react-router-dom'

import { trackPageview } from '@/analytics/posthog'
import { AppShellHeader } from '@/components/app-shell-header'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import AdminPage from '@/pages/AdminPage'
import HomePage from '@/pages/HomePage'
import HotspotPage from '@/pages/HotspotPage'
import LoginPage from '@/pages/LoginPage'
import MembershipPage from '@/pages/MembershipPage'
import ManagePage from '@/pages/ManagePage'
import ProcessingPage from '@/pages/ProcessingPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ScriptEditorPage from '@/pages/ScriptEditorPage'
import ScriptLibraryPage from '@/pages/ScriptLibraryPage'
import SettingsPage from '@/pages/SettingsPage'

const LOCAL_APP_PREVIEW_KEY = 'mycut-local-app-preview'

function usePageviewTracking() {
  const location = useLocation()

  useEffect(() => {
    trackPageview(location.pathname + location.search)
  }, [location.pathname, location.search])
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<ScriptEditorPage />} />
      <Route path="/manage" element={<ManagePage />} />
      <Route path="/hotspots" element={<HotspotPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/scripts" element={<ScriptLibraryPage />} />
      <Route path="/script" element={<ScriptEditorPage />} />
      <Route path="/processing/:id" element={<ProcessingPage />} />
      <Route path="/project/:id" element={<ProjectDetailPage />} />
      <Route path="/membership" element={<MembershipPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

function App() {
  usePageviewTracking()
  const location = useLocation()
  const pageViewportRef = useRef<HTMLDivElement>(null)
  const { authEnabled, loading, user } = useAuth()
  const previewMode = new URLSearchParams(location.search).get('preview')
  const isCreationWorkspace = location.pathname === '/create' || location.pathname === '/script'
  const hasLocalAppPreview =
    import.meta.env.DEV &&
    sessionStorage.getItem(LOCAL_APP_PREVIEW_KEY) === 'true'

  useEffect(() => {
    if (!import.meta.env.DEV || authEnabled) return

    if (previewMode === 'home') {
      sessionStorage.setItem(LOCAL_APP_PREVIEW_KEY, 'true')
    } else if (previewMode === 'login') {
      sessionStorage.removeItem(LOCAL_APP_PREVIEW_KEY)
    }
  }, [authEnabled, previewMode])

  useLayoutEffect(() => {
    const viewport = pageViewportRef.current
    if (!viewport) return
    viewport.scrollTop = 0
    viewport.scrollLeft = 0
  }, [location.pathname])

  const showLocalAppPreview =
    import.meta.env.DEV &&
    !authEnabled &&
    previewMode !== 'login' &&
    (previewMode === 'home' || hasLocalAppPreview)
  const showLocalAuthPreview =
    import.meta.env.DEV &&
    !authEnabled &&
    import.meta.env.VITE_AUTH_PREVIEW === 'true' &&
    !showLocalAppPreview

  if (authEnabled && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--workspace-background)]">
        <span className="brand-gradient flex size-11 items-center justify-center rounded-2xl text-white shadow-[var(--brand-card-shadow)]">
          <Icon icon={restartCircleLinear} className="size-5 motion-safe:animate-spin" />
        </span>
      </div>
    )
  }

  if ((authEnabled && !user) || showLocalAuthPreview) {
    return <LoginPage />
  }

  return (
    <SidebarProvider className="mycut-app-shell h-svh min-h-0 overflow-hidden bg-sidebar">
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-background">
        <AppShellHeader />
        <div
          ref={pageViewportRef}
          className={`mycut-page-viewport min-h-0 min-w-0 flex-1 overflow-x-hidden ${
            isCreationWorkspace
              ? 'overflow-y-auto lg:overflow-y-hidden'
              : location.pathname === '/'
                ? 'overflow-y-auto'
                : 'overflow-y-scroll'
          }`}
          style={location.pathname === '/' ? { scrollbarGutter: 'auto' } : undefined}
        >
          <AppRoutes />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
