import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookX, Home, LibraryBig, Plus, UserRound } from 'lucide-react'
import { APP_LOGO, APP_NAME, APP_TAGLINE } from '../lib/constants'
import { useAppStore } from '../lib/store'

const NAV = [
  { to: '/', label: '首页', icon: Home },
  { to: '/library', label: '题库', icon: LibraryBig },
  { to: '/wrong', label: '错题', icon: BookX },
  { to: '/me', label: '我的', icon: UserRound },
]

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const editMode = useAppStore((state) => state.editMode)
  const libraryBrowsing = pathname === '/library' && !editMode
  const showFab = pathname === '/' || (pathname === '/library' && editMode)

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <img src={APP_LOGO} alt={APP_NAME} />
          <div>
            <div className="brand-name">{APP_NAME}</div>
            <div className="brand-tag">{APP_TAGLINE}</div>
          </div>
        </Link>

        {!libraryBrowsing && (
          <button className="btn btn-primary btn-block" onClick={() => navigate('/import')}>
            <Plus size={17} />
            导入题目
          </button>
        )}

        <nav className="side-nav" style={{ marginTop: 10 }}>
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.to} to={item.to} data-active={isActive(pathname, item.to)}>
                <Icon size={18} strokeWidth={2.1} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="side-foot">
          100% 离线运行
          <br />
          文件与作答数据只保存在本机
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.to} to={item.to} data-active={isActive(pathname, item.to)}>
              <span className="nav-icon">
                <Icon size={20} strokeWidth={2.1} />
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {showFab && (
        <button className="fab" aria-label="导入题目" onClick={() => navigate('/import')}>
          <Plus size={25} />
        </button>
      )}
    </div>
  )
}
