import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { db, createSet, deleteQuestions, updateQuestion } from '../lib/db'
import { COLORS, QUESTION_VIEWS } from '../lib/constants'
import { useAppStore } from '../lib/store'
import { truncate } from '../lib/utils'
import { EmptyState, Sheet, TypeBadge } from '../components/ui'
import { QuestionEditor, toEditable, type EditableQuestion } from '../components/QuestionEditor'
import { QuestionView } from '../components/QuestionView'
import type { Question, QuestionSet } from '../types'

function viewKeyOf(question: Pick<Question, 'type' | 'multiple'>): string {
  if (question.type !== 'choice') return question.type
  return question.multiple ? 'multiple' : 'single'
}

export function Library() {
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)
  const editMode = useAppStore((state) => state.editMode)
  const setEditMode = useAppStore((state) => state.setEditMode)

  const questions = useLiveQuery(() => db.questions.toArray(), [], undefined)
  const sets = useLiveQuery(() => db.questionSets.orderBy('sortOrder').toArray(), [], undefined)
  const wrongList = useLiveQuery(() => db.wrongQuestions.toArray(), [], [])

  const allQuestions = questions ?? []
  const allSets = sets ?? []

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [setFilter, setSetFilter] = useState('all')
  const [quick, setQuick] = useState<'all' | 'favorite' | 'wrong'>('all')
  const [visible, setVisible] = useState(60)
  const [creating, setCreating] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [newSetColor, setNewSetColor] = useState<QuestionSet['color']>('sky')
  const [editing, setEditing] = useState<Question | null>(null)
  const [draft, setDraft] = useState<EditableQuestion | null>(null)
  const [draftSetIds, setDraftSetIds] = useState<string[]>([])
  const [viewing, setViewing] = useState<Question | null>(null)

  const wrongIds = useMemo(
    () => new Set(wrongList.filter((item) => !item.masteredAt).map((item) => item.questionId)),
    [wrongList],
  )

  const scopedQuestions = useMemo(() => {
    if (setFilter === 'all') return allQuestions
    if (setFilter === 'unset') return allQuestions.filter((question) => question.setIds.length === 0)
    return allQuestions.filter((question) => question.setIds.includes(setFilter))
  }, [allQuestions, setFilter])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const question of scopedQuestions) {
      const key = viewKeyOf(question)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [scopedQuestions])

  const setCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const question of allQuestions) {
      for (const setId of question.setIds) map.set(setId, (map.get(setId) ?? 0) + 1)
    }
    return map
  }, [allQuestions])

  const unsetCount = useMemo(
    () => allQuestions.filter((question) => question.setIds.length === 0).length,
    [allQuestions],
  )

  const activeSet = allSets.find((set) => set.id === setFilter)
  const hasFilter = !!query.trim() || typeFilter !== 'all' || quick !== 'all' || setFilter !== 'all'

  useEffect(() => {
    if (
      sets !== undefined &&
      setFilter !== 'all' &&
      setFilter !== 'unset' &&
      !sets.some((set) => set.id === setFilter)
    ) {
      setSetFilter('all')
    }
  }, [sets, setFilter])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return allQuestions
      .filter((question) => {
        if (setFilter === 'unset' && question.setIds.length > 0) return false
        if (
          setFilter !== 'all' &&
          setFilter !== 'unset' &&
          !question.setIds.includes(setFilter)
        ) {
          return false
        }
        if (typeFilter !== 'all' && viewKeyOf(question) !== typeFilter) return false
        if (quick === 'favorite' && !question.favorite) return false
        if (quick === 'wrong' && !wrongIds.has(question.id)) return false
        if (!keyword) return true
        const haystack = [
          question.content,
          question.answer,
          question.explanation,
          ...question.options.map((option) => `${option.label} ${option.content}`),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(keyword)
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [allQuestions, typeFilter, quick, query, wrongIds, setFilter])

  const resetFilters = () => {
    setQuery('')
    setTypeFilter('all')
    setQuick('all')
    setSetFilter('all')
  }

  const openEditor = (question: Question) => {
    setEditing(question)
    setDraft(toEditable(question))
    setDraftSetIds(question.setIds)
  }

  const openQuestion = (question: Question) => {
    if (editMode) {
      openEditor(question)
    } else {
      setViewing(question)
    }
  }

  const toggleMode = () => {
    setEditMode(!editMode)
    setEditing(null)
    setDraft(null)
    setDraftSetIds([])
    setCreating(false)
    setViewing(null)
  }

  const saveEdit = async () => {
    if (!editing || !draft) return
    const blankCount =
      draft.type === 'fill' ? Math.max(draft.answer.split('|').filter(Boolean).length, 1) : 0
    await updateQuestion(editing.id, {
      type: draft.type,
      multiple: draft.multiple,
      content: draft.content.trim(),
      options: draft.options.filter((option) => option.content.trim()),
      answer: draft.answer.trim(),
      explanation: draft.explanation.trim(),
      blankCount,
      setIds: draftSetIds,
    })
    setEditing(null)
    setDraft(null)
    showToast('题目已更新', 'success')
  }

  const removeQuestion = async () => {
    if (!editing) return
    await deleteQuestions([editing.id])
    setEditing(null)
    setDraft(null)
    setDraftSetIds([])
    showToast('题目已删除')
  }

  const submitSet = async () => {
    const name = newSetName.trim()
    if (!name) return
    const set = await createSet(name, newSetColor)
    setCreating(false)
    setNewSetName('')
    setSetFilter(set.id)
    showToast('题集已创建', 'success')
  }

  if (questions === undefined || sets === undefined) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">题库</p>
            <h1>读取中…</h1>
          </div>
        </header>
        <div className="card">
          <p className="muted" style={{ fontSize: 13.5 }}>
            正在读取本地题库…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">题库</p>
          <h1>{questions.length} 道题</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className={editMode ? 'btn btn-soft btn-sm' : 'btn btn-sm'}
            onClick={toggleMode}
          >
            {editMode ? <Check size={15} /> : <Pencil size={15} />}
            {editMode ? '完成' : '编辑'}
          </button>
          {(editMode || questions.length === 0) && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/import')}>
              <Upload size={15} />
              导入
            </button>
          )}
        </div>
      </header>

      {editMode && (
        <div className="edit-banner">
          <Pencil size={14} />
          <span>编辑模式：点题目可修改，题集可新建、管理</span>
        </div>
      )}

      {questions.length === 0 ? (
        <EmptyState
          icon={<Upload size={24} />}
          title="还没有题目"
          description="导入 docx / txt / pdf，或直接粘贴题目文本，开始搭建你的题库。"
          action={
            <button className="btn btn-primary" onClick={() => navigate('/import')}>
              <Upload size={16} />
              导入第一份复习题
            </button>
          }
        />
      ) : (
        <>
          <div className="search">
            <Search size={17} />
            <input
              className="input"
              placeholder="搜索题干、选项或答案"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="chip-row">
            <button
              className="chip"
              data-active={setFilter === 'all'}
              onClick={() => setSetFilter('all')}
            >
              全部题目
              <span className="count">{questions.length}</span>
            </button>
            {allSets.map((set) => {
              const color = COLORS[set.color] ?? COLORS.sky
              return (
                <button
                  key={set.id}
                  className="chip"
                  data-active={setFilter === set.id}
                  onClick={() => setSetFilter(setFilter === set.id ? 'all' : set.id)}
                >
                  <span className="chip-dot" style={{ background: color.solid }} />
                  {set.name}
                  <span className="count">{setCounts.get(set.id) ?? 0}</span>
                </button>
              )
            })}
            {unsetCount > 0 && (
              <button
                className="chip"
                data-active={setFilter === 'unset'}
                onClick={() => setSetFilter(setFilter === 'unset' ? 'all' : 'unset')}
              >
                未归类
                <span className="count">{unsetCount}</span>
              </button>
            )}
            {editMode && (
              <button className="chip chip-add" onClick={() => setCreating(true)}>
                <Plus size={14} />
                新建题集
              </button>
            )}
          </div>

          {activeSet && (
            <div className="card set-focus">
              <div className="row" style={{ gap: 9, minWidth: 0 }}>
                <span
                  className="chip-dot"
                  style={{
                    background: (COLORS[activeSet.color] ?? COLORS.sky).solid,
                    width: 10,
                    height: 10,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeSet.name}
                  </div>
                  <div className="tiny">{setCounts.get(activeSet.id) ?? 0} 道题</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flex: '0 0 auto' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={(setCounts.get(activeSet.id) ?? 0) === 0}
                  onClick={() => navigate(`/practice?source=set:${activeSet.id}`)}
                >
                  练习
                </button>
                {editMode && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/sets/${activeSet.id}`)}
                  >
                    管理
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="chip-row">
            <button
              className="chip"
              data-active={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
            >
              全部题型
              <span className="count">{scopedQuestions.length}</span>
            </button>
            {QUESTION_VIEWS.map((view) => (
              <button
                key={view.key}
                className="chip"
                data-active={typeFilter === view.key}
                onClick={() => setTypeFilter(typeFilter === view.key ? 'all' : view.key)}
              >
                {view.shortLabel}
                <span className="count">{counts.get(view.key) ?? 0}</span>
              </button>
            ))}
            <span className="chip-sep" />
            <button
              className="chip"
              data-active={quick === 'favorite'}
              onClick={() => setQuick(quick === 'favorite' ? 'all' : 'favorite')}
            >
              收藏
            </button>
            <button
              className="chip"
              data-active={quick === 'wrong'}
              onClick={() => setQuick(quick === 'wrong' ? 'all' : 'wrong')}
            >
              错题
              <span className="count">{wrongIds.size}</span>
            </button>
          </div>

          <div className="row-between" style={{ marginTop: 2 }}>
            <span className="tiny">共 {filtered.length} 道题</span>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
                清除筛选
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              title="没有匹配的题目"
              description="换个关键词，或者清除筛选条件再试试。"
              action={
                <button className="btn" onClick={resetFilters}>
                  清除筛选
                </button>
              }
            />
          ) : (
            <div className="card flush">
              <div className="list" style={{ padding: '0 14px' }}>
                {filtered.slice(0, visible).map((question) => (
                  <button key={question.id} className="list-row" onClick={() => openQuestion(question)}>
                    <TypeBadge type={question.type} multiple={question.multiple} />
                    <div className="grow">
                      <div className="title">{truncate(question.content, 72)}</div>
                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        {question.status === 'draft' && <span className="badge warn">待补答案</span>}
                        {wrongIds.has(question.id) && <span className="badge danger">错题</span>}
                        {question.favorite && <Star size={12} fill="currentColor" color="var(--warning)" />}
                        {question.options.length > 0 && (
                          <span className="tiny">{question.options.length} 个选项</span>
                        )}
                        {question.setIds.length === 0 && <span className="tiny">未归类</span>}
                      </div>
                    </div>
                    {editMode ? (
                      <Pencil size={15} color="var(--ink-3)" />
                    ) : (
                      <ChevronRight size={16} color="var(--ink-3)" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length > visible && (
            <button className="btn btn-block" onClick={() => setVisible((value) => value + 60)}>
              加载更多（还剩 {filtered.length - visible} 题）
            </button>
          )}
        </>
      )}

      <Sheet
        open={creating}
        title="新建题集"
        onClose={() => setCreating(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setCreating(false)}>
              取消
            </button>
            <button className="btn btn-primary btn-block" onClick={submitSet} disabled={!newSetName.trim()}>
              创建
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label>题集名称</label>
            <input
              className="input"
              autoFocus
              value={newSetName}
              onChange={(event) => setNewSetName(event.target.value)}
              placeholder="例如：马原第三章、高频考点"
            />
          </div>
          <div className="field">
            <label>颜色</label>
            <div className="swatches">
              {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((key) => (
                <button
                  key={key}
                  className="swatch"
                  data-active={newSetColor === key}
                  style={{ background: COLORS[key].solid }}
                  onClick={() => setNewSetColor(key)}
                  aria-label={COLORS[key].name}
                />
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={!!editing && !!draft}
        title="编辑题目"
        onClose={() => {
          setEditing(null)
          setDraft(null)
          setDraftSetIds([])
        }}
        footer={
          <>
            <button className="btn btn-danger" onClick={removeQuestion}>
              <Trash2 size={16} />
              删除
            </button>
            <button className="btn btn-primary btn-block" onClick={saveEdit}>
              保存
            </button>
          </>
        }
      >
        {draft && <QuestionEditor value={draft} onChange={setDraft} />}

        <div className="divider" style={{ margin: '16px 0' }} />

        <div className="field">
          <label>所属题集</label>
          {allSets.length === 0 ? (
            <span className="tiny">还没有题集。切到编辑模式后，点题库上方的「新建题集」。</span>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {allSets.map((set) => {
                const active = draftSetIds.includes(set.id)
                return (
                  <button
                    key={set.id}
                    className="chip"
                    data-active={active}
                    onClick={() =>
                      setDraftSetIds((ids) =>
                        active ? ids.filter((id) => id !== set.id) : [...ids, set.id],
                      )
                    }
                  >
                    {active ? <Check size={13} /> : null}
                    {set.name}
                  </button>
                )
              })}
            </div>
          )}
          <span className="tiny">一道题可以同时属于多个题集。</span>
        </div>
      </Sheet>

      <Sheet
        open={!!viewing}
        title="查看题目"
        onClose={() => setViewing(null)}
        footer={
          <button className="btn btn-block" onClick={() => setViewing(null)}>
            关闭
          </button>
        }
      >
        {viewing && <QuestionView question={viewing} sets={allSets} />}
      </Sheet>
    </div>
  )
}
