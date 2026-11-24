import type { Question, SelfGrade } from '../types'
import { normalizeJudge } from './parser/classify'

export interface GradeResult {
  score: number
  correct: boolean
  wrongBlanks: number[]
  detail: string
}

export function normalizeFill(value: string, caseSensitive = false): string {
  let text = value
    .replace(/\r?\n/g, ' ')
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[，,。.；;：:、""''（）()【】[\]]/g, '')
  if (!caseSensitive) text = text.toLowerCase()
  return text
}

export function answerLetters(value: string): string[] {
  const cleaned = value.toUpperCase().replace(/[^A-H]/g, '')
  return Array.from(new Set(cleaned.split(''))).sort()
}

export function blankAnswers(question: Question): string[] {
  if (!question.answer) return []
  return question.answer.split(/[|｜]/).map((part) => part.trim())
}

export function gradeQuestion(
  question: Question,
  answer: string,
  selfGrade: SelfGrade,
  options: { caseSensitive: boolean; partialFill: boolean },
): GradeResult {
  const raw = answer ?? ''

  if (question.type === 'choice') {
    const expected = answerLetters(question.answer).join('')
    const actual = answerLetters(raw).join('')
    const correct = expected.length > 0 && expected === actual
    return {
      score: correct ? 1 : 0,
      correct,
      wrongBlanks: [],
      detail: correct ? '回答正确' : expected ? `正确答案是 ${expected}` : '这道题还没有答案',
    }
  }

  if (question.type === 'judge') {
    const expected = normalizeJudge(question.answer)
    const actual = normalizeJudge(raw)
    const correct = !!expected && expected === actual
    return {
      score: correct ? 1 : 0,
      correct,
      wrongBlanks: [],
      detail: correct ? '回答正确' : expected ? `正确答案是「${expected}」` : '这道题还没有答案',
    }
  }

  if (question.type === 'fill') {
    const expected = blankAnswers(question)
    const actual = raw.split(/[|｜]/).map((part) => part.trim())
    const total = Math.max(expected.length, question.blankCount, 1)
    if (expected.length === 0) {
      return { score: 0, correct: false, wrongBlanks: [], detail: '这道题还没有答案' }
    }
    const wrongBlanks: number[] = []
    let hits = 0
    for (let index = 0; index < total; index += 1) {
      const target = normalizeFill(expected[index] ?? '', options.caseSensitive)
      const value = normalizeFill(actual[index] ?? '', options.caseSensitive)
      if (target && value === target) hits += 1
      else wrongBlanks.push(index)
    }
    const score = options.partialFill ? hits / total : hits === total ? 1 : 0
    const correct = hits === total
    return {
      score,
      correct,
      wrongBlanks,
      detail:
        hits === total
          ? '全部空位正确'
          : options.partialFill
            ? `答对 ${hits}/${total} 空`
            : `答对 ${hits}/${total} 空，需要全部答对才得分`,
    }
  }

  const correct = selfGrade === 'correct'
  return {
    score: correct ? 1 : 0,
    correct,
    wrongBlanks: [],
    detail: correct ? '已标记为掌握' : '已标记为未掌握',
  }
}

export function scoreLabel(score: number): string {
  if (score >= 1) return '完全正确'
  if (score > 0) return '部分正确'
  return '回答错误'
}
