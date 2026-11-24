import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, RotateCcw, X } from 'lucide-react'
import { db, saveSession } from '../lib/db'
import { useAppStore } from '../lib/store'
import { blankAnswers } from '../lib/scoring'
import { createId, formatDuration } from '../lib/utils'
import { EmptyState, Ring, TypeBadge } from '../components/ui'
import type { Question } from '../types'

function myAnswer(question: Question, value: string, selfGrade?: 'correct' | 'wrong'): string {
  if (question.type === 'short' || question.type === 'term') {
    if (value) return value
    if (selfGrade === 'correct') return '自评：已掌握'
    if (selfGrade === 'wrong') return '自评：未掌握'
    return '未作答'
  }
  if (!value) return '未作答'
  if (question.type === 'fill') {
    return value
      .split('|')
      .map((part, index) => `${index + 1}. ${part || '（空）'}`)
      .join('   ')
  }
  return value
}

function correctAnswer(question: Question): string {
  if (question.type === 'fill') {
    return blankAnswers(question)
      .map((part, index) => `${index + 1}. ${part}`)
      .join('   ')
  }
  return question.answer || '—'
}

export function Result() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const record = useLiveQuery(
    async () => (id ? ((await db.examRecords.get(id)) ?? null) : null),
    [id],
  )
  const questions = useLiveQuery(
    async () => {
      if (!record) return []
      const items = await db.questions.bulkGet(record.questionIds)
      return record.questionIds
        .map((questionId) => items.find((item) => item?.id === questionId))
        .filter((item): item is Question => !!item)
    },
    [record?.id],
    [] as Question[],
  )

  const partialFill = useMemo(() => {
    if (!record) return 0
    return record.questionIds.filter((questionId) => {
      const score = record.scores[questionId] ?? 0
      return score > 0 && score < 1
    }).length
  }, [record])

  if (record === undefined) {
    return (
      <div className="practice-shell">
        <div className="practice-body" style={{ display: 'grid', placeItems: 'center' }}>
          <p className="muted">正在加载结果…</p>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="practice-shell">
        <div className="practice-body" style={{ display: 'grid', placeItems: 'center' }}>
          <EmptyState
            icon={<X size={24} />}
            title="找不到这次记录"
            description="记录可能已经被删除。"
            action={
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                返回首页
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const wrongQuestions = record.wrongIds
    .map((questionId) => questions.find((question) => question.id === questionId))
    .filter((question): question is Question => !!question)

  const retryWrong = async () => {
    if (wrongQuestions.length === 0) return
    const session = {
      id: createId('session_'),
      title: '错题重练',
      sourceLabel: 'wrong',
      mode: 'practice' as const,
      questionIds: wrongQuestions.map((question) => question.id),
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

  return (
    <div className="practice-shell">
      <div className="practice-top">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/')} aria-label="返回首页">
          <ArrowLeft size={19} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{record.title}</div>
          <div className="tiny">
            {record.mode === 'mock' ? '模拟练习' : '边答边看'} · {formatDuration(record.elapsedSec)}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          首页
        </button>
      </div>

      <div className="practice-body">
        <div className="result-hero">
          <Ring value={record.score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>
              {record.score >= 85 ? '状态不错' : record.score >= 60 ? '还有提升空间' : '需要再过一遍'}
            </div>
            <p className="tiny" style={{ marginTop: 4 }}>
              共 {record.total} 题，全对 {record.correctIds.length} 题
            </p>
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="badge ok">
                <Check size={12} />
                {record.correctIds.length}
              </span>
              <span className="badge danger">
                <X size={12} />
                {record.wrongIds.length}
              </span>
              {partialFill > 0 && <span className="badge warn">部分得分 {partialFill}</span>}
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <strong>{record.objectiveCorrect}</strong>
            <span>客观题全对</span>
          </div>
          <div className="stat">
            <strong>{record.subjectiveCorrect}</strong>
            <span>主观题掌握</span>
          </div>
          <div className="stat">
            <strong>{record.total ? Math.round((record.correctIds.length / record.total) * 100) : 0}%</strong>
            <span>全对率</span>
          </div>
        </div>

        <div className="section-title">
          <h2>逐题回顾</h2>
          <span className="tiny">点开看答案与解析</span>
        </div>

        <div className="stack">
          {questions.map((question, index) => {
            const score = record.scores[question.id] ?? 0
            const open = !!expanded[question.id]
            return (
              <div className="card" key={question.id} style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  className="draft-head"
                  onClick={() =>
                    setExpanded((previous) => ({ ...previous, [question.id]: !previous[question.id] }))
                  }
                >
                  <span
                    className="badge"
                    style={{
                      background: score >= 1 ? 'var(--success-soft)' : score > 0 ? 'var(--warning-soft)' : 'var(--danger-soft)',
                      color: score >= 1 ? 'var(--success)' : score > 0 ? 'var(--warning)' : 'var(--danger)',
                      flex: '0 0 auto',
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <TypeBadge type={question.type} multiple={question.multiple} />
                      {score > 0 && score < 1 && (
                        <span className="badge warn">{Math.round(score * 100)}%</span>
                      )}
                      {!record.answers[question.id] && !record.selfGrades[question.id] && (
                        <span className="badge">未作答</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 550 }}>{question.content}</div>
                  </div>
                  <ChevronDown
                    size={17}
                    color="var(--ink-3)"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                  />
                </button>

                {open && (
                  <div className="draft-body">
                    <div>
                      <div className="tiny">我的答案</div>
                      <div style={{ fontSize: 14 }}>
                        {myAnswer(
                          question,
                          record.answers[question.id] ?? '',
                          record.selfGrades[question.id],
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="tiny">正确答案</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{correctAnswer(question)}</div>
                    </div>
                    {question.explanation && (
                      <div>
                        <div className="tiny">解析</div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                          {question.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="stack" style={{ marginTop: 18 }}>
          {wrongQuestions.length > 0 && (
            <button className="btn btn-primary btn-block" onClick={retryWrong}>
              <RotateCcw size={17} />
              重练这 {wrongQuestions.length} 道错题
            </button>
          )}
          <button
            className="btn btn-block"
            onClick={() => {
              showToast('结果已保存到错题本')
              navigate('/wrong')
            }}
          >
            查看错题本
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => navigate('/')}>
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
