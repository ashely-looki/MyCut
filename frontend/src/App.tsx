import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Layout, Spin } from 'antd'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SettingsPage from './pages/SettingsPage'
import HotspotPage from './pages/HotspotPage'
import ScriptEditorPage from './pages/ScriptEditorPage'
import ScriptLibraryPage from './pages/ScriptLibraryPage'
import LoginPage from './pages/LoginPage'
import MembershipPage from './pages/MembershipPage'
import AdminPage from './pages/AdminPage'
import Header from './components/Header'
import { trackPageview } from './analytics/posthog'
import { useAuth } from './context/AuthContext'

const { Content } = Layout

// HashRouter 下手动上报 pageview（init 时已关闭自动 pageview）
function usePageviewTracking() {
  const location = useLocation()
  useEffect(() => {
    trackPageview(location.pathname + location.search)
  }, [location.pathname, location.search])
}

function App() {
  console.log('🎬 App组件已加载');
  usePageviewTracking()
  const { authEnabled, loading, user } = useAuth()

  // 认证启用时，会话还在恢复中 → 先给一个安静的加载态，避免闪一下登录页
  if (authEnabled && loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ac-bg)',
        }}
      >
        <Spin />
      </div>
    )
  }

  // 认证启用且未登录 → 登录门（挡住整个应用，包括 Header）
  if (authEnabled && !user) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Header />
      <Content>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* 查热点全页（首页入口卡片进入）：查热点→大纲→文案→保存 */}
          <Route path="/hotspots" element={<HotspotPage />} />
          <Route path="/scripts" element={<ScriptLibraryPage />} />
          <Route path="/script" element={<ScriptEditorPage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/membership" element={<MembershipPage />} />
          {/* 管理者后台：入口按 isAdmin 显示，页面内也会二次拦截非管理员 */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
