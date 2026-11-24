import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS, STORAGE_KEY } from './constants'

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'success' | 'error'
}

interface AppState {
  settings: Settings
  toast: Toast | null
  editMode: boolean
  updateSettings: (patch: Partial<Settings>) => void
  setEditMode: (editMode: boolean) => void
  showToast: (message: string, tone?: Toast['tone']) => void
  hideToast: () => void
}

let toastSeq = 0

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      toast: null,
      editMode: false,
      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      setEditMode: (editMode) => set({ editMode }),
      showToast: (message, tone = 'default') => {
        toastSeq += 1
        set({ toast: { id: toastSeq, message, tone } })
      },
      hideToast: () => set({ toast: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
)
