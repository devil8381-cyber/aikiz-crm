'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

interface RealtimeMessage {
  type: string
  payload?: any
  from?: string
}

// Polling-based real-time — works everywhere including Vercel serverless
// Polls the activity log API every 5 seconds for changes from other agents
function usePollingRealtime() {
  const { data: session } = useSession()
  const user = session?.user as any
  // This is a timestamp cursor, rather than a database id. CUIDs are not
  // chronological, so comparing ids can skip (or repeat) events.
  const lastEventCursorRef = useRef<string>('')
  const hasInitialSnapshotRef = useRef(false)
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    if (!mountedRef.current || !user?.id) return
    try {
      const params = new URLSearchParams()
      params.set('limit', '10')
      params.set('poll', '1')
      if (lastEventCursorRef.current) params.set('after', lastEventCursorRef.current)
      const res = await fetch(`/api/activity?${params.toString()}`, {
        // Polling is background synchronization. Do not use a cached response.
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      const logs: any[] = data.logs || []
      if (data.nextCursor) lastEventCursorRef.current = data.nextCursor
      if (logs.length > 0) {
        const store = useAppStore.getState()
        // The first response establishes the baseline. Existing activity must
        // never make the current screen re-render as if it were new activity.
        if (!hasInitialSnapshotRef.current) {
          hasInitialSnapshotRef.current = true
          useAppStore.setState({ wsConnected: true })
          return
        }
        // Check if any log is from another user
        const otherUserLogs = logs.filter((l: any) => l.userId !== user.id)
        if (otherUserLogs.length > 0) {
          // Trigger data refresh
          store.triggerRefresh()
          // Show toast for recent activity from others
          for (const log of otherUserLogs.slice(0, 2)) {
            const actorName = log.user?.name || 'Another agent'
            const actionText = log.details || log.action
            if (log.action === 'UPDATE_STATUS') {
              toast.info(`${actorName} updated a lead`, {
                description: actionText,
                duration: 4000,
              })
            } else if (log.action === 'CREATE_LEAD' || log.action === 'BULK_UPLOAD') {
              toast.success(`${actorName} added new leads`, { duration: 4000 })
            } else if (log.action === 'COMPLETE_CALLBACK') {
              toast.success(`Callback completed`, { duration: 4000 })
            }
          }
        }
        // Update online status
        useAppStore.setState({ wsConnected: true })
      }
    } catch {
      useAppStore.setState({ wsConnected: false })
    }
  }, [user?.id])

  // Poll every 5 seconds
  useEffect(() => {
    if (!user?.id) return
    mountedRef.current = true
    lastEventCursorRef.current = ''
    hasInitialSnapshotRef.current = false
    poll() // Initial fetch
    const interval = setInterval(poll, 5000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [poll, user?.id])
}

// Export: always use polling (works on Vercel, Railway, any serverless platform)
export function useWebSocket() {
  usePollingRealtime()
  const connected = useAppStore(s => s.wsConnected)
  return { connected }
}
