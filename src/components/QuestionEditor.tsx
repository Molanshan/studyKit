import { Plus, Trash2 } from 'lucide-react'
import { QUESTION_VIEWS } from '../lib/constants'
import type { QuestionOption, QuestionType } from '../types'

export interface EditableQuestion {
  type: QuestionType
  multiple: boolean
  content: string
  options: QuestionOption[]
  answer: string
  explanation: string
  blankCount: number
}

export function toEditable(source: {
  type: QuestionType
  multiple: boolean
  content: string
  options: QuestionOption[]
  answer: string
  explanation: string
  blankCount: number
}): EditableQuestion {
  return {
    type: source.type,
    multiple: source.multiple,
    content: source.content,
    options: source.options.map((option) => ({ ...option })),
    answer: source.answer,
    explanation: source.explanation,
    blankCount: source.blankCount,
  }
}

function relabel(options: QuestionOption[]): QuestionOption[] {
  return options.map((option, index) => ({
    ...option,
    label: String.fromCharCode(65 + index),
  }))
}

export function QuestionEditor({
  value,
  onChange,
}: {
  value: EditableQuestion
  onChange: (next: EditableQuestion) => void
}) {
  const currentKey = value.type === 'choice' ? (value.multiple ? 'multiple' : 'single') : value.type

  const patch = (next: Partial<EditableQuestion>) => onChange({ ...value, ...next })

  const changeType = (key: string) => {
    const view = QUESTION_VIEWS.find((item) => item.key === key)
    if (!view) return
    const next: Partial<EditableQuestion> = { type: view.type, multiple: !!view.multiple }
    if (view.type === 'judge' && !['对', '错'].includes(value.answer)) next.answer = ''
    if (view.type !== 'choice') next.options = []
    if (view.type === 'choice' && value.options.length === 0) {
      next.options = [
        { label: 'A', content: '' },
        { label: 'B', content: '' },
        { label: 'C', content: '' },
        { label: 'D', content: '' },
      ]
    }
    onChange({ ...value, ...next })
  }

  const updateOption = (index: number, content: string) => {
    const options = value.options.map((option, i) => (i === index ? { ...option, content } : option))
    patch({ options })
  }

  const addOption = () => {
    const label = String.fromCharCode(65 + value.options.length)
    patch({ options: [...value.options, { label, content: '' }] })
  }

  const removeOption = (index: number) => {
    patch({ options: relabel(value.options.filter((_, i) => i !== index)) })
  }

  return (
    <div className="stack">
      <div className="field">
        <label>题型</label>
        <select className="select" value={currentKey} onChange={(event) => changeType(event.target.value)}>
          {QUESTION_VIEWS.map((view) => (
            <option key={view.key} value={view.key}>
              {view.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>题干</label>
        <textarea
          className="textarea"
          value={value.content}
          onChange={(event) => patch({ content: event.target.value })}
          placeholder="输入题干，填空位用 ______ 表示"
        />
      </div>

      {value.type === 'choice' && (
        <div className="field">
          <label>选项</label>
          <div className="stack" style={{ gap: 8 }}>
            {value.options.map((option, index) => (
              <div className="row" key={option.label}>
                <span className="option-key">{option.label}</span>
                <input
                  className="input"
                  value={option.content}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`选项 ${option.label}`}
                />
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => removeOption(index)}
                  aria-label="删除选项"
                  disabled={value.options.length <= 2}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addOption} style={{ alignSelf: 'flex-start' }}>
              <Plus size={15} />
              添加选项
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <label>答案</label>
        {value.type === 'judge' ? (
          <div className="row">
            {(['对', '错'] as const).map((item) => (
              <button
                key={item}
                className={`chip ${value.answer === item ? '' : ''}`}
                data-active={value.answer === item}
                onClick={() => patch({ answer: item })}
              >
                {item}
              </button>
            ))}
          </div>
        ) : value.type === 'short' || value.type === 'term' ? (
          <textarea
            className="textarea"
            value={value.answer}
            onChange={(event) => patch({ answer: event.target.value })}
            placeholder="参考答案"
          />
        ) : (
          <input
            className="input"
            value={value.answer}
            onChange={(event) => patch({ answer: event.target.value })}
            placeholder={
              value.type === 'fill'
                ? '多个空用 | 分隔，例如：来源|唯一标准'
                : '例如：B 或 ABC'
            }
          />
        )}
        {value.type === 'fill' && (
          <span className="tiny">当前答案按 | 分成 {value.answer.split('|').filter(Boolean).length} 个空</span>
        )}
      </div>

      <div className="field">
        <label>解析（可选）</label>
        <textarea
          className="textarea"
          value={value.explanation}
          onChange={(event) => patch({ explanation: event.target.value })}
          placeholder="补充说明、考点提示"
        />
      </div>
    </div>
  )
}
