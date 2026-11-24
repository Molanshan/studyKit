import type {
  ParseIssue,
  ParseResult,
  ParseStats,
  ParsedQuestion,
  QuestionOption,
  QuestionType,
} from '../../types'
import { cleanParagraph, normalizeText, tidyStem, type SourceLine } from './normalize'
import {
  countBlanks,
  inferQuestionType,
  normalizeJudge,
  splitAnswerLetters,
  splitBlanks,
} from './classify'

type Zone = 'stem' | 'options' | 'answer' | 'explanation'

interface Section {
  type: QuestionType
  multiple: boolean
  title: string
}

interface Draft {
  number: number
  type?: QuestionType
  explicit: boolean
  multiple: boolean
  content: string[]
  options: QuestionOption[]
  answer: string[]
  explanation: string[]
  zone: Zone
  startLine: number
  raw: string[]
}

const HEADER_WORDS: Array<{ re: RegExp; type: QuestionType; multiple?: boolean }> = [
  { re: /^不定项选择(题)?$/, type: 'choice', multiple: true },
  { re: /^多项选择(题)?$/, type: 'choice', multiple: true },
  { re: /^多选(题)?$/, type: 'choice', multiple: true },
  { re: /^单项选择(题)?$/, type: 'choice', multiple: false },
  { re: /^单选(题)?$/, type: 'choice', multiple: false },
  { re: /^选择(题)?$/, type: 'choice', multiple: false },
  { re: /^填空(题)?$/, type: 'fill' },
  { re: /^判断(题)?$/, type: 'judge' },
  { re: /^名词解释(题)?$/, type: 'term' },
  { re: /^(简答|论述|计算|案例分析|综合|分析)(题)?$/, type: 'short' },
]

const HEADER_PREFIX =
  /^(?:[一二三四五六七八九十百]+\s*[、.．]|第\s*[一二三四五六七八九十百]+\s*(?:部分|大题|题)?|[（(]\s*[一二三四五六七八九十百]+\s*[）)])\s*/

const OPTION_RE = /^([A-Ha-h])\s*[.、．)）:：]\s*(.*)$/
const ANSWER_PATTERNS = [
  /^【\s*(?:参考|正确|标准)?答案\s*】\s*[:：]?\s*(.*)$/,
  /^(?:参考|正确|标准)?答案\s*[:：]\s*(.*)$/,
  /^(?:参考|正确|标准)?答案\s*$/,
  /^(?:参考|正确|标准)?答案\s+([A-Ha-h]{1,8}|对|错|正确|错误|√|×|✓|✗)\s*$/,
]
const EXPLAIN_PATTERNS = [
  /^【\s*(?:答案)?解析\s*】\s*[:：]?\s*(.*)$/,
  /^(?:答案)?解析\s*[:：]\s*(.*)$/,
  /^(?:答案)?解析\s*$/,
  /^分析\s*[:：]\s*(.*)$/,
]
const KEY_HEADER = /^(?:参考|标准)?答案(?:汇总|速查|表|清单)?$/

function matchPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return (match[1] ?? '').trim()
  }
  return null
}

function isAnswerKeyHeader(text: string, hasCurrent: boolean): boolean {
  if (/^(?:参考|标准)答案(?:汇总|速查|表|清单)?$/.test(text)) return true
  if (/^答案(?:汇总|速查|表|清单)$/.test(text)) return true
  return !hasCurrent && /^答案$/.test(text)
}

function joinFragment(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  const cjk = /[\u4e00-\u9fff]$/.test(a) && /^[\u4e00-\u9fff]/.test(b)
  return cjk ? a + b : `${a} ${b}`
}

