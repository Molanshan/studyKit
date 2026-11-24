import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Download,
  Layers,
  Play,
  Shuffle,
  Sparkles,
  Upload,
} from 'lucide-react'
import { db, importQuestions } from '../lib/db'
import { DEMO_TEXT, parseText } from '../lib/parser'
import { useAppStore } from '../lib/store'
import { formatDate, formatRelative, greeting } from '../lib/utils'
import { COLORS } from '../lib/constants'
import { Logo, TypeBadge } from '../components/ui'

export function Home() {
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)

  const questions = useLiveQuery(() => db.questions.toArray(), [], undefined)
  const wrong = useLiveQuery(() => db.wrongQuestions.filter((item) => !item.masteredAt).toArray(), [], [])
  const sets = useLiveQuery(() => db.questionSets.orderBy('sortOrder').reverse().toArray(), [], undefined)
  const session = useLiveQuery(() => db.sessions.orderBy('updatedAt').last(), [], undefined)
  const exams = useLiveQuery(() => db.examRecords.toArray(), [], [])

  const total = questions?.length ?? 0
  const allSets = sets ?? []
  const averageScore = exams.length
    ? Math.round(exams.reduce((sum, exam) => sum + exam.score, 0) / exams.length)
    : 0
  const recent = [...(questions ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0]

  const counts = new Map<string, number>()
  for (const question of questions ?? []) {
    for (const setId of question.setIds) counts.set(setId, (counts.get(setId) ?? 0) + 1)
  }

  const loadDemo = async () => {
    const existing = await db.questionSets.where('name').equals('示例题库').first()
    if (existing) {
      showToast('示例题库已经在题库里了')
      navigate(`/sets/${existing.id}`)
      return
    }
    const result = parseText(DEMO_TEXT)
    await importQuestions(result.questions, {
      title: '题Kit 示例题库',
      sourceType: 'demo',
      set: { name: '示例题库', color: 'sky' },
    })
    showToast('示例题库已载入，直接开刷', 'success')
    navigate('/library')
  }

  if (questions === undefined || sets === undefined) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">
              {greeting()} · {formatDate(Date.now())}
            </p>
            <h1>把复习题变成题库</h1>
          </div>
          <Logo size={42} />
        </header>
        <div className="card">
          <p className="muted" style={{ fontSize: 13.5 }}>
            正在读取本地题库…
          </p>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">
              {greeting()} · {formatDate(Date.now())}
            </p>
            <h1>把复习题变成题库</h1>
          </div>
          <Logo size={42} />
        </header>

        <div className="hero">
          <h2>导入一份 docx，开始刷题</h2>
          <p>自动识别单选、多选、判断、填空、简答，题目只保存在你的设备上。</p>
          <button className="btn" onClick={() => navigate('/import')}>
            <Upload size={17} />
            导入我的复习题
          </button>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>还没有题目？</h3>
            <span className="badge">9 题</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            先用示例题库体验完整流程：答题、判分、错题、逐空给分。
          </p>
          <button className="btn btn-soft btn-block" onClick={loadDemo}>
            <Sparkles size={17} />
            载入示例题库
          </button>
        </div>

        <div className="grid-2">
          <div className="card" style={{ padding: 16 }}>
            <BookOpen size={20} color="var(--accent)" />
            <h3 style={{ marginTop: 8, fontSize: 14 }}>100% 离线</h3>
            <p className="tiny" style={{ marginTop: 4 }}>
              不申请网络权限，文件不出设备
            </p>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <Layers size={20} color="var(--accent)" />
            <h3 style={{ marginTop: 8, fontSize: 14 }}>歌单式题集</h3>
            <p className="tiny" style={{ marginTop: 4 }}>
              一道题可以同时属于多个题集
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {greeting()} · {formatDate(Date.now())}
          </p>
          <h1>今天也刷几道</h1>
        </div>
        <Logo size={42} />
      </header>

      <div className="hero">
        <h2>
          {wrong.length > 0 ? `${wrong.length} 道错题待复习` : '题库已就绪'}
        </h2>
        <p>
          {wrong.length > 0
            ? '考前把错题过一遍，比重新看一遍书更有效。'
            : `共 ${total} 道题，随机来一组保持手感。`}
        </p>
        <button
          className="btn"
          onClick={() =>
            navigate(wrong.length > 0 ? '/practice?source=wrong' : '/practice?source=all')
          }
        >
          <Play size={16} />
          {wrong.length > 0 ? '开始复习错题' : `随机刷 ${Math.min(20, total)} 题`}
        </button>
      </div>

      {session && (
        <button
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate(`/practice/session?id=${session.id}`)}
        >
          <div className="row-between">
            <div className="row">
              <div className="empty-icon" style={{ width: 42, height: 42, borderRadius: 13 }}>
                <Play size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>继续上次练习</div>
                <div className="tiny">
                  {session.title} · {session.currentIndex + 1}/{session.questionIds.length} 题
                </div>
              </div>
            </div>
            <ArrowRight size={18} color="var(--ink-3)" />
          </div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span
              style={{
                width: `${Math.round(((session.currentIndex + 1) / session.questionIds.length) * 100)}%`,
              }}
            />
          </div>
        </button>
      )}

      <div className="stat-grid">
        <div className="stat">
          <strong>{total}</strong>
          <span>题目总数</span>
        </div>
        <div className="stat">
          <strong>{wrong.length}</strong>
          <span>待复习错题</span>
        </div>
        <div className="stat">
          <strong>{averageScore || '—'}</strong>
          <span>{averageScore ? '平均得分率' : '还没考过'}</span>
        </div>
      </div>

      <div className="section-title">
        <h2>最近题集</h2>
        <Link to="/library" className="tiny">
          全部题集
        </Link>
      </div>

      {allSets.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ fontSize: 13.5 }}>
            还没有题集。导入时填一个名字，就能像歌单一样管理题目。
          </p>
        </div>
      ) : (
        <div className="stack">
          {allSets.slice(0, 3).map((set) => {
            const color = COLORS[set.color] ?? COLORS.sky
            return (
              <Link key={set.id} to={`/sets/${set.id}`} className="card" style={{ padding: 14 }}>
                <div className="row-between">
                  <div className="row">
                    <div
                      className="type-dot"
                      style={{ background: color.bg, color: color.text, width: 40, height: 40 }}
                    >
                      <Layers size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{set.name}</div>
                      <div className="tiny">{counts.get(set.id) ?? 0} 道题</div>
                    </div>
                  </div>
                  <ArrowRight size={17} color="var(--ink-3)" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="section-title">
        <h2>快捷开始</h2>
      </div>
      <div className="grid-2">
        <button className="card" style={{ textAlign: 'left' }} onClick={() => navigate('/practice?source=all&order=random')}>
          <Shuffle size={19} color="var(--accent)" />
          <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>
            随机 {Math.min(20, total)} 题
          </div>
          <div className="tiny">保持手感</div>
        </button>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => navigate('/practice?source=favorite')}>
          <Sparkles size={19} color="var(--accent)" />
          <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>收藏的题</div>
          <div className="tiny">重点再过一遍</div>
        </button>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => navigate('/import')}>
          <Upload size={19} color="var(--accent)" />
          <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>导入题目</div>
          <div className="tiny">docx / txt / pdf</div>
        </button>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => navigate('/me')}>
          <Download size={19} color="var(--accent)" />
          <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>备份数据</div>
          <div className="tiny">换设备不丢题库</div>
        </button>
      </div>

      {recent && (
        <div className="card">
          <div className="card-head">
            <h3>最近导入</h3>
            <span className="tiny">{formatRelative(recent.createdAt)}</span>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <TypeBadge type={recent.type} multiple={recent.multiple} />
            <span className="tiny" style={{ flex: 1, minWidth: 0 }}>
              {recent.content.slice(0, 40)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
