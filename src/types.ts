export type QuestionType = 'choice' | 'fill' | 'judge' | 'short' | 'term'

export type ThemeColor = 'sky' | 'mint' | 'peach' | 'lilac' | 'lemon' | 'rose'

export type ExamMode = 'practice' | 'mock'

export type SelfGrade = 'correct' | 'wrong' | null

export interface User {
  id: string
  nickname: string
  avatar?: string
  createdAt: number
}

export interface DocumentRecord {
  id: string
  title: string
  fileName?: string
  sourceType: 'file' | 'url' | 'manual' | 'demo' | 'paste'
  source?: string
  questionCount: number
  parseWarnings: number
  createdAt: number
}

export interface QuestionOption {
  label: string
  content: string
}

export interface Question {
  id: string
  type: QuestionType
  /** 选择题是否为多选 */
  multiple: boolean
  content: string
  options: QuestionOption[]
  answer: string
  explanation: string
  tags: string[]
  setIds: string[]
  favorite: boolean
  order: number
  /** 填空题空数，用于逐空给分 */
  blankCount: number
  /** draft = 答案待补充 */
  status: 'ok' | 'draft'
  sourceDocumentId?: string
  source?: string
  createdAt: number
  updatedAt: number
}

export interface QuestionSet {
  id: string
  name: string
  icon: string
  color: ThemeColor
  description: string
  sortOrder: number
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color: ThemeColor
  createdAt: number
}

export interface ExamRecord {
  id: string
  mode: ExamMode
  title: string
  sourceLabel: string
  questionIds: string[]
  answers: Record<string, string>
  correctIds: string[]
  wrongIds: string[]
  subjectiveIds: string[]
  selfGrades: Record<string, Exclude<SelfGrade, null>>
  /** 每题得分率 0–1，支持填空逐空给分 */
  scores: Record<string, number>
  durationSec: number
  elapsedSec: number
  total: number
  objectiveCorrect: number
  subjectiveCorrect: number
  /** 百分制得分率 */
  score: number
  finishedAt: number
}

export interface WrongQuestion {
  id: string
  questionId: string
  wrongCount: number
  correctStreak: number
  lastWrongAt: number
  lastAnswer?: string
  lastWrongBlanks?: number[]
  masteredAt?: number | null
}

export interface PracticeSession {
  id: string
  title: string
  sourceLabel: string
  mode: ExamMode
  questionIds: string[]
  answers: Record<string, string>
  selfGrades: Record<string, Exclude<SelfGrade, null>>
  currentIndex: number
  startedAt: number
  updatedAt: number
  durationSec: number
}

export interface ParsedQuestion {
  type: QuestionType
  multiple: boolean
  content: string
  options: QuestionOption[]
  answer: string
  explanation: string
  blankCount: number
  confidence: number
  issues: ParseIssue[]
  raw: string
  line: number
  /** 与前面第 N 题重复（0-based 索引） */
  duplicateOf?: number
}

export interface ParseIssue {
  field: 'content' | 'options' | 'answer' | 'explanation' | 'type' | 'general'
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface ParseStats {
  total: number
  byType: Record<QuestionType, number>
  multipleCount: number
  warnings: number
  lowConfidence: number
  unparsed: number
}

export interface ParseResult {
  questions: ParsedQuestion[]
  unparsed: string[]
  title?: string
  warnings: string[]
  stats: ParseStats
  rawLength: number
  elapsedMs: number
}

export interface ImportDraft extends ParsedQuestion {
  tempId: string
  included: boolean
}

export interface ExamDraft {
  mode: ExamMode
  title: string
  sourceLabel: string
  questionIds: string[]
  durationSec: number
  startedAt: number
  currentIndex: number
  answers: Record<string, string>
}

export interface UserStats {
  totalQuestions: number
  favoriteCount: number
  wrongCount: number
  masteredCount: number
  examCount: number
  averageScore: number
}

export interface Settings {
  accent: ThemeColor
  dark: boolean
  autoNext: boolean
  caseSensitive: boolean
  partialFill: boolean
  defaultCount: number
  fontSize: number
}

export interface BackupData {
  version: number
  exportedAt: number
  documents: DocumentRecord[]
  questions: Question[]
  questionSets: QuestionSet[]
  tags: Tag[]
  examRecords: ExamRecord[]
  wrongQuestions: WrongQuestion[]
}