export function detectSection(text: string): Section | null {
  const t = text.trim()
  if (!t || t.length > 60) return null
  if (/[?？]$/.test(t)) return null

  let body = t.replace(HEADER_PREFIX, '').trim()
  let arabic = false
  const num = body.match(/^(\d{1,3})\s*[.、．)）]\s*/)
  if (num) {
    arabic = true
    body = body.slice(num[0].length).trim()
  }

  body = body.replace(/^[【[]\s*/, '').replace(/\s*[】\]]$/, '')

  let extra = ''
  const paren = body.match(/^(.*?)[（(]([^）)]*)[）)]\s*[:：]?\s*$/)
  if (paren) {
    body = paren[1].trim()
    extra = paren[2].trim()
  }
  body = body.replace(/[:：]\s*$/, '').trim()

  const word = HEADER_WORDS.find((item) => item.re.test(body))
  if (!word) return null

  if (arabic) {
    if (!extra && /[（(]\s*[）)]/.test(t)) return null
    if (extra && !/[分题共每]/.test(extra)) return null
  }
  if (extra.length > 30) return null

  return { type: word.type, multiple: !!word.multiple, title: t }
}

function matchQuestionStart(text: string): { number: number; rest: string } | null {
  let match = text.match(/^(?:第\s*)?(\d{1,3})\s*[.、．)）](?!\d)\s*(.*)$/)
  if (!match) match = text.match(/^[（(]\s*(\d{1,3})\s*[）)]\s*(.*)$/)
  if (!match) match = text.match(/^【\s*(\d{1,3})\s*】\s*(.*)$/)
  if (!match) return null

  const number = Number(match[1])
  const rest = (match[2] ?? '').trim()
  if (!rest) return null
  if (number < 1 || number > 500) return null
  if (/^[A-Ha-h]\s*[.、．)）]/.test(rest)) return null
  return { number, rest }
}

function parseOptionLine(text: string): QuestionOption[] | null {
  const first = text.match(OPTION_RE)
  if (!first) return null
  const label = first[1].toUpperCase()
  const rest = first[2] ?? ''
  let parts = rest.split(/\s+(?=[A-H][.、．)）:：]\s*)/)
  if (parts.length === 1) {
    const fallback = rest.split(/(?=[B-H][.、．)）:：]\s*)/)
    if (fallback.length > 1) parts = fallback
  }
  const options: QuestionOption[] = [{ label, content: (parts[0] ?? '').trim() }]
  for (const part of parts.slice(1)) {
    const match = part.match(/^([A-H])\s*[.、．)）:：]\s*(.*)$/)
    if (match) options.push({ label: match[1].toUpperCase(), content: match[2].trim() })
  }
  return options
}

function newDraft(number: number, line: SourceLine, section: Section | null): Draft {
  return {
    number,
    type: section?.type,
    explicit: !!section,
    multiple: section?.multiple ?? false,
    content: [],
    options: [],
    answer: [],
    explanation: [],
    zone: 'stem',
    startLine: line.line,
    raw: [line.text],
  }
}

function applyInline(draft: Draft, text: string): void {
  const answerMatch = text.match(
    /^(.*?)((?:【\s*(?:参考|正确|标准)?答案\s*】|(?:参考|正确|标准)?答案\s*[:：]).*)$/,
  )
  if (answerMatch && answerMatch[1].trim()) {
    splitStemOptions(draft, answerMatch[1].trim())
    const answerText = answerMatch[2].trim()
    applyLine(draft, { text: answerText, raw: answerText, line: draft.startLine, blank: false })
    return
  }
  splitStemOptions(draft, text)
}

function splitStemOptions(draft: Draft, text: string): void {
  const inline = text.match(/^(.*?[（(]\s*[）)])\s*([A-H]\s*[.、．)）:：]\s*[\s\S]*)$/)
  if (inline) {
    const options = parseOptionLine(inline[2].trim())
    if (options) {
      const stem = inline[1].trim()
      if (stem) draft.content.push(stem)
      draft.zone = 'options'
      draft.options.push(...options)
      return
    }
  }
  const index = text.search(/\s+(?=[A-H]\s*[.、．)）:：]\s*)/)
  if (index <= 0) {
    if (text) draft.content.push(text)
    return
  }
  const stem = text.slice(0, index).trim()
  const rest = text.slice(index).trim()
  if (stem) draft.content.push(stem)
  const options = parseOptionLine(rest)
  if (options) {
    draft.zone = 'options'
    draft.options.push(...options)
  } else if (rest) {
    draft.content.push(rest)
  }
}

