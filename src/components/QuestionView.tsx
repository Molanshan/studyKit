import { Check } from 'lucide-react'
import type { Question, QuestionSet } from '../types'
import { TypeBadge } from './ui'

function answerText(question: Question): string {
  if (!question.answer.trim()) return '暂无答案'
  if (question.type === 'choice') {
    const letters = question.answer.toUpperCase().replace(/[^A-H]/g, '').split('')
    return letters.length > 0 ? letters.join('、') : question.answer
  }
  if (question.type === 'fill') {
    const parts = question.answer
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length > 1) return parts.map((part, index) => `${index + 1}. ${part}`).join('\n')
  }
  return question.answer
}

function isCorrectOption(question: Question, label: string, content: string): boolean {
  if (question.type === 'judge') {
    return content.trim() === question.answer.trim()
  }
  const letters = new Set(question.answer.toUpperCase().replace(/[^A-H]/g, '').split(''))
  return letters.has(label.toUpperCase())
}

export function QuestionView({
  question,
  sets,
}: {
  question: Question
  sets: QuestionSet[]
}) {
  const questionSets = sets.filter((set) => question.setIds.includes(set.id))

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <TypeBadge type={question.type} multiple={question.multiple} />
        {question.status === 'draft' && <span className="badge warn">待补答案</span>}
        {question.favorite && <span className="badge">已收藏</span>}
      </div>

      <div className="question-stem">{question.content}</div>

      {question.options.length > 0 && (
        <div className="options">
          {question.options.map((option) => {
            const correct = isCorrectOption(question, option.label, option.content)
            return (
              <div
                key={option.label}
                className="option option-static"
                data-state={correct ? 'correct' : undefined}
              >
                <span className="option-key">{option.label}</span>
                <span className="grow">{option.content}</span>
                {correct && <Check size={16} />}
              </div>
            )
          })}
        </div>
      )}

      <div className="read-block">
        <div className="tiny">正确答案</div>
        <div className="read-answer">{answerText(question)}</div>
      </div>

      {question.explanation.trim() && (
        <div className="read-block">
          <div className="tiny">解析</div>
          <div className="read-text">{question.explanation}</div>
        </div>
      )}

      {questionSets.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="tiny">所属题集</span>
          {questionSets.map((set) => (
            <span key={set.id} className="badge">
              {set.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
