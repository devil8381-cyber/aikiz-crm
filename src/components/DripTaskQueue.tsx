'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MessageSquare, Send } from 'lucide-react'
import { openSms, copyText } from '@/lib/zoom'

type Task = {
  enrollmentId: string
  sequenceType: string
  lead: { id: string; firstName: string; lastName: string; phone: string }
  sms: { title: string; body: string }
}

export default function DripTaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/drip/tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      // silent — this widget shouldn't be noisy if it fails to load
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const send = async (task: Task) => {
    setSendingId(task.enrollmentId)
    try {
      const copied = await copyText(task.sms.body)
      if (copied) toast.success('Message copied — opening SMS…')
      openSms(task.lead.phone, task.sms.body)
      await fetch('/api/sms-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: task.lead.id,
          title: task.sms.title,
          smsBody: task.sms.body,
          dripSequenceType: task.sequenceType,
        }),
      })
      setTasks((prev) => prev.filter((t) => t.enrollmentId !== task.enrollmentId))
      toast.success(`Sent to ${task.lead.firstName} ${task.lead.lastName}`)
    } catch {
      toast.error('Could not log the send — check the message went out')
    } finally {
      setSendingId(null)
    }
  }

  if (loading || tasks.length === 0) return null

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-violet-900">
          Drip SMS due ({tasks.length})
        </h3>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.enrollmentId}
            className="flex items-start justify-between gap-3 rounded-lg bg-white border border-violet-100 p-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">
                {task.lead.firstName} {task.lead.lastName} · {task.sms.title}
              </div>
              <div className="text-sm text-slate-800 truncate">{task.sms.body}</div>
            </div>
            <Button
              size="sm"
              onClick={() => send(task)}
              disabled={sendingId === task.enrollmentId}
              className="shrink-0 gap-1"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
