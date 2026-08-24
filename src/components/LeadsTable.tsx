'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Phone, Mail, Clock, FileText, Upload, Trash2,
  Send, ChevronLeft, ChevronRight, RefreshCw, X, Copy,
  UserCircle, MapPin, CalendarDays, Briefcase, Building2, ShieldCheck,
  MessageSquare, PhoneCall, HeartPulse, ClipboardCheck, Download
} from 'lucide-react'
import { fillTemplate, DEFAULT_SMS_BODY } from '@/lib/sms-templates'
import { dialZoomPhone, openSms, copyText, normalizePhone } from '@/lib/zoom'

const STATUSES = ['New', 'Interested', 'Signed', 'DNQ', 'Not Interested', 'Callback', 'VM']
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; gradient: string }> = {
  New: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', gradient: 'from-slate-400 to-slate-500' },
  Interested: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', gradient: 'from-emerald-400 to-emerald-500' },
  Signed: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', gradient: 'from-teal-400 to-emerald-500' },
  DNQ: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', gradient: 'from-amber-400 to-amber-500' },
  'Not Interested': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', gradient: 'from-red-400 to-red-500' },
  Callback: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', gradient: 'from-violet-400 to-violet-500' },
  VM: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500', gradient: 'from-pink-400 to-pink-500' },
}
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
]

