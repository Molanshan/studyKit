import type { QuestionOption, QuestionType } from '../../types'

const TRUE_WORDS = new Set(['对', '正确', '√', '✓', 't', 'true', '是', 'yes', 'y'])
const FALSE_WORDS = new Set(['错', '错误', '×', '✗', 'x', 'f', 'false', '否', 'no', 'n'])

export function normalizeJudge(raw: string): '对' | '错' | null {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/[\s。.，,；;：:（）()【】[\]]/g, '')
  if (!value) return null
  if (TRUE_WORDS.has(value)) return '对'
  if (FALSE_WORDS.has(value)) return '错'
  return null
}

export function splitAnswerLetters(raw: string): string[] {
  const cleaned = raw.toUpperCase().replace(/[^A-H]/g, '')
  return Array.from(new Set(cleaned.split(''))).sort()
}

/** 统计题干中的填空位（连续下划线） */
export function countBlanks(content: string): number {
  return (content.match(/_{2,}/g) ?? []).length
}

export function splitBlanks(answer: string, content: string): string[] {
  const raw = answer.trim()
  if (!raw) return []
  if (/[|｜]/.test(raw)) {
    return raw.split(/[|｜]/).map((part) => part.trim())
  }
  const blankCount = countBlanks(content)
  if (blankCount > 1 && /[；;]/.test(raw)) {
    return raw.split(/[；;]/).map((part) => part.trim())
  }
  if (blankCount > 1 && /[①②③④⑤⑥⑦⑧⑨⑩]/.test(raw)) {
    return raw
      .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/)
      .map((part) => part.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim())
      .filter(Boolean)
  }
  if (blankCount > 1 && /(?:^|\s)[1-9]\s*[.、)）]/.test(raw)) {
    return raw
      .split(/(?:^|\s)(?=[1-9]\s*[.、)）]\s*)/)
      .map((part) => part.replace(/^[1-9]\s*[.、)）]\s*/, '').trim())
      .filter(Boolean)
  }
  return [raw]
}

export interface InferInput {
  content: string
  options: QuestionOption[]
  answer: string
}

export interface InferResult {
  type: QuestionType
  multiple: boolean
  score: number
  reason: string
}

/** 无显式分区时，用多信号打分推断题型 */
export function inferQuestionType(input: InferInput): InferResult {
  const { content, options, answer } = input
  const scores: Record<QuestionType, number> = { choice: 0, fill: 0, judge: 0, short: 0, term: 0 }
  const reasons: string[] = []

  const optionTexts = options.map((option) => option.content.trim())
  const judgeOptions =
    options.length === 2 &&
    optionTexts.every((text) => /^(对|错|正确|错误|是|否|true|false|√|×|✓|✗)$/i.test(text))
  const judge = normalizeJudge(answer)
  const letters = splitAnswerLetters(answer)
  const blanks = countBlanks(content)
  const hasBar = /[|｜]/.test(answer)

  if (options.length >= 2) {
    scores.choice += 0.6
    reasons.push('选项≥2')
  }
  if (judgeOptions && judge) {
    scores.judge += 0.95
    reasons.push('选项为对/错')
  } else if (judge && options.length < 2) {
    scores.judge += 0.85
    reasons.push('答案为对/错')
  }
  if (letters.length && options.length < 2) {
    scores.choice += 0.35
    reasons.push('答案为选项字母')
  }
  if (hasBar) {
    scores.fill += 0.6
    reasons.push('答案含分隔符')
  }
  if (blanks >= 2) {
    scores.fill += 0.55
    reasons.push('多个填空位')
  } else if (blanks === 1) {
    scores.fill += 0.35
  }
  if (/简述|论述|试述|阐述|说明|分析|比较|为什么|如何|谈谈|举例|评价|意义|作用|什么是|什么叫|解释/.test(content)) {
    scores.short += 0.4
    reasons.push('题干含简答关键词')
  }
  if (!options.length && answer.length > 30) {
    scores.short += 0.3
    reasons.push('答案较长')
  }
  if (!options.length && content.length <= 12 && answer.length > 8) {
    scores.term += 0.35
    reasons.push('题干短、答案较长')
  }
  if (/名词解释|定义|是指|指的是/.test(content)) {
    scores.term += 0.2
  }

  let type: QuestionType = 'short'
  let best = 0
  ;(Object.keys(scores) as QuestionType[]).forEach((key) => {
    if (scores[key] > best) {
      best = scores[key]
      type = key
    }
  })

  if (best === 0) {
    type = blanks > 0 ? 'fill' : 'short'
    best = 0.3
  }

  return {
    type,
    multiple: letters.length > 1 && scores.choice > 0 && scores.choice === best,
    score: best,
    reason: reasons.join('、') || '默认',
  }
}
