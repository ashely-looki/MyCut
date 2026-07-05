import { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SettingsPage from './pages/SettingsPage'
import ScriptEditorPage from './pages/ScriptEditorPage'
import ScriptLibraryPage from './pages/ScriptLibraryPage'
import Header from './components/Header'
import { trackPageview } from './analytics/posthog'

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

  return (
    <Layout>
      <Header />
      <Content>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* 热点已并入首页，旧链接重定向 */}
          <Route path="/hotspots" element={<Navigate to="/" replace />} />
          <Route path="/scripts" element={<ScriptLibraryPage />} />
          <Route path="/script" element={<ScriptEditorPage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
