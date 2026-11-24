export interface ExtractResult {
  text: string
  kind: 'docx' | 'pdf' | 'text'
  warnings: string[]
}

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.text']

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.docx') || name.endsWith('.pdf') || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buffer)
    } catch {
      return new TextDecoder('utf-8').decode(buffer)
    }
  }
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text.trim()) blocks.push(text)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (tag === 'br') {
      blocks.push('\n')
      return
    }
    if (tag === 'td' || tag === 'th') {
      blocks.push(`${element.textContent ?? ''} `)
      return
    }
    if (['p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table'].includes(tag)) {
      blocks.push('\n')
      element.childNodes.forEach(walk)
      blocks.push('\n')
      return
    }
    element.childNodes.forEach(walk)
  }
  doc.body.childNodes.forEach(walk)
  return blocks
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractDocx(file: File): Promise<ExtractResult> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const warnings = result.messages
    .filter((message) => message.type === 'warning' || message.type === 'error')
    .map((message) => message.message)
    .slice(0, 5)
  return { text: htmlToText(result.value), kind: 'docx', warnings }
}

interface PdfTextItem {
  str?: string
  transform?: number[]
  width?: number
}

async function extractPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  let emptyPages = 0

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const rows = new Map<number, Array<{ x: number; text: string }>>()

    for (const raw of content.items as PdfTextItem[]) {
      if (!raw.str || !raw.transform) continue
      const y = Math.round(raw.transform[5])
      const x = raw.transform[4]
      const bucket = rows.get(y) ?? []
      bucket.push({ x, text: raw.str })
      rows.set(y, bucket)
    }

    const lines = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .reduce((acc, item) => {
            if (!acc) return item.text
            return `${acc} ${item.text}`
          }, ''),
      )
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    if (lines.join('').length < 20) emptyPages += 1
    pages.push(lines.join('\n'))
  }

  const text = pages.join('\n\n')
  const warnings: string[] = []
  if (emptyPages > 0) {
    warnings.push(`有 ${emptyPages} 页没有提取到文字，可能是扫描版 PDF，建议转为 docx 或 txt`)
  }
  if (text.trim().length < 30) {
    throw new Error('这个 PDF 没有可提取的文字层，可能是扫描件。请用 Word 转成 docx，或复制文字后使用「粘贴导入」。')
  }
  return { text, kind: 'pdf', warnings }
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.doc')) {
    throw new Error('旧版 .doc 暂不支持，请用 Word 另存为 .docx 后再导入')
  }
  if (name.endsWith('.docx')) return extractDocx(file)
  if (name.endsWith('.pdf')) return extractPdf(file)
  if (TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { text: await readTextFile(file), kind: 'text', warnings: [] }
  }
  throw new Error('暂不支持这个文件格式，请使用 docx、txt、md 或文本型 PDF')
}
