import { create } from 'zustand'

export type ViewType = 'functions' | 'database' | 'storage' | 'site'

interface ViewState {
  currentView: ViewType
  setView: (view: ViewType) => void
  // 弹窗面板状态
  statisticsOpen: boolean
  webhooksOpen: boolean
  setStatisticsOpen: (open: boolean) => void
  setWebhooksOpen: (open: boolean) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'functions',
  setView: (view) => set({ currentView: view }),
  statisticsOpen: false,
  webhooksOpen: false,
  setStatisticsOpen: (open) => set({ statisticsOpen: open }),
  setWebhooksOpen: (open) => set({ webhooksOpen: open }),
}))
