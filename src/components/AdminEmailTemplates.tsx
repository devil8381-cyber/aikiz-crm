'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Mail, Save, User, Eye, CheckCircle, AlertCircle } from 'lucide-react'
import { DEFAULT_TEMPLATES, EMAIL_TYPE_META, fillEmailTemplate, type EmailType } from '@/lib/email-defaults'

const TYPES = Object.keys(EMAIL_TYPE_META) as EmailType[]

export default function AdminEmailTemplates() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [selectedType, setSelectedType] = useState<EmailType>('TCPA_C1')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/email-templates')
      const data = await res.json()
      setUsers(data.users || [])
      if (data.users?.length && !selectedId) selectUser(data.users[0])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  const selectUser = async (u: any) => {
    setSelectedId(u.id)
    setPhoneDisplay(u.phoneDisplay || '')
    try {
      const res = await fetch(`/api/email-templates?userId=${u.id}`)
      const data = await res.json()
      const map: Record<string, any> = {}
      ;(data.templates || []).forEach((t: any) => { map[t.emailType] = t })
      setTemplates(map)
      loadTemplateForType(selectedType, map, u)
    } catch { setTemplates({}) }
  }

  const loadTemplateForType = (type: EmailType, tpls?: Record<string, any>, u?: any) => {
    const t = tpls || templates
    const saved = t[type]
    const def = DEFAULT_TEMPLATES[type]
    setSelectedType(type)
    setSubject(saved?.subject || def.subject)
    setBody(saved?.body || def.body)
    setLink(saved?.link || EMAIL_TYPE_META[type].defaultLink || '')
  }

  const save = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedId, emailType: selectedType, subject, body, link, phoneDisplay }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Save failed'); return }
      toast.success(`${EMAIL_TYPE_META[selectedType].label} template saved`)
      loadUsers()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const resetToDefault = () => {
    const def = DEFAULT_TEMPLATES[selectedType]
    setSubject(def.subject)
    setBody(def.body)
    setLink(EMAIL_TYPE_META[selectedType].defaultLink || '')
    toast.info('Reset to default template')
  }

  const previewHtml = fillEmailTemplate(body, { firstName: 'John', lastName: 'Doe', agentName: users.find(u => u.id === selectedId)?.name || 'Agent', agentPhone: phoneDisplay || '(972) 532-0072', consentLink: link })

  const selected = users.find(u => u.id === selectedId)

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-6 h-6 text-violet-600" />
          Email Templates
        </h2>
        <p className="text-sm text-slate-500 mt-1">Edit email templates per agent. Agents see the templates you assign. Fields: {'{{firstName}}'}, {'{{agentName}}'}, {'{{agentPhone}}'}, {'{{consentLink}}'}, {'{{department}}'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Agent list */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 max-h-[75vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Agents</p>
          {loading && <p className="text-sm text-slate-400 px-2">Loading...</p>}
          {users.map(u => {
            const tplCount = u.emailTemplates?.length || 0
            return (
              <button key={u.id} type="button" onClick={() => selectUser(u)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 ${selectedId === u.id ? 'bg-violet-50 text-violet-900 font-semibold border border-violet-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                <User className="w-4 h-4 shrink-0 opacity-60" />
                <span className="truncate flex-1">
                  {u.name}
                  <span className="block text-[10px] font-normal text-slate-400">{tplCount} custom templates</span>
                </span>
                {tplCount > 0 && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          {selected && (
            <>
              {/* Agent info + phone */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">{selected.name?.[0]}</div>
                    <div><p className="font-semibold text-slate-800">{selected.name}</p><p className="text-xs text-slate-400">{selected.email}</p></div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Label className="text-xs text-slate-500 shrink-0">Agent Phone (in signatures)</Label>
                    <Input value={phoneDisplay} onChange={e => setPhoneDisplay(e.target.value)} placeholder="(972) 532-0072" className="h-9 w-40 rounded-lg text-sm" />
                  </div>
                </div>
              </div>

              {/* Email type tabs */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {TYPES.map(t => {
                    const hasCustom = !!templates[t]
                    return (
                      <button key={t} type="button" onClick={() => loadTemplateForType(t)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${selectedType === t ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        {EMAIL_TYPE_META[t].label}
                        {hasCustom && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Customized" />}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Edit side */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Subject Line</Label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 h-10 rounded-lg text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Email Body (plain text)</Label>
                      <textarea value={body} onChange={e => setBody(e.target.value)} rows={14} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-y font-mono leading-relaxed" />
                    </div>
                    {(selectedType === 'TCPA_C1' || selectedType === 'TCPA_C2' || selectedType === 'TCPA_C3') && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600">Consent Link</Label>
                        <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="mt-1 h-10 rounded-lg text-sm" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button className="rounded-lg bg-violet-600 hover:bg-violet-700 gap-1" disabled={saving} onClick={save}>
                        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Template'}
                      </Button>
                      <Button variant="outline" className="rounded-lg gap-1" onClick={resetToDefault}>
                        <AlertCircle className="w-4 h-4" /> Reset to Default
                      </Button>
                    </div>
                  </div>

                  {/* Preview side */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-slate-500" />
                      <Label className="text-xs font-medium text-slate-600">Preview (as John Doe would see it)</Label>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-[500px] overflow-y-auto">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Subject:</p>
                      <p className="text-sm font-medium text-slate-800 mb-3 p-2 bg-white rounded-lg border">{fillEmailTemplate(subject, { firstName: 'John' })}</p>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Body:</p>
                      <pre className="whitespace-pre-wrap text-xs text-slate-700 p-3 bg-white rounded-lg border leading-relaxed font-sans">{previewHtml}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
