import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Pencil, Play, Trash2, X } from 'lucide-react'
import { db, deleteSet, removeQuestionsFromSet, updateSet } from '../lib/db'
import { COLORS } from '../lib/constants'
import { useAppStore } from '../lib/store'
import { truncate } from '../lib/utils'
import { EmptyState, Sheet, TypeBadge } from '../components/ui'
import { QuestionView } from '../components/QuestionView'
import type { Question } from '../types'

export function SetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)
  const editMode = useAppStore((state) => state.editMode)
  const setEditMode = useAppStore((state) => state.setEditMode)

  const set = useLiveQuery(
    () => (id ? db.questionSets.get(id).then((value) => value ?? null) : null),
    [id],
    undefined,
  )
  const questions = useLiveQuery(
    () => (id ? db.questions.where('setIds').equals(id).toArray() : []),
    [id],
    undefined,
  )

  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewing, setViewing] = useState<Question | null>(null)

  const sorted = useMemo(() => [...(questions ?? [])].sort((a, b) => a.order - b.order), [questions])

  if (set === undefined || questions === undefined) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted" style={{ fontSize: 13.5 }}>
            正在读取题集…
          </p>
        </div>
      </div>
    )
  }

  if (!set) {
    return (
      <div className="page">
        <EmptyState
          icon={<X size={24} />}
          title="题集不存在"
          description="它可能已经被删除了。"
          action={
            <Link className="btn" to="/library">
              返回题库
            </Link>
          }
        />
      </div>
    )
  }

  const color = COLORS[set.color] ?? COLORS.sky

  return (
    <div className="page">
      <header className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="eyebrow">题集</p>
            <h1 style={{ fontSize: 22 }}>{set.name}</h1>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {editMode && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => {
                setName(set.name)
                setRenaming(true)
              }}
              aria-label="重命名"
            >
              <Pencil size={17} />
            </button>
          )}
          <button
            className={editMode ? 'btn btn-soft btn-sm' : 'btn btn-sm'}
            onClick={() => {
              setEditMode(!editMode)
              setViewing(null)
              setRenaming(false)
              setConfirmDelete(false)
            }}
          >
            {editMode ? <Check size={15} /> : <Pencil size={15} />}
            {editMode ? '完成' : '编辑'}
          </button>
        </div>
      </header>

      {editMode && (
        <div className="edit-banner">
          <Pencil size={14} />
          <span>编辑模式：可重命名、删除题集，或把题目移出题集</span>
        </div>
      )}

      <div
        className="card"
        style={{
          background: color.bg,
          borderColor: color.border,
          color: color.text,
        }}
      >
        <div className="row-between">
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{sorted.length}</div>
            <div style={{ fontSize: 12.5, opacity: 0.8 }}>
              道题 · {editMode ? '可增删题目、重命名或删除题集' : '集中练习这一组题'}
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={sorted.length === 0}
            onClick={() => navigate(`/practice?source=set:${set.id}`)}
          >
            <Play size={16} />
            开始练习
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Play size={24} />}
          title="题集还是空的"
          description={
            editMode
              ? '去题库里挑几道题，或者导入时直接加入这个题集。'
              : '这个题集还没有题目，切到编辑模式可以往里面加题。'
          }
          action={
            <Link className="btn" to="/library">
              {editMode ? '去题库挑题' : '返回题库'}
            </Link>
          }
        />
      ) : (
        <div className="card flush">
          <div className="list" style={{ padding: '0 14px' }}>
            {sorted.map((question) => (
              <div key={question.id} className="list-row">
                <TypeBadge type={question.type} multiple={question.multiple} />
                <button
                  className="grow row-button"
                  onClick={() => setViewing(question)}
                >
                  <div className="title">{truncate(question.content, 70)}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    {question.status === 'draft' && <span className="badge warn">待补答案</span>}
                    <span className="tiny">{question.options.length > 0 ? `${question.options.length} 个选项` : ''}</span>
                  </div>
                </button>
                {editMode && (
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label="移出题集"
                    onClick={async () => {
                      await removeQuestionsFromSet([question.id], set.id)
                      showToast('已移出题集，题目仍在题库中')
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editMode && (
        <button className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} />
          删除题集
        </button>
      )}

      <Sheet
        open={renaming}
        title="重命名题集"
        onClose={() => setRenaming(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setRenaming(false)}>
              取消
            </button>
            <button
              className="btn btn-primary btn-block"
              onClick={async () => {
                if (!name.trim()) return
                await updateSet(set.id, { name: name.trim() })
                setRenaming(false)
                showToast('已重命名', 'success')
              }}
            >
              保存
            </button>
          </>
        }
      >
        <div className="field">
          <label>题集名称</label>
          <input
            className="input"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </Sheet>

      <Sheet
        open={confirmDelete}
        title="删除题集？"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button className="btn btn-block" onClick={() => setConfirmDelete(false)}>
              取消
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                await deleteSet(set.id)
                showToast('题集已删除，题目仍保留在题库')
                navigate('/library', { replace: true })
              }}
            >
              删除
            </button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 14 }}>
          只会删除这个题集，里面的 {sorted.length} 道题仍会保留在题库中。
        </p>
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
        {viewing && <QuestionView question={viewing} sets={[set]} />}
      </Sheet>

      <Link to="/library" className="btn btn-ghost btn-block">
        返回题库
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}
