export interface SourceLine {
  text: string
  raw: string
  line: number
  blank: boolean
}

const PAGE_NOISE = [
  /^[-—–_=~·\s]*\d{1,4}[-—–_=~·\s]*$/,
  /^第\s*\d{1,4}\s*页(\s*[/／,，]?\s*共\s*\d{1,4}\s*页)?$/,
  /^共\s*\d{1,4}\s*页\s*[/／]?\s*第\s*\d{1,4}\s*页$/,
  /^page\s*\d+(\s*(of|\/)\s*\d+)?$/i,
]

const BULLET = /^[•·▪◦●○◆■□※☆★]\s*/

/** 全角 ASCII → 半角，统一空白与零宽字符 */
export function normalizeText(raw: string): SourceLine[] {
  let text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')

  const result: SourceLine[] = []
  text.split('\n').forEach((rawLine, index) => {
    let line = rawLine.replace(/[ \t]+$/g, '').replace(/[ \t]{2,}/g, ' ')
    line = line.replace(BULLET, '')
    const trimmed = line.trim()
    if (trimmed && PAGE_NOISE.some((re) => re.test(trimmed))) return
    result.push({ text: trimmed, raw: rawLine, line: index + 1, blank: trimmed === '' })
  })
  return result
}

export function collapseBlankLines(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function cleanParagraph(lines: string[]): string {
  return collapseBlankLines(lines)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** 去掉题干末尾残留的括号空位之外的空白 */
export function tidyStem(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}