function applyLine(draft: Draft, line: SourceLine): void {
  const text = line.text
  draft.raw.push(text)

  const answerValue = matchPatterns(text, ANSWER_PATTERNS)
  if (answerValue !== null) {
    draft.zone = 'answer'
    if (answerValue) {
      const inline = answerValue.split(
        /\s*(?:【\s*(?:答案)?解析\s*】|(?:答案)?解析\s*[:：])\s*/,
      )
      if (inline.length > 1) {
        if (inline[0].trim()) draft.answer.push(inline[0].trim())
        draft.zone = 'explanation'
        const rest = inline.slice(1).join(' ').trim()
        if (rest) draft.explanation.push(rest)
      } else {
        draft.answer.push(answerValue)
      }
    }
    return
  }

  const explainValue = matchPatterns(text, EXPLAIN_PATTERNS)
  if (explainValue !== null) {
    draft.zone = 'explanation'
    if (explainValue) draft.explanation.push(explainValue)
    return
  }

  if (draft.zone === 'stem' || draft.zone === 'options') {
    const options = parseOptionLine(text)
    if (options) {
      draft.zone = 'options'
      draft.options.push(...options)
      return
    }
  }

  if (draft.zone === 'stem') {
    draft.content.push(text)
  } else if (draft.zone === 'options') {
    const last = draft.options[draft.options.length - 1]
    if (last) last.content = joinFragment(last.content, text)
    else draft.content.push(text)
  } else if (draft.zone === 'answer') {
    draft.answer.push(text)
  } else {
    draft.explanation.push(text)
  }
}

function normalizeOptions(options: QuestionOption[]): QuestionOption[] {
  const seen = new Set<string>()
  const result: QuestionOption[] = []
  for (const option of options) {
    const label = option.label.trim().toUpperCase()
    if (!label || seen.has(label)) continue
    seen.add(label)
    result.push({ label, content: option.content.trim() })
  }
  return result.sort((a, b) => a.label.localeCompare(b.label))
}

function extractJudgeFromContent(content: string): '对' | '错' | null {
  const match = content.match(/[（(]\s*([√×✓✗对错TF])\s*[）)]/)
  if (!match) return null
  return normalizeJudge(match[1])
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[\s，,。.、；;：:（）()【】[\]？?！!]/g, '')
}

