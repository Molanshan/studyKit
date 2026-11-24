import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookX, Clock, Play, Shuffle, Sparkles } from 'lucide-react'
import { db, saveSession } from '../lib/db'
import { QUESTION_VIEWS } from '../lib/constants'
import { useAppStore } from '../lib/store'
import { createId, shuffle } from '../lib/utils'
import { EmptyState } from '../components/ui'
import type { ExamMode, PracticeSession, Question } from '../types'

export function PracticeSetup() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const source = params.get('source') ?? 'all'
  const settings = useAppStore((state) => state.settings)
  const [order, setOrder] = useState<'random' | 'seq'>(params.get('order') === 'seq' ? 'seq' : 'random')
  const [mode, setMode] = useState<ExamMode>('practice')
  const [count, setCount] = useState<number | 'all'>(settings.defaultCount)

  const questions = useLiveQuery(() => db.questions.toArray(), [], [])
  const sets = useLiveQuery(() => db.questionSets.toArray(), [], [])
  const wrongList = useLiveQuery(() => db.wrongQuestions.toArray(), [], [])
  const exams = useLiveQuery(() => db.examRecords.toArray(), [], [])

  const sourceInfo = useMemo(() => {
    const wrongIds = new Set(wrongList.filter((item) => !item.masteredAt).map((item) => item.questionId))
    const seen = new Set<string>()
    for (const exam of exams) for (const id of exam.questionIds) seen.add(id)

    let list: Question[] = questions
    let label = '全部题目'

    if (source === 'wrong') {
      list = questions.filter((question) => wrongIds.has(question.id))
      label = '错题复习'
    } else if (source === 'favorite') {
      list = questions.filter((question) => question.favorite)
      label = '收藏的题'
    } else if (source === 'unseen') {
      list = questions.filter((question) => !seen.has(question.id))
      label = '没做过的题'
    } else if (source.startsWith('set:')) {
      const setId = source.slice(4)
      list = questions.filter((question) => question.setIds.includes(setId))
      label = sets.find((set) => set.id === setId)?.name ?? '题集'
    } else if (source.startsWith('type:')) {
      const key = source.slice(5)
      const view = QUESTION_VIEWS.find((item) => item.key === key)
      list = questions.filter((question) => {
        if (!view) return true
        if (view.type !== 'choice') return question.type === view.type
        return question.type === 'choice' && question.multiple === !!view.multiple
      })
      label = view?.label ?? '题型练习'
    } else if (source === 'all') {
      list = questions
    }

    return { list, label, wrongIds }
  }, [questions, sets, wrongList, exams, source])

  const available = sourceInfo.list.length
  const effectiveCount = count !== 'all' && count > available ? 'all' : count
  const pickCount = effectiveCount === 'all' ? available : Math.min(effectiveCount, available)

  const start = async () => {
    if (available === 0) return
    const ordered = order === 'random' ? shuffle(sourceInfo.list) : [...sourceInfo.list].sort((a, b) => a.order - b.order)
    const picked = ordered.slice(0, pickCount)
    const session: PracticeSession = {
      id: createId('session_'),
      title: sourceInfo.label,
      sourceLabel: source,
      mode,
      questionIds: picked.map((question) => question.id),
      answers: {},
      selfGrades: {},
      currentIndex: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      durationSec: 0,
    }
    await saveSession(session)
    navigate(`/practice/session?id=${session.id}`)
  }

  if (available === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="返回">
              <ArrowLeft size={19} />
            </button>
            <h1 style={{ fontSize: 22 }}>{sourceInfo.label}</h1>
          </div>
        </header>
        <EmptyState
          icon={<BookX size={24} />}
          title="这里还没有题目"
          description={
            source === 'wrong'
              ? '答错过的题会自动出现在这里。先去刷几题吧。'
              : source === 'favorite'
                ? '在刷题时点收藏，题目就会出现在这里。'
                : '先导入一份复习题，或者载入示例题库。'
          }
          action={
            <button className="btn btn-primary" onClick={() => navigate('/import')}>
              去导入
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="eyebrow">开始练习</p>
            <h1 style={{ fontSize: 22 }}>{sourceInfo.label}</h1>
          </div>
        </div>
        <span className="badge">{available} 题可选</span>
      </header>

      <div className="card">
        <div className="card-head">
          <h3>本次题量</h3>
          <span className="tiny">最多 {available} 题</span>
        </div>
        <div className="chip-row">
          {[10, 20, 50].map((value) => (
            <button
              key={value}
              className="chip"
              data-active={effectiveCount === value}
              onClick={() => setCount(value)}
              disabled={value > available}
            >
              {value} 题
            </button>
          ))}
          <button
            className="chip"
            data-active={effectiveCount === 'all'}
            onClick={() => setCount('all')}
          >
            全部 {available} 题
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>出题顺序</h3>
        </div>
        <div className="segmented">
          <button data-active={order === 'random'} onClick={() => setOrder('random')}>
            <Shuffle size={14} style={{ marginRight: 5 }} />
            随机
          </button>
          <button data-active={order === 'seq'} onClick={() => setOrder('seq')}>
            按导入顺序
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>练习模式</h3>
        </div>
        <div className="segmented">
          <button data-active={mode === 'practice'} onClick={() => setMode('practice')}>
            <Sparkles size={14} style={{ marginRight: 5 }} />
            边答边看
          </button>
          <button data-active={mode === 'mock'} onClick={() => setMode('mock')}>
            <Clock size={14} style={{ marginRight: 5 }} />
            答完再判
          </button>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          {mode === 'practice'
            ? '每答一题立刻显示对错和解析，适合查漏补缺。'
            : '全部答完统一判分，适合考前模拟。'}
        </p>
      </div>

      <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}>
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>准备好了吗</div>
            <div className="tiny" style={{ color: 'var(--accent-ink)', opacity: 0.8 }}>
              {pickCount} 题 · {order === 'random' ? '随机顺序' : '导入顺序'}
            </div>
          </div>
          <button className="btn btn-primary" onClick={start}>
            <Play size={16} />
            开始
          </button>
        </div>
      </div>
    </div>
  )
}
