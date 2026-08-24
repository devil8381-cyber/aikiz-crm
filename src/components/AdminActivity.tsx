'use client'

import { useEffect, useState, useCallback, useReducer } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  CREATE_LEAD: 'bg-emerald-100 text-emerald-700',
  DELETE_LEAD: 'bg-red-100 text-red-700',
  UPDATE_STATUS: 'bg-teal-100 text-teal-700',
  MARKED_VM: 'bg-pink-100 text-pink-700',
  COMPLETE_CALLBACK: 'bg-violet-100 text-violet-700',
  SEND_EMAIL: 'bg-blue-100 text-blue-700',
  GENERATE_TCPA_LINK: 'bg-amber-100 text-amber-700',
  GENERATE_DOC_LINK: 'bg-cyan-100 text-cyan-700',
  BULK_UPLOAD: 'bg-indigo-100 text-indigo-700',
  CREATE_USER: 'bg-emerald-100 text-emerald-700',
  UPDATE_USER: 'bg-teal-100 text-teal-700',
  DELETE_USER: 'bg-red-100 text-red-700',
  UPDATE_SCRIPT: 'bg-slate-100 text-slate-700',
}

type State = { logs: any[]; total: number; loading: boolean }
type Action =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_DATA'; logs: any[]; total: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.loading }
    case 'SET_DATA': return { logs: action.logs, total: action.total, loading: false }
  }
}

export default function AdminActivity() {
  const [state, dispatch] = useReducer(reducer, { logs: [], total: 0, loading: true })
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  const fetchLogs = useCallback(async (p: number, uid: string) => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const params = new URLSearchParams({ page: String(p), limit: '50' })
    if (uid) params.set('userId', uid)
    try {
      const res = await fetch(`/api/activity?${params}`)
      const data = await res.json()
      dispatch({ type: 'SET_DATA', logs: data.logs || [], total: data.total || 0 })
    } catch {
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }, [])

  useEffect(() => {
    fetchLogs(page, userId)
  }, [page, userId, fetchLogs])

  const totalPages = Math.ceil(state.total / 50)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activity Logs</h2>
          <p className="text-slate-500 text-sm mt-1">Track all user actions in the system</p>
        </div>
        <Select value={userId || 'all'} onValueChange={v => { setUserId(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Users" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
            {state.loading ? (
              <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>
            ) : state.logs.length === 0 ? (
              <p className="text-center py-12 text-slate-400">No activity logs</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {state.logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50">
                    <div className="mt-0.5">
                      <Activity className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{log.user?.name || 'System'}</span>
                        <Badge className={`text-[10px] ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>{log.action.replace(/_/g, ' ')}</Badge>
                        <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">Page {page} of {totalPages} ({state.total} entries)</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-3 h-3" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}