function buildQuestion(draft: Draft): ParsedQuestion | null {
  const content = tidyStem(cleanParagraph(draft.content))
  const options = normalizeOptions(draft.options)
  let answer = cleanParagraph(draft.answer)
  const explanation = cleanParagraph(draft.explanation)
  const issues: ParseIssue[] = []

  if (!content && options.length === 0) return null

  let type = draft.type
  let multiple = draft.multiple
  let inferredScore = 1

  if (!type) {
    const inferred = inferQuestionType({ content, options, answer })
    type = inferred.type
    multiple = inferred.multiple
    inferredScore = inferred.score
  }

  const judgeOptions =
    options.length === 2 &&
    options.every((option) => /^(对|错|正确|错误|是|否|√|×|✓|✗)$/i.test(option.content))

  if (type === 'choice') {
    const letters = splitAnswerLetters(answer)
    if (letters.length) {
      answer = letters.join('')
      const labels = new Set(options.map((option) => option.label))
      const missing = letters.filter((letter) => !labels.has(letter))
      if (options.length === 0) {
        issues.push({ field: 'options', severity: 'error', message: '识别为选择题，但没有解析到选项' })
      } else if (missing.length) {
        issues.push({
          field: 'answer',
          severity: 'warning',
          message: `答案 ${missing.join('')} 不在选项中`,
        })
      }
      if (letters.length > 1) {
        if (!multiple) {
          multiple = true
          if (draft.explicit) {
            issues.push({
              field: 'type',
              severity: 'warning',
              message: '答案包含多个字母，已按多选处理',
            })
          }
        }
      } else if (multiple && draft.explicit) {
        issues.push({ field: 'type', severity: 'info', message: '标记为多选，但答案只有 1 个字母' })
      }
    } else if (answer) {
      issues.push({ field: 'answer', severity: 'warning', message: '选择题答案不是 A–H 选项字母' })
    }
  } else if (type === 'judge') {
    const normalized = normalizeJudge(answer) ?? extractJudgeFromContent(content)
    if (normalized) {
      answer = normalized
      if (judgeOptions) options.splice(0, options.length)
    } else if (answer) {
      issues.push({ field: 'answer', severity: 'error', message: '判断题答案无法识别为对/错' })
    }
  } else if (type === 'fill') {
    const blanks = splitBlanks(answer, content)
    if (blanks.length) {
      answer = blanks.join('|')
      const markers = countBlanks(content)
      if (markers > 0 && markers !== blanks.length) {
        issues.push({
          field: 'answer',
          severity: 'warning',
          message: `题干有 ${markers} 个空位，答案给出 ${blanks.length} 个`,
        })
      }
    }
  }

  if (!answer) {
    issues.push({ field: 'answer', severity: 'error', message: '缺少答案，已标记为待补充' })
  }
  if (type === 'choice' && options.length < 2 && options.length > 0) {
    issues.push({ field: 'options', severity: 'error', message: `只有 ${options.length} 个选项` })
  }
  if (type === 'choice' && options.some((option) => !option.content)) {
    issues.push({ field: 'options', severity: 'warning', message: '存在空选项' })
  }
  if (content.length <= 2) {
    issues.push({ field: 'content', severity: 'warning', message: '题干过短' })
  }

  let confidence = 1
  for (const issue of issues) {
    if (issue.severity === 'error') confidence -= 0.4
    else if (issue.severity === 'warning') confidence -= 0.15
    else confidence -= 0.05
  }
  if (!draft.explicit && inferredScore < 0.5) confidence -= 0.15
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))))

  const blankCount =
    type === 'fill'
      ? Math.max(splitBlanks(answer, content).length, countBlanks(content), 1)
      : 0

  return {
    type,
    multiple: type === 'choice' ? multiple : false,
    content,
    options,
    answer,
    explanation,
    blankCount,
    confidence,
    issues,
    raw: draft.raw.join('\n').trim(),
    line: draft.startLine,
  }
}

function parseAnswerKeyLine(text: string, key: Map<number, string>): boolean {
  const pattern = /(\d{1,3})\s*[.、．:：)）]?\s*([A-H]{1,8}|正确|错误|对|错|√|×|✓|✗)/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = pattern.exec(text))) {
    const number = Number(match[1])
    if (number >= 1 && number <= 500) {
      key.set(number, match[2])
      count += 1
    }
  }
  return count > 0
}

function isTitleCandidate(text: string): boolean {
  if (text.length > 40) return false
  if (/^(?:[一二三四五六七八九十]+\s*[、.．]|\d+\s*[.、．)）])/.test(text)) return false
  if (/[。；;]$/.test(text)) return false
  if (/[（(]\s*[）)]\s*$/.test(text) || /_{2,}/.test(text)) return false
  return /复习|试题|试卷|练习|题库|期末|考试|单元|章节|测验|作业|习题|真题|模拟/.test(text) ||
    (text.length <= 20 && !/[，,：:]/.test(text))
}

