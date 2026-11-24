import Dexie, { type Table } from 'dexie'
import type {
  BackupData,
  DocumentRecord,
  ExamRecord,
  ParsedQuestion,
  PracticeSession,
  Question,
  QuestionSet,
  Tag,
  WrongQuestion,
} from '../types'
import { createId } from './utils'
import { COLORS, QUESTION_VIEWS } from './constants'

export class AppDB extends Dexie {
  documents!: Table<DocumentRecord, string>
  questions!: Table<Question, string>
  questionSets!: Table<QuestionSet, string>
  tags!: Table<Tag, string>
  examRecords!: Table<ExamRecord, string>
  wrongQuestions!: Table<WrongQuestion, string>
  sessions!: Table<PracticeSession, string>

  constructor() {
    super('tikit')
    this.version(1).stores({
      documents: 'id, createdAt',
      questions: 'id, type, createdAt, favorite, status, sourceDocumentId, *setIds, *tags',
      questionSets: 'id, name, sortOrder, createdAt',
      tags: 'id, name',
      examRecords: 'id, finishedAt',
      wrongQuestions: 'id, &questionId, lastWrongAt, masteredAt',
      sessions: 'id, updatedAt',
    })
  }
}

export const db = new AppDB()

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    // 忽略：浏览器不支持时退化为普通存储
  }
}

export interface ImportOptions {
  title: string
  fileName?: string
  sourceType: DocumentRecord['sourceType']
  source?: string
  set?: { id?: string; name?: string; color?: QuestionSet['color'] }
}

export interface ImportOutcome {
  documentId: string
  questionIds: string[]
  setId?: string
}

export async function importQuestions(
  drafts: ParsedQuestion[],
  options: ImportOptions,
): Promise<ImportOutcome> {
  const now = Date.now()
  const documentId = createId('doc_')
  const questionIds: string[] = []
  let setId = options.set?.id

  const questions: Question[] = drafts.map((draft, index) => {
    const id = createId('q_')
    questionIds.push(id)
    return {
      id,
      type: draft.type,
      multiple: draft.multiple,
      content: draft.content,
      options: draft.options,
      answer: draft.answer,
      explanation: draft.explanation,
      tags: [],
      setIds: [],
      favorite: false,
      order: index,
      blankCount: draft.blankCount,
      status: draft.answer ? 'ok' : 'draft',
      sourceDocumentId: documentId,
      source: options.fileName ?? options.source,
      createdAt: now,
      updatedAt: now,
    }
  })

  await db.transaction('rw', db.documents, db.questions, db.questionSets, async () => {
    if (options.set?.name) {
      const existing = await db.questionSets.where('name').equals(options.set.name).first()
      if (existing) {
        setId = existing.id
      } else {
        setId = createId('set_')
        await db.questionSets.add({
          id: setId,
          name: options.set.name,
          icon: 'book-open',
          color: options.set.color ?? 'sky',
          description: '',
          sortOrder: now,
          createdAt: now,
        })
      }
    }

    if (setId) {
      for (const question of questions) question.setIds = [setId]
    }

    await db.documents.add({
      id: documentId,
      title: options.title,
      fileName: options.fileName,
      sourceType: options.sourceType,
      source: options.source,
      questionCount: questions.length,
      parseWarnings: drafts.reduce(
        (sum, draft) => sum + draft.issues.filter((issue) => issue.severity !== 'info').length,
        0,
      ),
      createdAt: now,
    })
    await db.questions.bulkAdd(questions)
  })

  return { documentId, questionIds, setId }
}

export async function createSet(name: string, color: QuestionSet['color'] = 'sky'): Promise<QuestionSet> {
  const now = Date.now()
  const set: QuestionSet = {
    id: createId('set_'),
    name,
    icon: 'book-open',
    color,
    description: '',
    sortOrder: now,
    createdAt: now,
  }
  await db.questionSets.add(set)
  return set
}

export async function updateSet(id: string, patch: Partial<QuestionSet>): Promise<void> {
  await db.questionSets.update(id, patch)
}

export async function deleteSet(id: string): Promise<void> {
  await db.transaction('rw', db.questionSets, db.questions, async () => {
    await db.questionSets.delete(id)
    const questions = await db.questions.where('setIds').equals(id).toArray()
    await db.questions.bulkPut(
      questions.map((question) => ({
        ...question,
        setIds: question.setIds.filter((setId) => setId !== id),
      })),
    )
  })
}

export async function addQuestionsToSet(questionIds: string[], setId: string): Promise<void> {
  const questions = await db.questions.bulkGet(questionIds)
  const updates = questions
    .filter((question): question is Question => !!question)
    .filter((question) => !question.setIds.includes(setId))
    .map((question) => ({ ...question, setIds: [...question.setIds, setId], updatedAt: Date.now() }))
  if (updates.length) await db.questions.bulkPut(updates)
}

export async function removeQuestionsFromSet(questionIds: string[], setId: string): Promise<void> {
  const questions = await db.questions.bulkGet(questionIds)
  const updates = questions
    .filter((question): question is Question => !!question)
    .map((question) => ({
      ...question,
      setIds: question.setIds.filter((id) => id !== setId),
      updatedAt: Date.now(),
    }))
  if (updates.length) await db.questions.bulkPut(updates)
}

