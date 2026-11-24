import { useEffect } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { COLORS } from './lib/constants'
import { useAppStore } from './lib/store'
import { requestPersistentStorage } from './lib/db'
import { Layout } from './components/Layout'
import { Toast } from './components/Toast'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { SetDetail } from './pages/SetDetail'
import { ImportPage } from './pages/ImportPage'
import { PracticeSetup } from './pages/PracticeSetup'
import { PracticeSession } from './pages/PracticeSession'
import { Result } from './pages/Result'
import { Wrong } from './pages/Wrong'
import { Me } from './pages/Me'
import { SettingsPage } from './pages/Settings'
import { DebugParser } from './pages/DebugParser'

function ThemeSync() {
  const settings = useAppStore((state) => state.settings)

  useEffect(() => {
    const palette = COLORS[settings.accent] ?? COLORS.sky
    const root = document.documentElement
    root.style.setProperty('--accent', palette.text)
    root.style.setProperty('--stem-size', `${settings.fontSize}px`)
    root.dataset.dark = String(settings.dark)
    root.style.colorScheme = settings.dark ? 'dark' : 'light'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', settings.dark ? '#161512' : '#FBFAF6')
  }, [settings.accent, settings.dark, settings.fontSize])

  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  return null
}

function NotFound() {
  return (
    <div className="shell">
      <main className="main">
        <div className="empty" style={{ paddingTop: 80 }}>
          <div className="empty-icon">404</div>
          <h3>页面不存在</h3>
          <p>链接可能已经失效，回首页继续刷题吧。</p>
          <Link className="btn btn-primary" to="/">
            返回首页
          </Link>
        </div>
      </main>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/sets/:id" element={<SetDetail />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/practice" element={<PracticeSetup />} />
          <Route path="/wrong" element={<Wrong />} />
          <Route path="/me" element={<Me />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/debug/parser" element={<DebugParser />} />
        </Route>
        <Route path="/practice/session" element={<PracticeSession />} />
        <Route path="/result/:id" element={<Result />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toast />
    </HashRouter>
  )
}
