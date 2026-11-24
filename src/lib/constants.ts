import type { QuestionType, ThemeColor } from '../types'

export interface ColorPalette {
  name: string
  bg: string
  soft: string
  text: string
  border: string
  solid: string
}

export const COLORS: Record<ThemeColor, ColorPalette> = {
  sky: {
    name: '天蓝',
    bg: '#E4F2F9',
    soft: '#D7EDF7',
    text: '#2F6C86',
    border: '#B7DAE8',
    solid: '#8FCBE2',
  },
  mint: {
    name: '薄荷',
    bg: '#E1F3E9',
    soft: '#D6EEE2',
    text: '#36725B',
    border: '#B9DEC9',
    solid: '#9BD5B9',
  },
  peach: {
    name: '蜜桃',
    bg: '#FCE9DC',
    soft: '#F9E0CD',
    text: '#8B5638',
    border: '#EFCBAF',
    solid: '#F2B78F',
  },
  lilac: {
    name: '丁香',
    bg: '#ECE6F7',
    soft: '#E5DCF4',
    text: '#66528C',
    border: '#D5C7EA',
    solid: '#C0A9E2',
  },
  lemon: {
    name: '柠檬',
    bg: '#F8F2CE',
    soft: '#F5EDBE',
    text: '#786A2C',
    border: '#E8DD9F',
    solid: '#E5D276',
  },
  rose: {
    name: '玫红',
    bg: '#F9E3E9',
    soft: '#F6DBE3',
    text: '#8C4B60',
    border: '#EEC5D0',
    solid: '#E9AAC0',
  },
}

export const THEME_COLORS = Object.keys(COLORS) as ThemeColor[]

export interface TypeMeta {
  label: string
  shortLabel: string
  color: ThemeColor
  english: string
}

export const TYPE_META: Record<QuestionType, TypeMeta> = {
  choice: { label: '选择题', shortLabel: '选择', color: 'sky', english: 'CHOICE' },
  fill: { label: '填空题', shortLabel: '填空', color: 'mint', english: 'FILL' },
  judge: { label: '判断题', shortLabel: '判断', color: 'peach', english: 'JUDGE' },
  short: { label: '简答题', shortLabel: '简答', color: 'lilac', english: 'SHORT' },
  term: { label: '名词解释', shortLabel: '名词', color: 'lemon', english: 'TERM' },
}

export const QUESTION_TYPES = Object.keys(TYPE_META) as QuestionType[]

export const EXAM_DURATIONS = [10, 15, 30, 60]

export const SET_ICONS = [
  'calculator',
  'languages',
  'monitor',
  'atom',
  'book-open',
  'flask-conical',
  'globe-2',
  'landmark',
  'palette',
  'music',
  'leaf',
  'star',
] as const

export const SET_ICON_LABELS: Record<string, string> = {
  calculator: '计算',
  languages: '语言',
  monitor: '电脑',
  atom: '科学',
  'book-open': '阅读',
  'flask-conical': '实验',
  'globe-2': '地理',
  landmark: '人文',
  palette: '艺术',
  music: '音乐',
  leaf: '自然',
  star: '重点',
}

export const PLATFORM_HINTS = [
  { name: '飞书', host: 'feishu.cn', color: '#3370FF' },
  { name: '语雀', host: 'yuque.com', color: '#00B96B' },
  { name: 'Notion', host: 'notion.site', color: '#222222' },
  { name: '腾讯文档', host: 'docs.qq.com', color: '#2B7CF6' },
  { name: '金山文档', host: 'kdocs.cn', color: '#E85B36' },
]

export const APP_NAME = '题Kit'
export const APP_TAGLINE = '把复习题，变成你的题库'
export const APP_DESC = '导入 docx / txt / pdf 复习题，自动识别题型，离线反复刷题、自动记错题。'
export const APP_VERSION = '1.0.0'
export const APP_LOGO = './logo.webp'
export const STORAGE_KEY = 'tikit-settings'

export interface QuestionView {
  key: string
  label: string
  shortLabel: string
  type: QuestionType
  multiple?: boolean
  color: ThemeColor
}

/** 题型视图：系统自动聚合，不入库 */
export const QUESTION_VIEWS: QuestionView[] = [
  { key: 'single', label: '单选题', shortLabel: '单选', type: 'choice', multiple: false, color: 'sky' },
  { key: 'multiple', label: '多选题', shortLabel: '多选', type: 'choice', multiple: true, color: 'lilac' },
  { key: 'judge', label: '判断题', shortLabel: '判断', type: 'judge', color: 'peach' },
  { key: 'fill', label: '填空题', shortLabel: '填空', type: 'fill', color: 'mint' },
  { key: 'short', label: '简答题', shortLabel: '简答', type: 'short', color: 'lemon' },
  { key: 'term', label: '名词解释', shortLabel: '名词', type: 'term', color: 'rose' },
]

export const DEFAULT_SETTINGS = {
  accent: 'sky' as ThemeColor,
  dark: false,
  autoNext: true,
  caseSensitive: false,
  partialFill: true,
  defaultCount: 20,
  fontSize: 16,
}

