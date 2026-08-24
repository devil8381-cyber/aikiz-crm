'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { MessageSquare, Save, Plus, Trash2, User } from 'lucide-react'
import { DEFAULT_SMS_BODY } from '@/lib/sms-templates'

export default function AdminSmsTemplates() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [templates, setTemplates] = useState<any[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('Default SMS')
  const [body, setBody] = useState(DEFAULT_SMS_BODY)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms-templates')
      const data = await res.json()
      const list = data.users || []
      setUsers(list)
      if (!selectedId && list.length) {
        selectAgent(list[0])
      } else if (selectedId) {
        const u = list.find((x: any) => x.id === selectedId)
        if (u) selectAgent(u)
      }
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectAgent = (u: any) => {
    setSelectedId(u.id)
    setPhoneDisplay(u.phoneDisplay || '')
    setTemplates(u.smsTemplates || [])
    const def = (u.smsTemplates || []).find((t: any) => t.isDefault) || (u.smsTemplates || [])[0]
    if (def) {
      setEditId(def.id)
      setTitle(def.title)
      setBody(def.body)
    } else {
      setEditId(null)
      setTitle('Default SMS')
      setBody(DEFAULT_SMS_BODY)
    }
  }

  const savePhone = async () => {
    try {
      await fetch(`/api/users/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneDisplay }),
      })
      toast.success('Agent phone number saved')
      load()
    } catch {
      toast.error('Failed to save phone')
    }
  }

  const saveTemplate = async () => {
    if (!selectedId) return
    try {
      if (editId) {
        await fetch('/api/sms-templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, title, body, phoneDisplay }),
        })
        toast.success('Template updated')
      } else {
        await fetch('/api/sms-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedId, title, body, phoneDisplay, isDefault: true }),
        })
        toast.success('Template created')
      }
      load()
    } catch {
      toast.error('Save failed')
    }
  }

  const addNew = () => {
    setEditId(null)
    setTitle('New template')
    setBody(DEFAULT_SMS_BODY)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/sms-templates?id=${id}`, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  const selected = users.find((u) => u.id === selectedId)

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          SMS Templates by Agent
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Each agent has their own text format and callback number. Merge fields:{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">{'{{firstName}}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">{'{{agentName}}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">{'{{agentPhone}}'}</code>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Agents</p>
          {loading && <p className="text-sm text-slate-400 px-2">Loading…</p>}
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectAgent(u)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
                selectedId === u.id ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <User className="w-4 h-4 shrink-0 opacity-60" />
              <span className="truncate">
                {u.name}
                <span className="block text-[10px] font-normal text-slate-400">{u.phoneDisplay || 'No phone set'}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Agent: {selected.name}</p>
                <div>
                  <Label className="text-xs text-slate-500">Callback / display number (appears in SMS)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={phoneDisplay}
                      onChange={(e) => setPhoneDisplay(e.target.value)}
                      placeholder="(972) 532-0072"
                      className="h-10 rounded-xl"
                    />
                    <Button type="button" variant="outline" className="rounded-xl" onClick={savePhone}>
                      Save #
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Templates</p>
                  <Button type="button" size="sm" variant="outline" className="rounded-lg gap-1" onClick={addNew}>
                    <Plus className="w-3.5 h-3.5" /> New
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setEditId(t.id)
                        setTitle(t.title)
                        setBody(t.body)
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                        editId === t.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-10 rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs">Message body</Label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1" onClick={saveTemplate}>
                    <Save className="w-4 h-4" /> Save template
                  </Button>
                  {editId && (
                    <Button type="button" variant="outline" className="rounded-xl text-red-600 gap-1" onClick={() => remove(editId)}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
