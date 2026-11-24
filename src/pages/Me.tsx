import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bug,
  ChevronRight,
  Database,
  Download,
  FileJson,
  Info,
  Moon,
  Palette,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  clearAllData,
  db,
  exportBackup,
  importBackup,
} from '../lib/db'
import { APP_LOGO, APP_NAME, APP_VERSION, COLORS } from '../lib/constants'
import { useAppStore } from '../lib/store'
import { downloadFile, formatDateTime, formatDuration } from '../lib/utils'
import { Sheet } from '../components/ui'
import type { BackupData } from '../types'

export function Me() {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const showToast = useAppStore((state) => state.showToast)

  const questions = useLiveQuery(() => db.questions.toArray(), [], [])
  const wrongList = useLiveQuery(() => db.wrongQuestions.toArray(), [], [])
  const exams = useLiveQuery(() => db.examRecords.orderBy('finishedAt').reverse().toArray(), [], [])
  const documents = useLiveQuery(() => db.documents.toArray(), [], [])

  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => {
    const favorite = questions.filter((question) => question.favorite).length
    const mastered = wrongList.filter((item) => !!item.masteredAt).length
    const activeWrong = wrongList.filter((item) => !item.masteredAt).length
    const average = exams.length
      ? Math.round(exams.reduce((sum, exam) => sum + exam.score, 0) / exams.length)
      : 0
    return { favorite, mastered, activeWrong, average }
  }, [questions, wrongList, exams])

  const doExport = async () => {
    setBusy(true)
    try {
      const data = await exportBackup()
      const stamp = new Date()
      const name = `题Kit备份-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(
        stamp.getDate(),
      ).padStart(2, '0')}.json`
      downloadFile(name, JSON.stringify(data))
      showToast(`已导出 ${data.questions.length} 道题`, 'success')
    } catch {
      showToast('导出失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const readBackup = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as BackupData
      if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
        throw new Error('不是有效的备份文件')
      }
      if (data.version !== 1) throw new Error('备份版本不兼容')
      setPending(data)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '读取备份失败', 'error')
    }
  }

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    setBusy(true)
    try {
      await importBackup(pending, mode)
      setPending(null)
      showToast(mode === 'replace' ? '备份已恢复' : '备份已合并', 'success')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '恢复失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const accent = COLORS[settings.accent] ?? COLORS.sky

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">我的</p>
          <h1>本地数据与设置</h1>
        </div>
        <img
          src={APP_LOGO}
          alt={APP_NAME}
          width={42}
          height={42}
          style={{ borderRadius: 12, objectFit: 'cover' }}
        />
      </header>

      <div className="card" style={{ background: accent.bg, borderColor: accent.border }}>
        <div className="row" style={{ gap: 14 }}>
          <div
            className="type-dot"
            style={{ width: 46, height: 46, background: accent.solid, color: '#fff' }}
          >
            <ShieldCheck size={22} />
          </div>
          <div style={{ color: accent.text }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>完全离线</div>
            <div style={{ fontSize: 12.5, opacity: 0.82 }}>
              题目与作答只保存在这台设备，没有账号，也不会上传。
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <strong>{questions.length}</strong>
          <span>题目</span>
        </div>
        <div className="stat">
          <strong>{stats.activeWrong}</strong>
          <span>错题待复习</span>
        </div>
        <div className="stat">
          <strong>{stats.average || '—'}</strong>
          <span>{stats.average ? '平均得分率' : '还没练习'}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>数据备份</h3>
          <span className="badge">{questions.length} 题</span>
        </div>
        <p className="tiny" style={{ marginBottom: 12 }}>
          备份包含题库、题集、错题与练习记录。换手机或清理浏览器前先导出一份。
        </p>
        <div className="grid-2">
          <button className="btn btn-primary" onClick={doExport} disabled={busy}>
            <Download size={16} />
            导出备份
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload size={16} />
            恢复备份
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readBackup(file)
              event.target.value = ''
            }}
          />
        </div>
        <div className="row" style={{ gap: 6, marginTop: 12 }}>
          <FileJson size={14} color="var(--ink-3)" />
          <span className="tiny">
            共 {documents.length} 次导入 · {exams.length} 次练习
          </span>
        </div>
      </div>

      <div className="card flush">
        <div style={{ padding: '14px 16px' }}>
          <h3 style={{ fontSize: 15 }}>设置</h3>
        </div>
        <div className="list" style={{ padding: '0 16px' }}>
          <Link className="list-row" to="/settings">
            <Palette size={18} color="var(--ink-2)" />
            <div className="grow">
              <div className="title" style={{ fontWeight: 600 }}>
                外观与判分
              </div>
              <div className="tiny">
                {COLORS[settings.accent]?.name ?? '天蓝'} · {settings.dark ? '深色' : '浅色'} ·{' '}
                {settings.partialFill ? '逐空给分' : '全对才得分'}
              </div>
            </div>
            <ChevronRight size={16} color="var(--ink-3)" />
          </Link>
          <button className="list-row" onClick={() => navigate('/settings')}>
            <Settings2 size={18} color="var(--ink-2)" />
            <div className="grow">
              <div className="title" style={{ fontWeight: 600 }}>
                判分与刷题偏好
              </div>
              <div className="tiny">
                自动下一题 · 默认 {settings.defaultCount} 题 · 字号 {settings.fontSize}px
              </div>
            </div>
            <ChevronRight size={16} color="var(--ink-3)" />
          </button>
          <Link className="list-row" to="/debug/parser">
            <Bug size={18} color="var(--ink-2)" />
            <div className="grow">
              <div className="title" style={{ fontWeight: 600 }}>
                解析器调试
              </div>
              <div className="tiny">粘贴文本查看解析细节与未识别片段</div>
            </div>
            <ChevronRight size={16} color="var(--ink-3)" />
          </Link>
          <button className="list-row" onClick={() => navigate('/import')}>
            <Sparkles size={18} color="var(--ink-2)" />
            <div className="grow">
              <div className="title" style={{ fontWeight: 600 }}>
                重新导入示例题库
              </div>
              <div className="tiny">用 9 道示例题体验完整流程</div>
            </div>
            <ChevronRight size={16} color="var(--ink-3)" />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>最近练习</h3>
          {exams.length > 0 && <span className="tiny">共 {exams.length} 次</span>}
        </div>
        {exams.length === 0 ? (
          <p className="muted" style={{ fontSize: 13.5 }}>
            完成一次练习后，这里会显示得分与用时。
          </p>
        ) : (
          <div className="list">
            {exams.slice(0, 5).map((exam) => (
              <button
                key={exam.id}
                className="list-row"
                onClick={() => navigate(`/result/${exam.id}`)}
              >
                <div
                  className="type-dot"
                  style={{
                    background: exam.score >= 85 ? 'var(--success-soft)' : 'var(--surface-2)',
                    color: exam.score >= 85 ? 'var(--success)' : 'var(--ink-2)',
                    width: 38,
                    height: 38,
                  }}
                >
                  {exam.score}
                </div>
                <div className="grow">
                  <div className="title" style={{ fontWeight: 600 }}>
                    {exam.title}
                  </div>
                  <div className="tiny">
                    {exam.total} 题 · {formatDuration(exam.elapsedSec)} ·{' '}
                    {formatDateTime(exam.finishedAt)}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--ink-3)" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row-between">
          <div className="row" style={{ gap: 10 }}>
            <Database size={18} color="var(--ink-2)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>本机存储</div>
              <div className="tiny">Dexie / IndexedDB，随浏览器清理而删除</div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>
            <Trash2 size={14} />
            清空
          </button>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <img
          src={APP_LOGO}
          alt={APP_NAME}
          width={52}
          height={52}
          style={{ borderRadius: 15, objectFit: 'cover', margin: '0 auto 8px' }}
        />
        <div style={{ fontWeight: 800, fontSize: 16 }}>{APP_NAME}</div>
        <div className="tiny">v{APP_VERSION} · 离线优先</div>
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 10 }}>
          <span className="tiny row" style={{ gap: 4 }}>
            <Moon size={13} /> 深色模式
          </span>
          <span className="tiny row" style={{ gap: 4 }}>
            <Info size={13} /> 无网络权限
          </span>
          <span className="tiny row" style={{ gap: 4 }}>
            <RotateCcw size={13} /> 手动备份
          </span>
        </div>
      </div>

      <Sheet
        open={!!pending}
        title="恢复备份"
        onClose={() => setPending(null)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setPending(null)}>
              取消
            </button>
            <button className="btn btn-primary btn-block" onClick={() => doImport('merge')} disabled={busy}>
              合并导入
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="muted" style={{ fontSize: 14 }}>
            备份中有 <strong>{pending?.questions.length ?? 0}</strong> 道题、
            <strong>{pending?.questionSets.length ?? 0}</strong> 个题集、
            <strong>{pending?.examRecords.length ?? 0}</strong> 条练习记录。
          </p>
          <div className="alert">
            <Info size={16} />
            <span>
              「合并导入」保留现有数据；「覆盖恢复」会先清空当前数据再导入，适合换设备。
            </span>
          </div>
          <button className="btn btn-danger btn-block" onClick={() => doImport('replace')} disabled={busy}>
            覆盖恢复（清空现有数据）
          </button>
        </div>
      </Sheet>

      <Sheet
        open={confirmClear}
        title="清空全部数据？"
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setConfirmClear(false)}>
              取消
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                await clearAllData()
                setConfirmClear(false)
                showToast('数据已清空')
                navigate('/')
              }}
            >
              确认清空
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="muted" style={{ fontSize: 14 }}>
            会删除全部题目、题集、错题和练习记录，且无法撤销。
          </p>
          <div className="alert error">
            <Trash2 size={16} />
            <span>建议先导出备份，再执行清空。</span>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
