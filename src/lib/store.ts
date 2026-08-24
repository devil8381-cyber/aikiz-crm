import { create } from 'zustand'

export type View = 'dashboard' | 'leads' | 'admin-users' | 'admin-script' | 'admin-upload' | 'admin-activity' | 'admin-sms' | 'admin-email' | 'admin-settings' | 'claimant'

export const DEFAULT_CALL_TARGET = 50

interface AppState {
  view: View
  setView: (v: View) => void
  selectedLeadId: string | null
  setSelectedLeadId: (id: string | null) => void
  scriptOpen: boolean
  setScriptOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (c: boolean) => void
  refreshKey: number
  triggerRefresh: () => void
  wsConnected: boolean
  onlineAgents: number
  setWsConnected: (c: boolean) => void
  todayCalls: number
  setTodayCalls: (n: number) => void
  dailyCallTarget: number
  setDailyCallTarget: (n: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
  scriptOpen: false,
  setScriptOpen: (open) => set({ scriptOpen: open }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (c) => set({ sidebarCollapsed: c }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
  wsConnected: false,
  onlineAgents: 0,
  setWsConnected: (c) => set({ wsConnected: c }),
  todayCalls: 0,
  setTodayCalls: (n) => set({ todayCalls: n }),
  dailyCallTarget: DEFAULT_CALL_TARGET,
  setDailyCallTarget: (n) => set({ dailyCallTarget: n }),
}))
