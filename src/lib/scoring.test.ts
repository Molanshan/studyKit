import { describe, expect, it } from 'vitest'
import { gradeQuestion } from './scoring'
import type { Question } from '../types'

const settings = { caseSensitive: false, partialFill: true }

function question(patch: Partial<Question>): Question {
  return {
    id: 'q_test',
    type: 'choice',
    multiple: false,
    content: '题干',
    options: [],
    answer: 'A',
    explanation: '',
    tags: [],
    setIds: [],
    favorite: false,
    order: 0,
    blankCount: 0,
    status: 'ok',
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  }
}

describe('gradeQuestion', () => {
  it('选择题按字母集合判分，忽略顺序', () => {
    const q = question({ type: 'choice', multiple: true, answer: 'AC' })
    expect(gradeQuestion(q, 'CA', null, settings).score).toBe(1)
    expect(gradeQuestion(q, 'A', null, settings).score).toBe(0)
  })

  it('判断题兼容多种写法', () => {
    const q = question({ type: 'judge', answer: '对' })
    expect(gradeQuestion(q, '√', null, settings).score).toBe(1)
    expect(gradeQuestion(q, '错', null, settings).score).toBe(0)
  })

  it('填空题逐空给分', () => {
    const q = question({ type: 'fill', answer: '北京|上海', blankCount: 2 })
    const result = gradeQuestion(q, '北京|', null, settings)
    expect(result.score).toBe(0.5)
    expect(result.correct).toBe(false)
    expect(result.wrongBlanks).toEqual([1])
  })

  it('关闭逐空给分后部分正确也不得分', () => {
    const q = question({ type: 'fill', answer: '北京|上海', blankCount: 2 })
    const result = gradeQuestion(q, '北京|', null, { ...settings, partialFill: false })
    expect(result.score).toBe(0)
    expect(result.correct).toBe(false)
  })

  it('填空题忽略大小写和标点', () => {
    const q = question({ type: 'fill', answer: 'Apple', blankCount: 1 })
    expect(gradeQuestion(q, ' apple。', null, settings).score).toBe(1)
    expect(
      gradeQuestion(q, 'apple', null, { ...settings, caseSensitive: true }).score,
    ).toBe(0)
  })

  it('主观题按自评判分', () => {
    const q = question({ type: 'short', answer: '参考答案' })
    expect(gradeQuestion(q, '我的回答', 'correct', settings).score).toBe(1)
    expect(gradeQuestion(q, '我的回答', 'wrong', settings).score).toBe(0)
    expect(gradeQuestion(q, '我的回答', null, settings).score).toBe(0)
  })

  it('没有答案的题不会误判为正确', () => {
    const q = question({ type: 'choice', answer: '' })
    expect(gradeQuestion(q, 'A', null, settings).score).toBe(0)
    expect(gradeQuestion(q, '', null, settings).score).toBe(0)
  })
})