function splitBlocks(lines: SourceLine[]): SourceLine[][] {
  const blocks: SourceLine[][] = []
  let current: SourceLine[] = []
  for (const line of lines) {
    if (line.blank) {
      if (current.length) {
        blocks.push(current)
        current = []
      }
    } else {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current)
  return blocks
}

function emptyStats(): ParseStats {
  return {
    total: 0,
    byType: { choice: 0, fill: 0, judge: 0, short: 0, term: 0 },
    multipleCount: 0,
    warnings: 0,
    lowConfidence: 0,
    unparsed: 0,
  }
}

export function parseText(raw: string, options: { title?: string } = {}): ParseResult {
  const startedAt = Date.now()
  const lines = normalizeText(raw)
  const drafts: Draft[] = []
  const unparsed: string[] = []
  const warnings: string[] = []
  const answerKey = new Map<number, string>()

  let section: Section | null = null
  let current: Draft | null = null
  let title = options.title
  let titleLocked = !!options.title
  let inAnswerKey = false

  const flush = () => {
    if (!current) return
    drafts.push(current)
    current = null
  }

  for (const line of lines) {
    if (line.blank) {
      if (current && current.zone !== 'options') {
        current.raw.push('')
        if (current.zone === 'stem') current.content.push('')
        else if (current.zone === 'answer') current.answer.push('')
        else if (current.zone === 'explanation') current.explanation.push('')
      }
      continue
    }

    if (!inAnswerKey && isAnswerKeyHeader(line.text, !!current)) {
      inAnswerKey = true
      flush()
      continue
    }

    if (inAnswerKey) {
      if (parseAnswerKeyLine(line.text, answerKey)) continue
      const nextSection = detectSection(line.text)
      if (nextSection) {
        inAnswerKey = false
        section = nextSection
        continue
      }
      if (/^(?:参考)?答案/.test(line.text)) continue
      unparsed.push(line.text)
      continue
    }

    const nextSection = detectSection(line.text)
    if (nextSection) {
      flush()
      section = nextSection
      continue
    }

    const start = matchQuestionStart(line.text)
    if (start) {
      flush()
      current = newDraft(start.number, line, section)
      if (start.rest) applyInline(current, start.rest)
      continue
    }

    if (!current) {
      if (!titleLocked && isTitleCandidate(line.text)) {
        title = line.text
        titleLocked = true
      } else {
        unparsed.push(line.text)
      }
      continue
    }

    applyLine(current, line)
  }
  flush()

  if (drafts.length === 0) {
    const blocks = splitBlocks(lines)
    for (const block of blocks) {
      const first = block[0]
      if (!first) continue
      const header = detectSection(first.text)
      if (header) continue
      const draft = newDraft(0, first, null)
      draft.content = []
      applyInline(draft, first.text)
      for (const line of block.slice(1)) applyLine(draft, line)
      drafts.push(draft)
    }
    if (drafts.length) warnings.push('未检测到题号，已按空行切分题目，建议核对')
  }

  const questions: ParsedQuestion[] = []
  for (const draft of drafts) {
    if (draft.answer.length === 0 && draft.number > 0 && answerKey.has(draft.number)) {
      draft.answer.push(answerKey.get(draft.number) as string)
    }
    const question = buildQuestion(draft)
    if (question) questions.push(question)
    else if (draft.raw.join('').trim()) unparsed.push(draft.raw.join('\n').trim())
  }

  const seen = new Map<string, number>()
  questions.forEach((question, index) => {
    const key = normalizeKey(question.content)
    if (key.length >= 4 && seen.has(key)) {
      question.duplicateOf = seen.get(key)
      question.issues.push({ field: 'content', severity: 'warning', message: '与前面的题目重复' })
      question.confidence = Math.max(0, Number((question.confidence - 0.15).toFixed(2)))
    } else if (key.length >= 4) {
      seen.set(key, index)
    }
  })

  const stats = emptyStats()
  stats.total = questions.length
  stats.unparsed = unparsed.length
  for (const question of questions) {
    stats.byType[question.type] += 1
    if (question.type === 'choice' && question.multiple) stats.multipleCount += 1
    stats.warnings += question.issues.filter((issue) => issue.severity !== 'info').length
    if (question.confidence < 0.75) stats.lowConfidence += 1
  }

  return {
    questions,
    unparsed,
    title,
    warnings,
    stats,
    rawLength: raw.length,
    elapsedMs: Date.now() - startedAt,
  }
}
