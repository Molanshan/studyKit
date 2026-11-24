import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  FileText,
  Pencil,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { extractTextFromFile, isSupportedFile } from '../lib/parser/extract'
import { parseText } from '../lib/parser/parse'
import { DEMO_TEXT } from '../lib/parser/fixtures'
import { importQuestions } from '../lib/db'
import { useAppStore } from '../lib/store'
import { QUESTION_VIEWS, TYPE_META } from '../lib/constants'
import { truncate } from '../lib/utils'
import { Sheet, TypeBadge } from '../components/ui'
import { QuestionEditor, toEditable, type EditableQuestion } from '../components/QuestionEditor'
import type { ImportDraft, ParseResult, ParsedQuestion, QuestionType } from '../types'

type Step = 'source' | 'review'
type SourceType = 'file' | 'paste' | 'demo'

const EMPTY_ISSUES: ParsedQuestion['issues'] = []

export function ImportPage() {
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)

  const [step, setStep] = useState<Step>('source')
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [pasteText, setPasteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const [result, setResult] = useState<ParseResult | null>(null)
  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [fileName, setFileName] = useState<string | undefined>()
  const [sourceType, setSourceType] = useState<SourceType>('file')
  const [title, setTitle] = useState('')
  const [setName, setSetName] = useState('')
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const [editing, setEditing] = useState<ImportDraft | null>(null)
  const [editDraft, setEditDraft] = useState<EditableQuestion | null>(null)
  const [importing, setImporting] = useState(false)

  const openReview = (
    parsed: ParseResult,
    source: SourceType,
    name?: string,
  ) => {
    const fallbackTitle = name ? name.replace(/\.[^.]+$/, '') : '粘贴导入'
    const finalTitle = parsed.title || fallbackTitle
    setResult(parsed)
    setTitle(finalTitle)
    setSetName(finalTitle)
    setFileName(name)
    setSourceType(source)
    setDrafts(
      parsed.questions.map((question, index) => ({
        ...question,
        tempId: `draft_${Date.now()}_${index}`,
        included: true,
      })),
    )
    setFilter('all')
    setStep('review')
  }

  const handleFile = async (file: File) => {
    if (!isSupportedFile(file)) {
      setError('暂不支持这个格式，请使用 docx、txt、md 或文本型 PDF')
      return
    }
    setLoading(true)
    setError('')
    try {
      const extracted = await extractTextFromFile(file)
      const parsed = parseText(extracted.text)
      if (extracted.warnings.length) showToast(extracted.warnings[0])
      openReview(parsed, 'file', file.name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '解析失败，请换一个文件试试')
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setError('先粘贴一些题目内容')
      return
    }
    setError('')
    const parsed = parseText(pasteText)
    openReview(parsed, 'paste')
  }

  const handleDemo = () => {
    const parsed = parseText(DEMO_TEXT)
    openReview(parsed, 'demo', '题Kit 示例题库.txt')
  }

  const included = drafts.filter((draft) => draft.included)
  const stats = useMemo(() => {
    const byType: Record<QuestionType, number> = { choice: 0, fill: 0, judge: 0, short: 0, term: 0 }
    let attention = 0
    for (const draft of drafts) {
      byType[draft.type] += 1
      if (draft.confidence < 0.75 || draft.issues.length > 0) attention += 1
    }
    return { byType, attention }
  }, [drafts])

  const shownDrafts = useMemo(
    () =>
      filter === 'attention'
        ? drafts.filter((draft) => draft.confidence < 0.75 || draft.issues.length > 0)
        : drafts,
    [drafts, filter],
  )

  const patchDraft = (tempId: string, patch: Partial<ImportDraft>) => {
    setDrafts((items) => items.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)))
  }

  const saveEdit = () => {
    if (!editing || !editDraft) return
    const blankCount =
      editDraft.type === 'fill' ? Math.max(editDraft.answer.split('|').filter(Boolean).length, 1) : 0
    patchDraft(editing.tempId, {
      type: editDraft.type,
      multiple: editDraft.multiple,
      content: editDraft.content.trim(),
      options: editDraft.options.filter((option) => option.content.trim()),
      answer: editDraft.answer.trim(),
      explanation: editDraft.explanation.trim(),
      blankCount,
      confidence: 1,
      issues: [],
    })
    setEditing(null)
    setEditDraft(null)
    showToast('已修正，记得重新核对统计')
  }

  const convertUnparsed = (text: string, index: number) => {
    const draft: ImportDraft = {
      tempId: `unparsed_${Date.now()}_${index}`,
      type: 'short',
      multiple: false,
      content: text,
      options: [],
      answer: '',
      explanation: '',
      blankCount: 0,
      confidence: 0.5,
      issues: [
        { field: 'general', severity: 'warning', message: '由「未识别片段」转为题目，请补充答案' },
      ],
      raw: text,
      line: 0,
      included: true,
    }
    setDrafts((items) => [...items, draft])
    setResult((current) =>
      current ? { ...current, unparsed: current.unparsed.filter((_, i) => i !== index) } : current,
    )
    setEditing(draft)
    setEditDraft(toEditable(draft))
  }

  const doImport = async () => {
    if (included.length === 0) return
    setImporting(true)
    try {
      const outcome = await importQuestions(included, {
        title: title.trim() || '未命名题库',
        fileName,
        sourceType,
        source: fileName,
        set: setName.trim() ? { name: setName.trim() } : undefined,
      })
      showToast(`已导入 ${included.length} 道题`, 'success')
      navigate(outcome.setId ? `/sets/${outcome.setId}` : '/library', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  if (step === 'source') {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">导入</p>
            <h1>把题目变进题库</h1>
          </div>
        </header>

        <div className="segmented">
          <button data-active={tab === 'file'} onClick={() => setTab('file')}>
            文件导入
          </button>
          <button data-active={tab === 'paste'} onClick={() => setTab('paste')}>
            粘贴文本
          </button>
        </div>

        {error && (
          <div className="alert error">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'file' ? (
          <>
            <div
              className="dropzone"
              data-over={dragOver}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                const file = event.dataTransfer.files?.[0]
                if (file) void handleFile(file)
              }}
              onClick={() => fileInput.current?.click()}
            >
              <div className="empty-icon" style={{ width: 48, height: 48 }}>
                <Upload size={22} />
              </div>
              <strong>{loading ? '正在解析…' : '点击选择，或把文件拖到这里'}</strong>
              <span>支持 docx / txt / md / 文本型 PDF，单文件建议不超过 20MB</span>
              <input
                ref={fileInput}
                type="file"
                accept=".docx,.txt,.md,.markdown,.pdf"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                  event.target.value = ''
                }}
              />
            </div>

            <div className="alert">
              <AlertTriangle size={17} />
              <span>
                旧版 .doc 需要先用 Word 另存为 .docx；扫描版 PDF 没有文字层，无法直接解析。
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>粘贴题目文本</label>
              <textarea
                className="textarea"
                style={{ minHeight: 220 }}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={'从微信、QQ 或网页复制题目后粘贴到这里。\n\n1. 题干\nA. 选项一\nB. 选项二\n答案：A'}
              />
            </div>
            <button className="btn btn-primary btn-block" onClick={handlePaste} disabled={loading}>
              <ClipboardPaste size={17} />
              解析文本
            </button>
          </>
        )}

        <div className="card">
          <div className="card-head">
            <h3>不知道怎么写？</h3>
            <span className="badge">推荐</span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            用固定格式最稳：题型分区 + 题号 + 选项 + 「答案：」+「解析：」。也支持无分区的常见排版。
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-soft btn-sm" onClick={handleDemo}>
              <Sparkles size={15} />
              载入示例体验
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
              查看模板说明
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>解析器会做什么</h3>
          <div className="stack" style={{ gap: 8 }}>
            {[
              '识别题型分区与题号，不把解析里的编号当新题',
              '拆开一行里的多个选项，识别括号中的判断答案',
              '自动拆分多空填空，按空给分',
              '不确定的题会标出来，不会静默丢掉',
            ].map((text) => (
              <div key={text} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <Check size={15} color="var(--success)" style={{ marginTop: 3 }} />
                <span className="muted" style={{ fontSize: 13 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setStep('source')}
            aria-label="返回"
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="eyebrow">解析结果</p>
            <h1 style={{ fontSize: 22 }}>{drafts.length} 道题</h1>
          </div>
        </div>
        <span className="tiny">{result?.elapsedMs ?? 0}ms</span>
      </header>

      {error && (
        <div className="alert error">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="stat-strip">
          <div className="stat-pill">
            <strong>{drafts.length}</strong> 题
          </div>
          {QUESTION_VIEWS.map((view) => {
            const count =
              view.type === 'choice'
                ? view.multiple
                  ? drafts.filter((draft) => draft.type === 'choice' && draft.multiple).length
                  : drafts.filter((draft) => draft.type === 'choice' && !draft.multiple).length
                : stats.byType[view.type]
            if (!count) return null
            return (
              <div className="stat-pill" key={view.key}>
                {view.shortLabel} <strong>{count}</strong>
              </div>
            )
          })}
          {result && result.unparsed.length > 0 && (
            <div className="stat-pill" style={{ color: 'var(--warning)' }}>
              未识别 <strong>{result.unparsed.length}</strong>
            </div>
          )}
        </div>

        <div className="divider" style={{ margin: '14px 0' }} />

        <div className="field">
          <label>加入题集</label>
          <input
            className="input"
            value={setName}
            onChange={(event) => setSetName(event.target.value)}
            placeholder="留空则不归类，之后也能随时加入"
          />
          <span className="tiny">同名题集会直接合并，不会重复创建。</span>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-primary btn-block"
            onClick={doImport}
            disabled={included.length === 0 || importing}
          >
            {importing ? '正在导入…' : `导入 ${included.length} 道题`}
          </button>
        </div>
      </div>

      {stats.attention > 0 && (
        <div className="alert">
          <AlertTriangle size={17} />
          <span>
            有 {stats.attention} 道题需要确认（低置信度或字段异常）。可以直接导入，之后再改。
          </span>
        </div>
      )}

      <div className="segmented">
        <button data-active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 {drafts.length}
        </button>
        <button data-active={filter === 'attention'} onClick={() => setFilter('attention')}>
          待确认 {stats.attention}
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setDrafts((items) =>
              items.map((item) => ({
                ...item,
                included: !items.every((entry) => entry.included),
              })),
            )
          }
        >
          {drafts.every((item) => item.included) ? '全部取消' : '全部包含'}
        </button>
      </div>

      <div className="stack">
        {shownDrafts.map((draft) => (
          <div className="draft-row" key={draft.tempId}>
            <div className="draft-head">
              <button
                className="toggle"
                data-on={draft.included}
                style={{ width: 24, height: 24, flex: '0 0 24px', borderRadius: 7 }}
                aria-label={draft.included ? '取消包含' : '包含'}
                onClick={() => patchDraft(draft.tempId, { included: !draft.included })}
              >
                {draft.included && <Check size={14} color="#fff" />}
              </button>
              <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <TypeBadge type={draft.type} multiple={draft.multiple} />
                  {draft.confidence < 0.75 && <span className="badge warn">待确认</span>}
                  {draft.duplicateOf !== undefined && <span className="badge">重复</span>}
                  {draft.issues.length > 0 && (
                    <span className="badge danger">{draft.issues.length} 个问题</span>
                  )}
                </div>
                <div style={{ fontSize: 14, marginTop: 6, fontWeight: 550 }}>
                  {truncate(draft.content, 80)}
                </div>
                {draft.issues[0] && (
                  <div className="tiny" style={{ color: 'var(--warning)', marginTop: 4 }}>
                    {draft.issues[0].message}
                  </div>
                )}
              </div>
              <button
                className="btn btn-ghost btn-icon"
                aria-label="编辑"
                onClick={() => {
                  setEditing(draft)
                  setEditDraft(toEditable(draft))
                }}
              >
                <Pencil size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {result && result.unparsed.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>未识别片段</h3>
            <span className="badge warn">{result.unparsed.length}</span>
          </div>
          <p className="tiny" style={{ marginBottom: 10 }}>
            这些文字没有被归入任何题目。可以转成题目，也可以忽略。
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {result.unparsed.map((text, index) => (
              <div key={`${text}_${index}`} className="row" style={{ alignItems: 'flex-start' }}>
                <FileText size={15} color="var(--ink-3)" style={{ marginTop: 3 }} />
                <span className="muted" style={{ flex: 1, fontSize: 13 }}>
                  {truncate(text, 90)}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => convertUnparsed(text, index)}>
                  转为题目
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        onClick={doImport}
        disabled={included.length === 0 || importing}
      >
        {importing ? '正在导入…' : `导入 ${included.length} 道题`}
      </button>

      <Sheet
        open={!!editing && !!editDraft}
        title="修正题目"
        onClose={() => {
          setEditing(null)
          setEditDraft(null)
        }}
        footer={
          <>
            <button
              className="btn btn-block"
              onClick={() => {
                if (!editing) return
                setDrafts((items) => items.filter((item) => item.tempId !== editing.tempId))
                setEditing(null)
                setEditDraft(null)
              }}
            >
              <X size={16} />
              不导入这题
            </button>
            <button className="btn btn-primary btn-block" onClick={saveEdit}>
              保存修正
            </button>
          </>
        }
      >
        {editDraft && <QuestionEditor value={editDraft} onChange={setEditDraft} />}
        {editing && editing.issues.length > 0 && (
          <div className="alert" style={{ marginTop: 14 }}>
            <AlertTriangle size={16} />
            <div>
              {editing.issues.map((issue) => (
                <div key={issue.message}>{issue.message}</div>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
