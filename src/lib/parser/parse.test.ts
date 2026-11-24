import { describe, expect, it } from 'vitest'
import { parseText } from './parse'
import { SAMPLE_MESSY, SAMPLE_NO_NUMBER, SAMPLE_STANDARD } from './fixtures'

describe('标准模板', () => {
  const result = parseText(SAMPLE_STANDARD)

  it('识别全部题目', () => {
    expect(result.questions).toHaveLength(7)
    expect(result.stats.byType).toEqual({ choice: 3, fill: 1, judge: 1, short: 1, term: 1 })
    expect(result.unparsed).toHaveLength(0)
  })

  it('提取单选题字段', () => {
    const question = result.questions[0]
    expect(question.type).toBe('choice')
    expect(question.multiple).toBe(false)
    expect(question.options).toHaveLength(4)
    expect(question.options[1]).toEqual({ label: 'B', content: '德国古典哲学' })
    expect(question.answer).toBe('B')
    expect(question.explanation).toContain('德国古典哲学')
  })

  it('识别多选题', () => {
    const question = result.questions[2]
    expect(question.type).toBe('choice')
    expect(question.multiple).toBe(true)
    expect(question.answer).toBe('ABC')
  })

  it('识别判断题', () => {
    const question = result.questions[3]
    expect(question.type).toBe('judge')
    expect(question.answer).toBe('错')
  })

  it('填空题逐空拆分', () => {
    const question = result.questions[4]
    expect(question.type).toBe('fill')
    expect(question.answer).toBe('来源|唯一标准')
    expect(question.blankCount).toBe(2)
  })

  it('识别简答与名词解释', () => {
    expect(result.questions[5].type).toBe('short')
    expect(result.questions[5].answer).toContain('量变')
    expect(result.questions[6].type).toBe('term')
  })

  it('所有题目置信度较高', () => {
    expect(result.stats.lowConfidence).toBe(0)
  })
})

describe('杂排文档', () => {
  const result = parseText(SAMPLE_MESSY)

  it('识别题型分区与题目数量', () => {
    expect(result.questions).toHaveLength(6)
    expect(result.stats.byType).toEqual({ choice: 2, fill: 1, judge: 2, short: 1, term: 0 })
  })

  it('一行多个选项可以拆开', () => {
    expect(result.questions[0].options).toHaveLength(4)
    expect(result.questions[0].options[3].content).toBe('法国启蒙思想')
    expect(result.questions[0].answer).toBe('B')
  })

  it('括号里的判断答案可以识别', () => {
    expect(result.questions[2].answer).toBe('错')
    expect(result.questions[3].answer).toBe('对')
  })

  it('填空题用分号分隔也能逐空拆分', () => {
    expect(result.questions[4].answer).toBe('来源|唯一标准')
    expect(result.questions[4].blankCount).toBe(2)
  })

  it('文末答案表不进入题目正文', () => {
    expect(result.questions[0].raw).not.toContain('参考答案')
    expect(result.unparsed).toHaveLength(0)
  })

  it('识别标题', () => {
    expect(result.title).toBe('马原期末复习题')
  })
})

describe('无题号文档', () => {
  const result = parseText(SAMPLE_NO_NUMBER)

  it('按空行切分并推断题型', () => {
    expect(result.questions).toHaveLength(2)
    expect(result.questions[0].type).toBe('choice')
    expect(result.questions[0].answer).toBe('D')
    expect(result.questions[1].answer).toBe('B')
  })
})

describe('边界情况', () => {
  it('一行多个选项', () => {
    const result = parseText('1. 下列说法正确的是（ ） A. 甲 B. 乙 C. 丙 D. 丁\n答案：C')
    expect(result.questions[0].options).toHaveLength(4)
    expect(result.questions[0].answer).toBe('C')
  })

  it('答案紧贴题干', () => {
    const result = parseText('1. 地球是圆的。（ ）答案：对')
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].answer).toBe('对')
  })

  it('解析里的编号不会被当成新题', () => {
    const result = parseText(
      '1. 第一题\nA. 甲\nB. 乙\n答案：A\n解析：注意以下两点。1. 这是解析内容。2. 这也是解析内容。\n2. 第二题\nA. 甲\nB. 乙\n答案：B',
    )
    expect(result.questions).toHaveLength(2)
    expect(result.questions[0].explanation).toContain('这是解析内容')
  })

  it('小数不会被当成题号', () => {
    const result = parseText('1. 圆周率约等于\nA. 3.14\nB. 2.71\n答案：A')
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].options).toHaveLength(2)
  })

  it('重复题目会被标记', () => {
    const result = parseText('1. 同一道题\n答案：A\n2. 同一道题\n答案：A')
    expect(result.questions[1].duplicateOf).toBe(0)
  })

  it('缺少答案时标记为待补充', () => {
    const result = parseText('1. 一道没有答案的题\nA. 甲\nB. 乙')
    expect(result.questions[0].issues.some((issue) => issue.field === 'answer')).toBe(true)
    expect(result.questions[0].confidence).toBeLessThan(0.75)
  })

  it('全角字符归一化', () => {
    const result = parseText('１．下列正确的是（ ）\nＡ．甲\nＢ．乙\n答案：Ｂ')
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].answer).toBe('B')
  })

  it('括号后紧贴选项也能拆开', () => {
    const result = parseText('1. 下列说法正确的是（ ）A. 甲 B. 乙 C. 丙 D. 丁\n答案：D')
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].options).toHaveLength(4)
    expect(result.questions[0].options[3]).toEqual({ label: 'D', content: '丁' })
  })

  it('答案同一行的解析会被拆出', () => {
    const result = parseText('1. 地球是圆的\nA. 对\nB. 错\n答案：A 解析：常识题。')
    expect(result.questions[0].answer).toBe('A')
    expect(result.questions[0].explanation).toContain('常识题')
  })

  it('填空题答案用圈号分隔也能逐空拆分', () => {
    const result = parseText('1. ____ 和 ____ 是两大要素\n答案：①物质 ②意识')
    expect(result.questions[0].answer).toBe('物质|意识')
    expect(result.questions[0].blankCount).toBe(2)
  })

  it('填空题答案用编号分隔也能逐空拆分', () => {
    const result = parseText('1. ____ 与 ____ 相互依存\n答案：1. 生产力 2. 生产关系')
    expect(result.questions[0].answer).toBe('生产力|生产关系')
    expect(result.questions[0].blankCount).toBe(2)
  })
})
