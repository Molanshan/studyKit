import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Star,
  X,
} from 'lucide-react'
import { db, clearSession, finishExam, saveSession, toggleFavorite } from '../lib/db'
import { useAppStore } from '../lib/store'
import { answerLetters, blankAnswers, gradeQuestion, scoreLabel } from '../lib/scoring'
import { Sheet, TypeBadge } from '../components/ui'
import type { ExamRecord, Question, SelfGrade } from '../types'

function answerText(question: Question): string {
  if (question.type === 'fill') {
    return blankAnswers(question)
      .map((value, index) => `${index + 1}. ${value}`)
      .join('   ')
  }
  return question.answer || '—'
}

export function PracticeSession() {
  const [params] = useSearchParams()
  const sessionId = params.get('id')
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const showToast = useAppStore((state) => state.showToast)

  const session = useLiveQuery(
    async () => {
      if (!sessionId) return null
      return (await db.sessions.get(sessionId)) ?? null
    },
    [sessionId],
  )
  const questions = useLiveQuery(
    async () => {
      if (!session) return []
      const items = await db.questions.bulkGet(session.questionIds)
      return session.questionIds
        .map((id) => items.find((item) => item?.id === id))
        .filter((item): item is Question => !!item)
    },
    [session?.id],
    [] as Question[],
  )

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selfGrades, setSelfGrades] = useState<Record<string, SelfGrade>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [index, setIndex] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const initialized = useRef(false)
  const sessionRef = useRef(session)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!session || initialized.current) return
    initialized.current = true
    setAnswers(session.answers ?? {})
    setSelfGrades(session.selfGrades ?? {})
    setIndex(Math.min(session.currentIndex ?? 0, Math.max(session.questionIds.length - 1, 0)))
  }, [session])

  useEffect(() => {
    if (!session || !initialized.current) return
    const timer = setTimeout(() => {
      const current = sessionRef.current
      if (!current) return
      void saveSession({
        ...current,
        answers,
        selfGrades: selfGrades as Record<string, Exclude<SelfGrade, null>>,
        currentIndex: index,
        updatedAt: Date.now(),
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [answers, selfGrades, index, session?.id])

  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current)
    },
    [],
  )

  const total = questions.length
  const current = questions[index]
  const isChecked = !!current && !!checked[current.id]
  const grade = current
    ? gradeQuestion(current, answers[current.id] ?? '', selfGrades[current.id] ?? null, settings)
    : null

  const answeredCount = useMemo(
    () => questions.filter((question) => (answers[question.id] ?? '').trim() || selfGrades[question.id]).length,
    [questions, answers, selfGrades],
  )

  const goPrev = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1))
  }, [])

  const goNext = useCallback(() => {
    setIndex((value) => Math.min(questions.length - 1, value + 1))
  }, [questions.length])

  const maybeAutoNext = useCallback(
    (correct: boolean) => {
      if (!settings.autoNext || !current) return
      if (current.type === 'short' || current.type === 'term') return
      if (!correct) return
      if (index >= questions.length - 1) return
      if (autoTimer.current) clearTimeout(autoTimer.current)
      autoTimer.current = setTimeout(() => {
        setIndex((value) => Math.min(questions.length - 1, value + 1))
      }, 750)
    },
    [settings.autoNext, current, index, questions.length],
  )

  const submit = useCallback(
    (override?: string, selfGrade?: SelfGrade) => {
      if (!current) return
      const value = override ?? answers[current.id] ?? ''
      const result = gradeQuestion(current, value, selfGrade ?? selfGrades[current.id] ?? null, settings)
      setChecked((previous) => ({ ...previous, [current.id]: true }))
      maybeAutoNext(result.score >= 1)
    },
    [current, answers, selfGrades, settings, maybeAutoNext],
  )

  const chooseOption = (label: string) => {
    if (!current || isChecked) return
    const selected = answerLetters(answers[current.id] ?? '')
    if (current.multiple) {
      const next = selected.includes(label)
        ? selected.filter((item) => item !== label)
        : [...selected, label].sort()
      setAnswers((previous) => ({ ...previous, [current.id]: next.join('') }))
      return
    }
    setAnswers((previous) => ({ ...previous, [current.id]: label }))
    if (session?.mode === 'practice') submit(label)
  }

  const chooseJudge = (value: '对' | '错') => {
    if (!current || isChecked) return
    setAnswers((previous) => ({ ...previous, [current.id]: value }))
    if (session?.mode === 'practice') submit(value)
  }

  const setBlank = (blankIndex: number, value: string) => {
    if (!current) return
    const count = Math.max(current.blankCount, 1)
    const parts = (answers[current.id] ?? '').split('|')
    while (parts.length < count) parts.push('')
    parts[blankIndex] = value
    setAnswers((previous) => ({ ...previous, [current.id]: parts.join('|') }))
  }

  const finish = async () => {
    if (finishing || !session || questions.length === 0) return
    setFinishing(true)
    const finishedAt = Date.now()
    const elapsedSec = Math.max(1, Math.round((finishedAt - session.startedAt) / 1000))
    const scores: Record<string, number> = {}
    const wrongBlanks: Record<string, number[]> = {}
    const correctIds: string[] = []
    const wrongIds: string[] = []
    const subjectiveIds: string[] = []
    let sum = 0

    for (const question of questions) {
      const result = gradeQuestion(
        question,
        answers[question.id] ?? '',
        selfGrades[question.id] ?? null,
        settings,
      )
      scores[question.id] = result.score
      sum += result.score
      if (result.score >= 1) correctIds.push(question.id)
      else {
        wrongIds.push(question.id)
        if (result.wrongBlanks.length) wrongBlanks[question.id] = result.wrongBlanks
      }
      if (question.type === 'short' || question.type === 'term') subjectiveIds.push(question.id)
    }

    const record: ExamRecord = {
      id: `exam_${finishedAt}_${Math.random().toString(36).slice(2, 7)}`,
      mode: session.mode,
      title: session.title,
      sourceLabel: session.sourceLabel,
      questionIds: questions.map((question) => question.id),
      answers,
      correctIds,
      wrongIds,
      subjectiveIds,
      selfGrades: Object.fromEntries(
        Object.entries(selfGrades).filter((entry): entry is [string, 'correct' | 'wrong'] => !!entry[1]),
      ),
      scores,
      durationSec: 0,
      elapsedSec,
      total: questions.length,
      objectiveCorrect: questions.filter(
        (question) =>
          question.type !== 'short' &&
          question.type !== 'term' &&
          (scores[question.id] ?? 0) >= 1,
      ).length,
      subjectiveCorrect: questions.filter(
        (question) =>
          (question.type === 'short' || question.type === 'term') &&
          (scores[question.id] ?? 0) >= 1,
      ).length,
      score: Math.round((sum / questions.length) * 100),
      finishedAt,
    }

    await finishExam({ record, wrongBlanks })
    await clearSession(session.id)
    navigate(`/result/${record.id}`, { replace: true })
  }

  const requestFinish = () => {
    if (session?.mode === 'mock' && answeredCount < total) {
      setConfirmOpen(true)
      return
    }
    void finish()
  }

  const leave = async () => {
    if (session) {
      await saveSession({
        ...session,
        answers,
        selfGrades: selfGrades as Record<string, Exclude<SelfGrade, null>>,
        currentIndex: index,
        updatedAt: Date.now(),
      })
    }
    navigate(-1)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!current) return
      if (event.key === 'ArrowLeft') goPrev()
      if (event.key === 'ArrowRight') goNext()
      if (/^[A-Ha-h]$/.test(event.key) && current.type === 'choice' && !isChecked) {
        chooseOption(event.key.toUpperCase())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!sessionId || session === undefined) {
    return (
      <div className="practice-shell">
        <div className="practice-body" style={{ display: 'grid', placeItems: 'center' }}>
          <p className="muted">正在加载练习…</p>
        </div>
      </div>
    )
  }

  if (!session || !current) {
    return (
      <div className="practice-shell">
        <div className="practice-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="empty">
            <div className="empty-icon">
              <X size={22} />
            </div>
            <h3>练习不存在</h3>
            <p>可能已经完成或被删除了。</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  const mode = session.mode
  const showFeedback = mode === 'practice' && isChecked && grade
  const favorite = favorites[current.id] ?? current.favorite
  const progress = ((index + 1) / total) * 100

  return (
    <div className="practice-shell">
      <div className="practice-top">
        <button className="btn btn-ghost btn-icon" onClick={leave} aria-label="退出练习">
          <X size={19} />
        </button>
        <div className="progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="tiny" style={{ minWidth: 44, textAlign: 'center' }}>
          {index + 1}/{total}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={() => setSheetOpen(true)} aria-label="答题卡">
          <LayoutGrid size={18} />
        </button>
      </div>

      <div className="practice-body">
        <div className="question-card">
          <div className="question-meta">
            <TypeBadge type={current.type} multiple={current.multiple} />
            {current.status === 'draft' && <span className="badge warn">无答案</span>}
            <span className="tiny">第 {index + 1} 题</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                await toggleFavorite(current.id)
                setFavorites((previous) => ({ ...previous, [current.id]: !favorite }))
                showToast(favorite ? '已取消收藏' : '已收藏')
              }}
            >
              <Star size={14} fill={favorite ? 'currentColor' : 'none'} color={favorite ? 'var(--warning)' : 'currentColor'} />
              {favorite ? '已收藏' : '收藏'}
            </button>
          </div>

          <div className="question-stem">{current.content}</div>

          {current.type === 'choice' && (
            <>
              <div className="options">
                {current.options.map((option) => {
                  const selected = answerLetters(answers[current.id] ?? '').includes(option.label)
                  const expected = answerLetters(current.answer).includes(option.label)
                  let state: string | undefined
                  if (showFeedback) {
                    if (expected) state = 'correct'
                    else if (selected) state = 'wrong'
                  } else if (selected) {
                    state = 'selected'
                  }
                  return (
                    <button
                      key={option.label}
                      className="option"
                      data-state={state}
                      disabled={isChecked}
                      onClick={() => chooseOption(option.label)}
                    >
                      <span className="option-key">{option.label}</span>
                      <span>{option.content}</span>
                    </button>
                  )
                })}
              </div>
              {current.multiple && !isChecked && (
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 14 }}
                  onClick={() => submit()}
                  disabled={!answers[current.id]}
                >
                  确认答案
                </button>
              )}
            </>
          )}

          {current.type === 'judge' && (
            <div className="grid-2" style={{ marginTop: 18 }}>
              {(['对', '错'] as const).map((value) => {
                const selected = answers[current.id] === value
                const isAnswer = current.answer === value
                let state: string | undefined
                if (showFeedback) {
                  if (isAnswer) state = 'correct'
                  else if (selected) state = 'wrong'
                } else if (selected) {
                  state = 'selected'
                }
                return (
                  <button
                    key={value}
                    className="option"
                    data-state={state}
                    style={{ justifyContent: 'center', fontSize: 18, fontWeight: 700 }}
                    disabled={isChecked}
                    onClick={() => chooseJudge(value)}
                  >
                    {value === '对' ? <Check size={20} /> : <X size={20} />}
                    {value}
                  </button>
                )
              })}
            </div>
          )}

          {current.type === 'fill' && (
            <div style={{ marginTop: 14 }}>
              {Array.from({ length: Math.max(current.blankCount, 1) }).map((_, blankIndex) => (
                <div className="blank-row" key={blankIndex}>
                  <span className="blank-index">{blankIndex + 1}</span>
                  <input
                    className="input"
                    value={(answers[current.id] ?? '').split('|')[blankIndex] ?? ''}
                    onChange={(event) => setBlank(blankIndex, event.target.value)}
                    disabled={isChecked}
                    placeholder={`第 ${blankIndex + 1} 空`}
                  />
                </div>
              ))}
              {!isChecked && (
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 14 }}
                  onClick={() => submit()}
                  disabled={!answers[current.id]}
                >
                  确认答案
                </button>
              )}
            </div>
          )}

          {(current.type === 'short' || current.type === 'term') && (
            <div style={{ marginTop: 14 }}>
              <textarea
                className="textarea"
                value={answers[current.id] ?? ''}
                onChange={(event) =>
                  setAnswers((previous) => ({ ...previous, [current.id]: event.target.value }))
                }
                disabled={isChecked}
                placeholder="在这里作答，写完可以对照参考答案自评"
              />
              {!revealed[current.id] && !isChecked && (
                <button
                  className="btn btn-soft btn-block"
                  style={{ marginTop: 12 }}
                  onClick={() => setRevealed((previous) => ({ ...previous, [current.id]: true }))}
                >
                  查看参考答案并自评
                </button>
              )}
              {(revealed[current.id] || isChecked) && (
                <div className="feedback" style={{ marginTop: 12 }}>
                  <h4>参考答案</h4>
                  <p>{current.answer || '这道题还没有答案'}</p>
                </div>
              )}
              {!isChecked && revealed[current.id] && (
                <div className="grid-2" style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-soft"
                    onClick={() => {
                      setSelfGrades((previous) => ({ ...previous, [current.id]: 'correct' }))
                      submit(undefined, 'correct')
                    }}
                  >
                    <Check size={16} />
                    答对了
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      setSelfGrades((previous) => ({ ...previous, [current.id]: 'wrong' }))
                      submit(undefined, 'wrong')
                    }}
                  >
                    <X size={16} />
                    没答对
                  </button>
                </div>
              )}
            </div>
          )}

          {showFeedback && grade && (
            <div className="feedback" data-tone={grade.score >= 1 ? 'correct' : 'wrong'}>
              <h4>
                {scoreLabel(grade.score)}
                {grade.score > 0 && grade.score < 1 ? `（${Math.round(grade.score * 100)}%）` : ''}
              </h4>
              {current.type !== 'short' && current.type !== 'term' && (
                <div className="answer-line">正确答案：{answerText(current)}</div>
              )}
              {current.type === 'fill' && grade.wrongBlanks.length > 0 && (
                <div className="tiny" style={{ marginBottom: 6 }}>
                  错在第 {grade.wrongBlanks.map((value) => value + 1).join('、')} 空
                </div>
              )}
              <p>{current.explanation || '这道题没有解析。'}</p>
            </div>
          )}
        </div>

        {mode === 'mock' && (
          <p className="tiny" style={{ textAlign: 'center', marginTop: 14 }}>
            模拟模式：全部答完后统一判分
          </p>
        )}
      </div>

      <div className="practice-foot">
        <div className="practice-foot-inner">
          <button className="btn" onClick={goPrev} disabled={index === 0}>
            <ChevronLeft size={17} />
            上一题
          </button>
          {index < total - 1 ? (
            <button className="btn btn-primary btn-block" onClick={goNext}>
              {mode === 'practice' && !isChecked ? '跳过' : '下一题'}
              <ChevronRight size={17} />
            </button>
          ) : (
            <button className="btn btn-primary btn-block" onClick={requestFinish} disabled={finishing}>
              {finishing ? '正在结算…' : '完成练习'}
            </button>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} title="答题卡" onClose={() => setSheetOpen(false)}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <span className="tiny">
            已答 {answeredCount}/{total}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSheetOpen(false)
              requestFinish()
            }}
          >
            直接交卷
          </button>
        </div>
        <div className="answer-sheet">
          {questions.map((question, cellIndex) => {
            let state = 'empty'
            if (checked[question.id] && mode === 'practice') {
              const cellGrade = gradeQuestion(
                question,
                answers[question.id] ?? '',
                selfGrades[question.id] ?? null,
                settings,
              )
              state = cellGrade.score >= 1 ? 'correct' : 'wrong'
            } else if ((answers[question.id] ?? '').trim() || selfGrades[question.id]) {
              state = 'answered'
            }
            return (
              <button
                key={question.id}
                className="sheet-cell"
                data-state={cellIndex === index ? 'current' : state}
                onClick={() => {
                  setIndex(cellIndex)
                  setSheetOpen(false)
                }}
              >
                {cellIndex + 1}
              </button>
            )
          })}
        </div>
        <div className="row" style={{ gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
          <span className="tiny row" style={{ gap: 5 }}>
            <span className="badge ok">绿</span> 正确
          </span>
          <span className="tiny row" style={{ gap: 5 }}>
            <span className="badge danger">红</span> 错误
          </span>
          <span className="tiny row" style={{ gap: 5 }}>
            <span className="badge">灰</span> 未答
          </span>
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 16 }}
          onClick={() => {
            setSheetOpen(false)
            requestFinish()
          }}
        >
          交卷并查看结果
        </button>
      </Sheet>

      <Sheet
        open={confirmOpen}
        title="还有题没答完"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setConfirmOpen(false)}>
              继续答题
            </button>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                setConfirmOpen(false)
                void finish()
              }}
            >
              仍然交卷
            </button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 14 }}>
          还有 {total - answeredCount} 道题没有作答，未答的题会按 0 分计入结果。
        </p>
      </Sheet>
    </div>
  )
}