export default function LeadsTable() {
  const { data: session } = useSession()
  const user = session?.user as any
  const { selectedLeadId, setSelectedLeadId, triggerRefresh, refreshKey } = useAppStore()
  const isAdmin = user?.role === 'ADMIN'

  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [showCallbackDialog, setShowCallbackDialog] = useState(false)
  const [showSmsDialog, setShowSmsDialog] = useState(false)
  const [smsPreview, setSmsPreview] = useState('')
  const [agentTemplates, setAgentTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [agentPhone, setAgentPhone] = useState('')
  const [dispositionRequired, setDispositionRequired] = useState(false)
  const [statusAtOpen, setStatusAtOpen] = useState('')
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [emailPreview, setEmailPreview] = useState<any>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [medicalRecords, setMedicalRecords] = useState<any[]>([])
  const [showMedicalConfirm, setShowMedicalConfirm] = useState(false)
  const [medicalConfirmLead, setMedicalConfirmLead] = useState<any>(null)
  const [medicalSending, setMedicalSending] = useState(false)
  const [callbackForm, setCallbackForm] = useState({ callbackDate: '', callbackTime: '', ampm: 'AM', timezone: 'America/New_York' })
  const [updating, setUpdating] = useState(false)
  const dispositionLock = useRef(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (statusFilter !== 'All') params.set('status', statusFilter)
      const res = await fetch(`/api/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, search, statusFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads, refreshKey])

  useEffect(() => {
    if (selectedLeadId) {
      fetch(`/api/leads/${selectedLeadId}`).then(r => r.json()).then(d => {
        setSelectedLead(d)
        // Fetch medical records for this lead
        fetch(`/api/medical-records?leadId=${selectedLeadId}`).then(r => r.json()).then(d => setMedicalRecords(d.records || [])).catch(() => {})
      }).catch(() => {})
    } else {
      setMedicalRecords([])
    }
  }, [selectedLeadId, refreshKey])

  const updateDisposition = async (leadId: string, status: string, callbackData?: any) => {
    if (dispositionLock.current) return
    dispositionLock.current = true
    setUpdating(true)
    try {
      const body: any = { status }
      if (callbackData) body.callbackData = callbackData
      const res = await fetch(`/api/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Update failed'); return }
      toast.success(`Disposition: ${status}`)
      triggerRefresh(); fetchLeads()
      // Auto-close detail dialog after disposition change
      setSelectedLead(null); setSelectedLeadId(null); setDispositionRequired(false)
    } catch (e) { toast.error('Failed to update') }
    finally { setUpdating(false); setShowCallbackDialog(false); setTimeout(() => { dispositionLock.current = false }, 500) }
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return
    try {
      await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _delete: true }) })
      toast.success('Lead deleted'); setSelectedLead(null); setSelectedLeadId(null); triggerRefresh(); fetchLeads()
    } catch (e) { toast.error('Failed to delete') }
  }

  const openEmailConfirm = async (leadId: string, emailType: string) => {
    try {
      const res = await fetch(`/api/email?leadId=${leadId}&emailType=${emailType}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to load email'); return }
      if (!data.hasEmail) { toast.error('This lead has no email address'); return }
      setEmailPreview(data)
      setShowEmailConfirm(true)
    } catch { toast.error('Failed to prepare email') }
  }

  const confirmSendEmail = async () => {
    if (!emailPreview || !selectedLead) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          emailType: emailPreview.emailType,
          subject: emailPreview.subject,
          text: emailPreview.text,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Send failed'); return }
      toast.success(`Email sent from ${data.from}`)
      setShowEmailConfirm(false)
      setEmailPreview(null)
    } catch { toast.error('Send failed') }
    finally { setEmailSending(false) }
  }

  const sendEmail = async (leadId: string, type: string) => {
    await openEmailConfirm(leadId, type)
  }



  const generateTcpa = async (leadId: string, formType: string) => {
    try {
      const res = await fetch('/api/tcpa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, formType }) })
      const data = await res.json()
      if (data.link) { navigator.clipboard.writeText(data.link); toast.success(`${formType} link copied!`) }
      else toast.info(data.message || data.error)
    } catch (e) { toast.error('Failed') }
  }

  const generateDocLink = async (leadId: string) => {
    try {
      const res = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId }) })
      const data = await res.json()
      if (data.link) { navigator.clipboard.writeText(data.link); toast.success('Doc link copied!') }
    } catch (e) { toast.error('Failed') }
  }

  const requestMedicalRecords = (lead: any) => {
    if (!lead.email?.trim()) {
      toast.error('This claimant has no email address. Add an email first.')
      return
    }
    setMedicalConfirmLead(lead)
    setShowMedicalConfirm(true)
  }

  const confirmMedicalSend = async () => {
    if (!medicalConfirmLead) return
    setMedicalSending(true)
    try {
      const res = await fetch('/api/medical-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: medicalConfirmLead.id }) })
      const data = await res.json()
      if (!res.ok || !data.emailed) {
        toast.error(data.error || 'Could not send the secure records request')
        return
      }
      toast.success(`Secure records request sent to ${data.to}`)
      setShowMedicalConfirm(false)
      setMedicalConfirmLead(null)
      // Refresh medical records list
      if (selectedLeadId) {
        fetch(`/api/medical-records?leadId=${selectedLeadId}`).then(r => r.json()).then(d => setMedicalRecords(d.records || [])).catch(() => {})
      }
    } catch {
      toast.error('Could not send the secure records request. Please try again.')
    } finally {
      setMedicalSending(false)
    }
  }

  const agentName = user?.name || 'our team'

  const loadAgentSmsProfile = async () => {
    try {
      const res = await fetch('/api/sms-templates')
      const data = await res.json()
      const templates = data.templates || []
      setAgentTemplates(templates)
      setAgentPhone(data.agent?.phoneDisplay || '')
      const def = templates.find((t: any) => t.isDefault) || templates[0]
      if (def) {
        setSelectedTemplateId(def.id)
        return def
      }
      setSelectedTemplateId('')
      return null
    } catch {
      return null
    }
  }

  const handleZoomCall = (phone: string) => {
    if (!phone) { toast.error('No phone number'); return }
    const ok = dialZoomPhone(phone)
    if (ok) {
      toast.success('Opening Zoom Phone…')
      setDispositionRequired(true)
    } else toast.error('Invalid phone number')
  }

  const buildMessage = (lead: any, templateBody?: string) => {
    const body = templateBody || DEFAULT_SMS_BODY
    return fillTemplate(body, lead, agentName, agentPhone)
  }

  const openSmsComposer = async (lead: any) => {
    setSelectedLead(lead)
    setSelectedLeadId(lead.id)
    setDispositionRequired(true)
    const def = await loadAgentSmsProfile()
    const body = buildMessage(lead, def?.body)
    setSmsPreview(body)
    if (def) setSelectedTemplateId(def.id)
    setShowSmsDialog(true)
  }

  const applyAgentTemplate = (tpl: any, lead: any) => {
    setSelectedTemplateId(tpl.id)
    setSmsPreview(buildMessage(lead, tpl.body))
  }

  const sendSmsFromTemplate = async (lead: any) => {
    if (!lead?.phone) { toast.error('No phone number'); return }
    const body = smsPreview.trim()
    if (!body) { toast.error('Message is empty'); return }
    const copied = await copyText(body)
    if (copied) toast.success('Message copied — opening Zoom / SMS…')
    else toast.info('Could not copy — select text manually')
    try { openSms(lead.phone, body) } catch { /* ignore */ }
    // Fire-and-forget: keeps lastContactedAt + the audit trail in sync even
    // though the actual send happens in the agent's own phone/Zoom app.
    fetch('/api/sms-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, smsBody: body, dripSequenceType: lead._dripSequenceType }),
    }).catch(() => { /* logging is best-effort, never block the agent */ })
    setDispositionRequired(true)
  }

  const tryCloseLeadDialog = (open: boolean) => {
    if (open) return
    // Compulsory disposition: cannot close if still New and contact was attempted
    if (selectedLead && dispositionRequired && selectedLead.status === 'New') {
      toast.error('Disposition is required. Please set a status before closing.')
      return
    }
    setSelectedLead(null)
    setSelectedLeadId(null)
    setDispositionRequired(false)
  }



  const totalPages = Math.ceil(total / 50)
  const initials = (f: string, l: string) => `${f?.[0] || ''}${l?.[0] || ''}`

  const avatarColors = ['from-teal-400 to-emerald-500', 'from-blue-400 to-indigo-500', 'from-violet-400 to-purple-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500', 'from-cyan-400 to-teal-500']
  const getAvatarColor = (name: string) => avatarColors[name.length % avatarColors.length]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leads</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage and track all your claimants</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3  w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, phone, email..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 focus-visible:ring-teal-500/25 focus-visible:border-teal-500/25"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-38 h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={fetchLeads}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'All' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({total})
        </button>
        {STATUSES.map(s => {
          const st = STATUS_STYLES[s]
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s ? `${st.bg} ${st.text} shadow-sm ring-1 ` : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {s}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Claimant</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Case Type</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Agent</th>
                <th className="text-right px-4 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16"><p className="text-slate-400">No leads found</p></td></tr>
              ) : (
                <AnimatePresence>
                  {leads.map((lead, i) => {
                    const st = STATUS_STYLES[lead.status] || STATUS_STYLES.New
                    return (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-slate-50 hover:bg-slate-100/50 transition-colors group"
                      >
                        <td className="px-5 py-3">
                          <button onClick={() => { setSelectedLeadId(lead.id); setSelectedLead(lead); setStatusAtOpen(lead.status); setDispositionRequired(lead.status === 'New') }} className="flex items-center gap-3 text-left">
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(lead.firstName + lead.lastName)} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
                              {initials(lead.firstName, lead.lastName)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 group-hover:text-teal-600 transition-colors text-sm">{lead.firstName} {lead.lastName}</p>
                              {lead.claimNumber && <p className="text-[10px] text-slate-400 font-mono">{lead.claimNumber}</p>}
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 font-mono text-xs bg-slate-50 px-2 py-1 rounded-md">{lead.phone}</span>
                            <button
                              type="button"
                              title="Call with Zoom Phone"
                              onClick={(e) => { e.stopPropagation(); handleZoomCall(lead.phone) }}
                              className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Text with template"
                              onClick={(e) => { e.stopPropagation(); openSmsComposer(lead) }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs truncate max-w-[160px]">{lead.email || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded-md">{lead.caseType || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={lead.status} onValueChange={(v) => {
                            if (v === 'Callback') {
                              setSelectedLead(lead)
                              setCallbackForm({ callbackDate: new Date().toISOString().split('T')[0], callbackTime: '10:00', ampm: 'AM', timezone: 'America/New_York' })
                              setShowCallbackDialog(true)
                            } else updateDisposition(lead.id, v)
                          }}>
                            <SelectTrigger className={`w-[120px] h-7 text-[11px] font-semibold border-0 rounded-lg ${st.bg} ${st.text}`}>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{lead.assignedTo?.name || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-teal-50 hover:text-teal-600"
                            onClick={() => { setSelectedLeadId(lead.id); setSelectedLead(lead); setStatusAtOpen(lead.status); setDispositionRequired(lead.status === 'New') }}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-100/50">
            <p className="text-xs text-slate-400">Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 rounded-lg"><ChevronLeft className="w-3.5 h-3.5" /></Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number
                  if (totalPages <= 5) p = i + 1
                  else if (page <= 3) p = i + 1
                  else if (page >= totalPages - 2) p = totalPages - 4 + i
                  else p = page - 2 + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        p === page ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >{p}</button>
                  )
                })}
              </div>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 rounded-lg"><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Callback Dialog */}
      <Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Clock className="w-4 h-4 text-violet-600" /></div>
              Schedule Callback
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(selectedLead.firstName)} flex items-center justify-center text-white text-sm font-bold`}>
                  {initials(selectedLead.firstName, selectedLead.lastName)}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">{selectedLead.firstName} {selectedLead.lastName}</p>
                  <p className="text-xs text-slate-500">{selectedLead.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date</Label>
                  <Input type="date" value={callbackForm.callbackDate} onChange={e => setCallbackForm(f => ({ ...f, callbackDate: e.target.value }))} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Time</Label>
                  <Input type="time" value={callbackForm.callbackTime} onChange={e => setCallbackForm(f => ({ ...f, callbackTime: e.target.value }))} className="h-10 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">AM / PM</Label>
                  <Select value={callbackForm.ampm} onValueChange={v => setCallbackForm(f => ({ ...f, ampm: v }))}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Timezone</Label>
                  <Select value={callbackForm.timezone} onValueChange={v => setCallbackForm(f => ({ ...f, timezone: v }))}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{US_TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-semibold shadow-lg " disabled={updating} onClick={() => updateDisposition(selectedLead.id, 'Callback', callbackForm)}>
                {updating ? 'Scheduling...' : 'Schedule Callback'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>



      {/* Email confirm before send */}
      <Dialog open={showEmailConfirm} onOpenChange={(o) => { if (!o) { setShowEmailConfirm(false); setEmailPreview(null) } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Confirm email — {emailPreview?.label}</DialogTitle>
          </DialogHeader>
          {emailPreview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-slate-900 text-white px-4 py-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Will send from</p>
                <p className="font-semibold text-base">{emailPreview.from}</p>
                <p className="text-xs text-slate-300">To: {emailPreview.to}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Subject</p>
                <p className="font-medium text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">{emailPreview.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Message preview</p>
                <pre className="whitespace-pre-wrap text-xs text-slate-700 border border-slate-200 rounded-lg px-3 py-3 bg-white max-h-56 overflow-y-auto font-sans leading-relaxed">{emailPreview.text}</pre>
              </div>
              <p className="text-[11px] text-slate-500">Agent cannot edit this text. Admin sets templates per agent. Signature includes name, department, and phone.</p>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                  disabled={emailSending}
                  onClick={confirmSendEmail}
                >
                  {emailSending ? 'Sending…' : `Send from ${emailPreview.from}`}
                </Button>
                <Button variant="outline" className="h-11 rounded-xl" disabled={emailSending} onClick={() => { setShowEmailConfirm(false); setEmailPreview(null) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Medical Records Email Confirmation */}
      <Dialog open={showMedicalConfirm} onOpenChange={(o) => { if (!o) { setShowMedicalConfirm(false); setMedicalConfirmLead(null) } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Confirm Medical Records Request</DialogTitle>
          </DialogHeader>
          {medicalConfirmLead && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 space-y-1">
                <p className="text-xs text-rose-500 font-medium">A secure email will be sent to:</p>
                <p className="font-semibold text-slate-900">{medicalConfirmLead.email}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Claimant</p>
                <p className="font-medium text-slate-800">{medicalConfirmLead.firstName} {medicalConfirmLead.lastName}</p>
                <p className="text-xs text-slate-500">{medicalConfirmLead.caseType} &middot; {medicalConfirmLead.claimNumber || 'N/A'}</p>
              </div>
              <p className="text-xs text-slate-500">The email will contain a secure link where the claimant can view their case details and upload supporting medical documents for claim processing.</p>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold"
                  disabled={medicalSending}
                  onClick={confirmMedicalSend}
                >
                  {medicalSending ? 'Sending…' : 'Yes, Send Secure Email'}
                </Button>
                <Button variant="outline" className="h-11 rounded-xl" disabled={medicalSending} onClick={() => { setShowMedicalConfirm(false); setMedicalConfirmLead(null) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SMS Template Dialog */}
      <Dialog open={showSmsDialog} onOpenChange={(open) => { if (!open) setShowSmsDialog(false) }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Text message — {selectedLead?.firstName} {selectedLead?.lastName}
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 mt-1">
              <div>
                <Label className="text-xs text-slate-500">Template</Label>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {(agentTemplates.length ? agentTemplates : [{ id: 'fallback', title: 'Default', body: DEFAULT_SMS_BODY, category: 'default' }]).map((tpl: any) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyAgentTemplate(tpl, selectedLead)}
                      className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                        selectedTemplateId === tpl.id
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div>{tpl.title || tpl.name || 'Template'}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Message (auto-filled — you can edit)</Label>
                <textarea
                  value={smsPreview}
                  onChange={(e) => setSmsPreview(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  To: {normalizePhone(selectedLead.phone) || selectedLead.phone}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold"
                  onClick={() => sendSmsFromTemplate(selectedLead)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy & open SMS
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={async () => {
                    const ok = await copyText(smsPreview)
                    toast.success(ok ? 'Copied — paste in Zoom Phone' : 'Copy failed')
                  }}
                >
                  Copy only
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Zoom Phone SMS: message is copied to clipboard. Open the lead in Zoom Phone SMS and paste (Ctrl+V). On some systems the SMS app also opens with the text pre-filled.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead && !showCallbackDialog && !showSmsDialog} onOpenChange={tryCloseLeadDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getAvatarColor(selectedLead?.firstName + selectedLead?.lastName || '')} flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
                {initials(selectedLead?.firstName || '', selectedLead?.lastName || '')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-900">{selectedLead?.firstName} {selectedLead?.lastName}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${STATUS_STYLES[selectedLead?.status || 'New']?.bg} ${STATUS_STYLES[selectedLead?.status || 'New']?.text}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[selectedLead?.status || 'New']?.dot}`} />
                    {selectedLead?.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{selectedLead?.claimNumber}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-5 mt-2">
              {/* Contact Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <DetailCard icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={selectedLead.phone} color="text-teal-600" />
                <DetailCard icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={selectedLead.email || '-'} color="text-blue-600" />
                <DetailCard icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={`${selectedLead.city || '-'}, ${selectedLead.state || ''}`} color="text-rose-600" />
                <DetailCard icon={<CalendarDays className="w-3.5 h-3.5" />} label="DOB" value={selectedLead.dateOfBirth || '-'} color="text-amber-600" />
              </div>

              {/* Zoom Phone + SMS */}
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 space-y-2">
                <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Call & Text (Zoom Phone)</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleZoomCall(selectedLead.phone)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Call with Zoom Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => openSmsComposer(selectedLead)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Text (templates)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(selectedLead.phone || '')
                      toast.success(ok ? 'Phone copied' : 'Copy failed')
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-700 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy #
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Requires Zoom Phone desktop app installed. Texts are pre-filled with the lead's name.</p>
              </div>

              <Separator className="bg-slate-100" />

              {/* Case Info */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Case Information</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <DetailCard icon={<Briefcase className="w-3.5 h-3.5" />} label="Case Type" value={selectedLead.caseType || '-'} color="text-violet-600" />
                  <DetailCard icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Claim #" value={selectedLead.claimNumber || '-'} color="text-emerald-600" />
                  <DetailCard icon={<CalendarDays className="w-3.5 h-3.5" />} label="Date of Incident" value={selectedLead.dateOfIncident || '-'} color="text-orange-600" />
                  <DetailCard icon={<Building2 className="w-3.5 h-3.5" />} label="Insurance" value={selectedLead.insuranceCarrier || '-'} color="text-slate-600" />
                </div>
              </div>


              {/* Compulsory disposition */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/80 p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Disposition (required)</p>
                <p className="text-[11px] text-amber-700">You must set a status before closing this lead.</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.filter(s => s !== 'New').map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        if (s === 'Callback') {
                          setCallbackForm({ callbackDate: new Date().toISOString().split('T')[0], callbackTime: '10:00', ampm: 'AM', timezone: 'America/New_York' })
                          setShowCallbackDialog(true)
                        } else {
                          updateDisposition(selectedLead.id, s)
                          setDispositionRequired(false)
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        selectedLead.status === s
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ActionBtn icon={<PhoneCall className="w-4 h-4" />} label="Zoom Call" gradient="from-teal-500 to-emerald-600" onClick={() => handleZoomCall(selectedLead.phone)} />
                  <ActionBtn icon={<MessageSquare className="w-4 h-4" />} label="SMS Template" gradient="from-blue-500 to-indigo-600" onClick={() => openSmsComposer(selectedLead)} />
                  <ActionBtn icon={<Send className="w-4 h-4" />} label="Follow-up Mail" gradient="from-blue-500 to-indigo-500" onClick={() => openEmailConfirm(selectedLead.id, 'FOLLOWUP_VM')} />
                  <ActionBtn icon={<FileText className="w-4 h-4" />} label="TCPA C-1 Consent" gradient="from-teal-500 to-emerald-500" onClick={() => openEmailConfirm(selectedLead.id, 'TCPA_C1')} />
                  <ActionBtn icon={<FileText className="w-4 h-4" />} label="TCPA C-2 Consent" gradient="from-violet-500 to-purple-500" onClick={() => openEmailConfirm(selectedLead.id, 'TCPA_C2')} />
                  <ActionBtn icon={<FileText className="w-4 h-4" />} label="TCPA C-3 Consent" gradient="from-amber-500 to-orange-500" onClick={() => openEmailConfirm(selectedLead.id, 'TCPA_C3')} />
                  <ActionBtn icon={<Upload className="w-4 h-4" />} label="Request Docs" gradient="from-cyan-500 to-teal-500" onClick={() => openEmailConfirm(selectedLead.id, 'REQUEST_DOCS')} />
                  <ActionBtn icon={<HeartPulse className="w-4 h-4" />} label="Email Records Request" gradient="from-rose-500 to-pink-500" onClick={() => requestMedicalRecords(selectedLead)} />
                  {isAdmin && (
                    <ActionBtn icon={<Trash2 className="w-4 h-4" />} label="Delete Lead" gradient="from-red-500 to-rose-500" onClick={() => deleteLead(selectedLead.id)} />
                  )}
                </div>
              </div>

              {/* Form History */}
              {(selectedLead.tcpaForms?.length > 0 || selectedLead.documentRequests?.length > 0) && (
                <>
                  <Separator className="bg-slate-100" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">History</h4>
                    <div className="space-y-1.5">
                      {selectedLead.tcpaForms?.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-medium text-slate-600">TCPA {f.formType}</span>
                          <Badge variant={f.isCompleted ? 'default' : 'outline'} className={`text-[10px] font-semibold ${f.isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-500'}`}>{f.isCompleted ? 'Completed' : 'Pending'}</Badge>
                        </div>
                      ))}
                      {selectedLead.documentRequests?.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-medium text-slate-600">Document Upload</span>
                          <Badge variant={d.isUsed ? 'default' : 'outline'} className={`text-[10px] font-semibold ${d.isUsed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-500'}`}>{d.isUsed ? 'Uploaded' : 'Pending'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Medical Records */}
              {medicalRecords.length > 0 && (
                <>
                  <Separator className="bg-slate-100" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><HeartPulse className="w-3.5 h-3.5 text-rose-500" /> Medical Records</h4>
                    <div className="space-y-1.5">
                      {medicalRecords.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 border border-rose-100">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className={`w-3.5 h-3.5 ${r.uploadedAt ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <span className="text-xs font-medium text-slate-700">{r.uploadedAt ? r.fileName : 'Pending upload'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.fileSize > 0 && <span className="text-[10px] text-slate-400">{(r.fileSize / 1024).toFixed(0)} KB</span>}
                            {r.uploadedAt && (
                              <a
                                href={`/api/medical-records/${r.id}/download`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:text-rose-900"
                                title="Download medical record"
                              >
                                <Download className="w-3 h-3" /> Download
                              </a>
                            )}
                            <Badge variant={r.uploadedAt ? 'default' : 'outline'} className={`text-[10px] font-semibold ${r.uploadedAt ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-500'}`}>{r.uploadedAt ? 'Received' : 'Waiting'}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

function DetailCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
      <div className={`mt-0.5 ${color} opacity-70`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm text-slate-800 font-semibold truncate">{value}</p>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, gradient, onClick }: { icon: React.ReactNode; label: string; gradient: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-white text-xs font-semibold bg-gradient-to-r ${gradient} shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]`}
    >
      {icon}
      {label}
    </button>
  )
}
