import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Play,
  Upload,
} from 'lucide-react'
import { parseText } from '../lib/parser/parse'
import { extractTextFromFile } from '../lib/parser/extract'
import { DEMO_TEXT, SAMPLE_MESSY, SAMPLE_NO_NUMBER, SAMPLE_STANDARD } from '../lib/parser/fixtures'
import { useAppStore } from '../lib/store'
import { truncate } from '../lib/utils'
import { TypeBadge } from '../components/ui'
import type { ParseResult } from '../types'

const SAMPLES: Array<{ label: string; text: string }> = [
  { label: '标准模板', text: SAMPLE_STANDARD },
  { label: '杂排文档', text: SAMPLE_MESSY },
  { label: '无题号', text: SAMPLE_NO_NUMBER },
  { label: '示例题库', text: DEMO_TEXT },
]

export function DebugParser() {
  const navigate = useNavigate()
  const showToast = useAppStore((state) => state.showToast)
  const fileInput = useRef<HTMLInputElement>(null)

  const [text, setText] = useState(SAMPLE_STANDARD)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = () => {
    if (!text.trim()) {
      showToast('先输入一些文本', 'error')
      return
    }
    setResult(parseText(text))
  }

  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const extracted = await extractTextFromFile(file)
      setText(extracted.text)
      setResult(parseText(extracted.text))
      if (extracted.warnings.length) showToast(extracted.warnings[0])
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '提取失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const issueCount = useMemo(
    () => (result ? result.questions.reduce((sum, question) => sum + question.issues.length, 0) : 0),
    [result],
  )

  const copyJson = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            stats: result.stats,
            unparsed: result.unparsed,
            questions: result.questions.map((question) => ({
              type: question.type,
              multiple: question.multiple,
              content: question.content,
              options: question.options,
              answer: question.answer,
              explanation: question.explanation,
              blankCount: question.blankCount,
              confidence: question.confidence,
              issues: question.issues,
              line: question.line,
            })),
          },
          null,
          2,
        ),
      )
      showToast('已复制 JSON', 'success')
    } catch {
      showToast('复制失败，浏览器可能不允许', 'error')
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="eyebrow">开发工具</p>
            <h1 style={{ fontSize: 22 }}>解析器调试</h1>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          <Play size={15} />
          解析
        </button>
      </header>

      <div className="chip-row">
        {SAMPLES.map((sample) => (
          <button
            key={sample.label}
            className="chip"
            onClick={() => {
              setText(sample.text)
              setResult(parseText(sample.text))
            }}
          >
            {sample.label}
          </button>
        ))}
        <button className="chip" onClick={() => fileInput.current?.click()}>
          <Upload size={13} />
          读取文件
        </button>
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

      <div className="field">
        <label>原始文本（{text.length} 字符）</label>
        <textarea
          className="textarea"
          style={{ minHeight: 180, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="粘贴复习题文本，或用上方按钮读取 docx / txt / pdf"
        />
      </div>

      {result && (
        <>
          <div className="card">
            <div className="stat-strip">
              <div className="stat-pill">
                <strong>{result.questions.length}</strong> 题
              </div>
              <div className="stat-pill">
                <strong>{result.elapsedMs}</strong> ms
              </div>
              <div className="stat-pill" style={{ color: issueCount ? 'var(--warning)' : undefined }}>
                <strong>{issueCount}</strong> 个问题
              </div>
              <div
                className="stat-pill"
                style={{ color: result.unparsed.length ? 'var(--warning)' : undefined }}
              >
                <strong>{result.unparsed.length}</strong> 未识别片段
              </div>
              <div className="stat-pill">
                <strong>{result.stats.lowConfidence}</strong> 低置信度
              </div>
            </div>
            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {result.questions.map((question, index) => (
                <span
                  key={`${question.line}_${index}`}
                  className="badge"
                  title={`第 ${question.line} 行 · 置信度 ${Math.round(question.confidence * 100)}%`}
                  style={
                    question.confidence < 0.75 || question.issues.length
                      ? { background: 'var(--warning-soft)', color: 'var(--warning)' }
                      : undefined
                  }
                >
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn btn-soft btn-sm" onClick={copyJson}>
                <Copy size={14} />
                复制 JSON
              </button>
              <span className="tiny">标题：{result.title || '（未识别）'}</span>
            </div>
          </div>

          {result.unparsed.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>未识别片段</h3>
                <span className="badge warn">{result.unparsed.length}</span>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {result.unparsed.map((chunk, index) => (
                  <div key={`${chunk}_${index}`} className="row" style={{ alignItems: 'flex-start' }}>
                    <FileText size={15} color="var(--ink-3)" style={{ marginTop: 3 }} />
                    <span className="muted" style={{ flex: 1, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                      {truncate(chunk, 200)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stack">
            {result.questions.map((question, index) => (
              <div className="card" key={`${question.line}_${index}`} style={{ padding: 16 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="badge">{index + 1}</span>
                  <TypeBadge type={question.type} multiple={question.multiple} />
                  <span className="tiny">第 {question.line} 行</span>
                  <span
                    className="badge"
                    style={
                      question.confidence < 0.75
                        ? { background: 'var(--warning-soft)', color: 'var(--warning)' }
                        : { background: 'var(--success-soft)', color: 'var(--success)' }
                    }
                  >
                    {Math.round(question.confidence * 100)}%
                  </span>
                  {question.duplicateOf !== undefined && (
                    <span className="badge danger">重复第 {question.duplicateOf + 1} 题</span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 550, whiteSpace: 'pre-wrap' }}>
                  {question.content}
                </div>
                {question.options.length > 0 && (
                  <div className="stack" style={{ gap: 3, marginTop: 8 }}>
                    {question.options.map((option) => (
                      <div key={option.label} className="tiny">
                        {option.label}. {option.content}
                      </div>
                    ))}
                  </div>
                )}
                <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span className="tiny">
                    答案：<strong style={{ color: 'var(--ink)' }}>{question.answer || '（空）'}</strong>
                  </span>
                  {question.type === 'fill' && (
                    <span className="tiny">空数：{question.blankCount}</span>
                  )}
                </div>
                {question.explanation && (
                  <div className="tiny" style={{ marginTop: 6 }}>
                    解析：{truncate(question.explanation, 120)}
                  </div>
                )}
                {question.issues.length > 0 && (
                  <div className="alert" style={{ marginTop: 10 }}>
                    <AlertTriangle size={15} />
                    <div>
                      {question.issues.map((issue) => (
                        <div key={`${issue.field}_${issue.message}`}>
                          [{issue.severity}] {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {question.issues.length === 0 && question.confidence >= 0.75 && (
                  <div className="row" style={{ gap: 5, marginTop: 8 }}>
                    <CheckCircle2 size={13} color="var(--success)" />
                    <span className="tiny" style={{ color: 'var(--success)' }}>
                      字段完整
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
