import { COLORS } from './constants'
import type { ThemeColor } from '../types'

export function createId(prefix = ''): string {
  const value =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}${value}`
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} 秒`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDate(timestamp)
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,。.、；;：:“”"'‘’（）()【】[\]]/g, '')
    .replace(/^(答案|答)[:：]?/, '')
    .trim()
}

export function splitAnswerLetters(value: string): string[] {
  const cleaned = value.toUpperCase().replace(/[^A-F]/g, '')
  return Array.from(new Set(cleaned.split(''))).sort()
}

export function isObjective(type: string): boolean {
  return type === 'choice' || type === 'fill' || type === 'judge'
}

export function scoreColor(score: number): ThemeColor {
  if (score >= 85) return 'mint'
  if (score >= 70) return 'sky'
  if (score >= 55) return 'lemon'
  return 'rose'
}

export function getColor(color: ThemeColor) {
  return COLORS[color] ?? COLORS.sky
}

export function truncate(text: string, length = 80): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > length ? `${clean.slice(0, length)}…` : clean
}

export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
