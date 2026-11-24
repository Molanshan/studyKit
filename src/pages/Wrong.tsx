import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  BookCheck,
  BookX,
  Check,
  ChevronDown,
  Play,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { db, clearWrong, markMastered, removeWrong } from '../lib/db'
import { useAppStore } from '../lib/store'
import { blankAnswers } from '../lib/scoring'
import { formatRelative, truncate } from '../lib/utils'
import { EmptyState, Sheet, TypeBadge } from '../components/ui'
import type { Question, WrongQuestion } from '../types'

type Filter = 'active' | 'mastered' | 'all'

function correctAnswer(question: Question): string {
  if (question.type === 'fill') {
    return blankAnswers(question)
      .map((part, index) => `${index + 1}. ${part}`)
      .join('   ')
  }
  return question.answer || '—'
}

function myAnswer(question: Question, value?: string): string {
  if (!value) return '未作答'
  if (question.type === 'fill') {
    return value
      .split('|')
      .map((part, index) => `${index + 1}. ${part || '（空）'}`)
      .join('   ')
  }
  return value
}

export function Wrong() {
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)

  const wrongList = useLiveQuery(() => db.wrongQuestions.toArray(), [], [] as WrongQuestion[])
  const questions = useLiveQuery(() => db.questions.toArray(), [], [] as Question[])

  const [filter, setFilter] = useState<Filter>('active')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [confirmClear, setConfirmClear] = useState(false)

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  )

  const rows = useMemo(() => {
    const list = wrongList
      .filter((item) => {
        if (filter === 'active') return !item.masteredAt
        if (filter === 'mastered') return !!item.masteredAt
        return true
      })
      .map((item) => ({ item, question: questionMap.get(item.questionId) }))
      .filter((row): row is { item: WrongQuestion; question: Question } => !!row.question)
    return list.sort((a, b) => b.item.lastWrongAt - a.item.lastWrongAt)
  }, [wrongList, questionMap, filter])

  const activeCount = wrongList.filter((item) => !item.masteredAt).length
  const masteredCount = wrongList.filter((item) => !!item.masteredAt).length

  const startReview = () => {
    if (activeCount === 0) {
      showToast('没有待复习的错题')
      return
    }
    navigate('/practice?source=wrong')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">错题本</p>
          <h1>{activeCount} 道待复习</h1>
        </div>
        {activeCount > 0 && (
          <button className="btn btn-primary btn-sm" onClick={startReview}>
            <Play size={15} />
            复习错题
          </button>
        )}
      </header>

      <div className="stat-grid">
        <div className="stat">
          <strong>{activeCount}</strong>
          <span>待复习</span>
        </div>
        <div className="stat">
          <strong>{masteredCount}</strong>
          <span>已掌握</span>
        </div>
        <div className="stat">
          <strong>{wrongList.length}</strong>
          <span>错题总数</span>
        </div>
      </div>

      <div className="segmented">
        {(
          [
            ['active', `待复习 ${activeCount}`],
            ['mastered', `已掌握 ${masteredCount}`],
            ['all', '全部'],
          ] as Array<[Filter, string]>
        ).map(([key, label]) => (
          <button key={key} data-active={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={filter === 'mastered' ? <BookCheck size={24} /> : <BookX size={24} />}
          title={
            filter === 'mastered'
              ? '还没有已掌握的错题'
              : filter === 'active' && masteredCount > 0
                ? '待复习的错题都清完了'
                : '错题本是空的'
          }
          description={
            filter === 'mastered'
              ? '连续答对同一道错题两次，就会自动标记为已掌握。'
              : filter === 'active' && masteredCount > 0
                ? '已掌握的错题可以在上方「已掌握」里查看，也可以继续刷题保持手感。'
                : '答错的题会自动收进来。刷题时做错的客观题、自评没答对的主观题都会记录。'
          }
          action={
            <button className="btn btn-primary" onClick={() => navigate('/practice?source=all')}>
              去刷题
            </button>
          }
        />
      ) : (
        <div className="stack">
          {rows.map(({ item, question }) => {
            const open = !!expanded[question.id]
            return (
              <div className="card" key={question.id} style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  className="draft-head"
                  onClick={() =>
                    setExpanded((previous) => ({
                      ...previous,
                      [question.id]: !previous[question.id],
                    }))
                  }
                >
                  <TypeBadge type={question.type} multiple={question.multiple} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 550 }}>
                      {truncate(question.content, 88)}
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <span className="tiny">错 {item.wrongCount} 次</span>
                      <span className="tiny">· {formatRelative(item.lastWrongAt)}</span>
                      {item.correctStreak > 0 && !item.masteredAt && (
                        <span className="badge ok">连对 {item.correctStreak}</span>
                      )}
                      {item.masteredAt && <span className="badge ok">已掌握</span>}
                    </div>
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
                      <div className="tiny">上次作答</div>
                      <div style={{ fontSize: 14, color: 'var(--danger)' }}>
                        {myAnswer(question, item.lastAnswer)}
                      </div>
                      {item.lastWrongBlanks && item.lastWrongBlanks.length > 0 && (
                        <div className="tiny" style={{ color: 'var(--danger)' }}>
                          错在第 {item.lastWrongBlanks.map((value) => value + 1).join('、')} 空
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="tiny">正确答案</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{correctAnswer(question)}</div>
                    </div>
                    {question.explanation && (
                      <div>
                        <div className="tiny">解析</div>
                        <div
                          style={{
                            fontSize: 13.5,
                            color: 'var(--ink-2)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {question.explanation}
                        </div>
                      </div>
                    )}
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={async () => {
                          await markMastered(question.id, !item.masteredAt)
                          showToast(item.masteredAt ? '已移回待复习' : '已标记为掌握', 'success')
                        }}
                      >
                        {item.masteredAt ? <Undo2 size={14} /> : <Check size={14} />}
                        {item.masteredAt ? '移回待复习' : '标记已掌握'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/practice?source=type:${question.type}`)}
                      >
                        <RotateCcw size={14} />
                        练同类题
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 'auto', color: 'var(--danger)' }}
                        onClick={async () => {
                          await removeWrong(question.id)
                          showToast('已从错题本移除')
                        }}
                      >
                        <Trash2 size={14} />
                        移除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {wrongList.length > 0 && (
        <button className="btn btn-ghost btn-block" onClick={() => setConfirmClear(true)}>
          清空错题本
        </button>
      )}

      <Sheet
        open={confirmClear}
        title="清空错题本？"
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setConfirmClear(false)}>
              取消
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                await clearWrong()
                setConfirmClear(false)
                showToast('错题本已清空')
              }}
            >
              清空
            </button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 14 }}>
          只会清空错题记录，题目本身仍然保留在题库中。
        </p>
      </Sheet>
    </div>
  )
}