export async function toggleFavorite(id: string): Promise<void> {
  const question = await db.questions.get(id)
  if (!question) return
  await db.questions.update(id, { favorite: !question.favorite, updatedAt: Date.now() })
}

export async function updateQuestion(id: string, patch: Partial<Question>): Promise<void> {
  await db.questions.update(id, {
    ...patch,
    status: patch.answer !== undefined ? (patch.answer ? 'ok' : 'draft') : undefined,
    updatedAt: Date.now(),
  })
}

export async function deleteQuestions(ids: string[]): Promise<void> {
  await db.transaction('rw', db.questions, db.wrongQuestions, async () => {
    await db.questions.bulkDelete(ids)
    await db.wrongQuestions.where('questionId').anyOf(ids).delete()
  })
}

export async function saveSession(session: PracticeSession): Promise<void> {
  await db.sessions.put({ ...session, updatedAt: Date.now() })
}

export async function latestSession(): Promise<PracticeSession | undefined> {
  return db.sessions.orderBy('updatedAt').last()
}

export async function clearSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

export interface FinishPayload {
  record: ExamRecord
  wrongBlanks: Record<string, number[]>
}

export async function finishExam(payload: FinishPayload): Promise<void> {
  const { record, wrongBlanks } = payload
  await db.transaction('rw', db.examRecords, db.wrongQuestions, db.sessions, async () => {
    await db.examRecords.put(record)

    for (const questionId of record.questionIds) {
      const score = record.scores[questionId] ?? 0
      const existing = await db.wrongQuestions.where('questionId').equals(questionId).first()

      if (score >= 1) {
        if (existing) {
          const streak = existing.correctStreak + 1
          await db.wrongQuestions.put({
            ...existing,
            correctStreak: streak,
            masteredAt: streak >= 2 ? Date.now() : existing.masteredAt,
          })
        }
      } else if (existing) {
        await db.wrongQuestions.put({
          ...existing,
          wrongCount: existing.wrongCount + 1,
          correctStreak: 0,
          lastWrongAt: Date.now(),
          lastAnswer: record.answers[questionId],
          lastWrongBlanks: wrongBlanks[questionId],
          masteredAt: null,
        })
      } else {
        await db.wrongQuestions.add({
          id: createId('w_'),
          questionId,
          wrongCount: 1,
          correctStreak: 0,
          lastWrongAt: Date.now(),
          lastAnswer: record.answers[questionId],
          lastWrongBlanks: wrongBlanks[questionId],
          masteredAt: null,
        })
      }
    }
  })
}

export async function removeWrong(questionId: string): Promise<void> {
  await db.wrongQuestions.where('questionId').equals(questionId).delete()
}

export async function clearWrong(): Promise<void> {
  await db.wrongQuestions.clear()
}

export async function markMastered(questionId: string, mastered: boolean): Promise<void> {
  const existing = await db.wrongQuestions.where('questionId').equals(questionId).first()
  if (!existing) return
  await db.wrongQuestions.put({
    ...existing,
    masteredAt: mastered ? Date.now() : null,
    correctStreak: mastered ? Math.max(existing.correctStreak, 2) : 0,
  })
}

export async function exportBackup(): Promise<BackupData> {
  const [documents, questions, questionSets, tags, examRecords, wrongQuestions] = await Promise.all([
    db.documents.toArray(),
    db.questions.toArray(),
    db.questionSets.toArray(),
    db.tags.toArray(),
    db.examRecords.toArray(),
    db.wrongQuestions.toArray(),
  ])
  return {
    version: 1,
    exportedAt: Date.now(),
    documents,
    questions,
    questionSets,
    tags,
    examRecords,
    wrongQuestions,
  }
}

export async function importBackup(data: BackupData, mode: 'merge' | 'replace'): Promise<void> {
  if (!data || data.version !== 1) {
    throw new Error('备份文件版本不兼容')
  }
  await db.transaction(
    'rw',
    [db.documents, db.questions, db.questionSets, db.tags, db.examRecords, db.wrongQuestions, db.sessions],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.documents.clear(),
          db.questions.clear(),
          db.questionSets.clear(),
          db.tags.clear(),
          db.examRecords.clear(),
          db.wrongQuestions.clear(),
          db.sessions.clear(),
        ])
      }
      await db.documents.bulkPut(data.documents ?? [])
      await db.questions.bulkPut(data.questions ?? [])
      await db.questionSets.bulkPut(data.questionSets ?? [])
      await db.tags.bulkPut(data.tags ?? [])
      await db.examRecords.bulkPut(data.examRecords ?? [])
      await db.wrongQuestions.bulkPut(data.wrongQuestions ?? [])
    },
  )
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.documents.clear(),
    db.questions.clear(),
    db.questionSets.clear(),
    db.tags.clear(),
    db.examRecords.clear(),
    db.wrongQuestions.clear(),
    db.sessions.clear(),
  ])
}

export function typeViewKey(question: Pick<Question, 'type' | 'multiple'>): string {
  if (question.type !== 'choice') return question.type
  return question.multiple ? 'multiple' : 'single'
}

export function typeViewMeta(question: Pick<Question, 'type' | 'multiple'>) {
  const key = typeViewKey(question)
  return QUESTION_VIEWS.find((view) => view.key === key) ?? QUESTION_VIEWS[0]
}

export function setColor(color: QuestionSet['color']) {
  return COLORS[color] ?? COLORS.sky
}
