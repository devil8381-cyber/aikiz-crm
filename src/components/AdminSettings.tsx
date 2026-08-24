'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  Settings, PhoneOutgoing, Save, RotateCcw, Target, Mail, CheckCircle,
  AlertTriangle, Send, Server, Eye, EyeOff, ShieldCheck, Loader2
} from 'lucide-react'

export default function AdminSettings() {
  const { dailyCallTarget, setDailyCallTarget } = useAppStore()
  const [targetInput, setTargetInput] = useState(String(dailyCallTarget))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [showConsentPass, setShowConsentPass] = useState(false)
  const [showClaimsPass, setShowClaimsPass] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const [smtp, setSmtp] = useState({
    smtp_host: '', smtp_port: '465', smtp_secure: true,
    smtp_from_name: 'Matthews & Associates',
    smtp_consent_user: '', smtp_consent_pass: '',
    smtp_claims_user: '', smtp_claims_pass: '',
    smtp_consent_pass_set: false, smtp_claims_pass_set: false, configured: false,
  })

  useEffect(() => { ;(async () => {
    try {
      const [sRes, smRes] = await Promise.all([fetch('/api/settings'), fetch('/api/smtp')])
      if (sRes.ok) { const d = await sRes.json(); setDailyCallTarget(d.dailyCallTarget); setTargetInput(String(d.dailyCallTarget)) }
      if (smRes.ok) { const d = await smRes.json(); setSmtp(prev => ({ ...prev, ...d })) }
    } catch {}
    finally { setLoading(false) }
  })() }, [])

  const saveTarget = async () => {
    const val = parseInt(targetInput, 10)
    if (isNaN(val) || val < 1 || val > 999) { toast.error('Target must be 1-999'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyCallTarget: val }) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      setDailyCallTarget(val); toast.success(`Daily target set to ${val}`)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const saveSmtp = async () => {
    setSmtpSaving(true)
    try {
      const payload: any = { ...smtp }
      if (!payload.smtp_consent_pass) delete payload.smtp_consent_pass
      if (!payload.smtp_claims_pass) delete payload.smtp_claims_pass
      delete payload.smtp_consent_pass_set; delete payload.smtp_claims_pass_set; delete payload.configured
      const res = await fetch('/api/smtp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success('SMTP settings saved')
      fetch('/api/smtp').then(r => r.ok && r.json().then(d => setSmtp(prev => ({ ...prev, ...d }))))
    } catch { toast.error('Failed to save SMTP') }
    finally { setSmtpSaving(false) }
  }

  const testSmtp = async () => {
    setSmtpTesting(true)
    try {
      const res = await fetch('/api/smtp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testEmail }) })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Test failed'); return }
      toast.success(d.message || 'Test email sent!')
    } catch { toast.error('Test failed') }
    finally { setSmtpTesting(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg"><Settings className="w-5 h-5 text-white" /></div>
          <div><h2 className="text-2xl font-bold text-slate-900">Admin Settings</h2><p className="text-slate-500 text-sm mt-0.5">System configuration & SMTP setup</p></div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Target */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md"><Target className="w-5 h-5 text-white" /></div>
              <div><h3 className="font-bold text-slate-900">Daily Call Target</h3><p className="text-xs text-slate-500">Compulsory daily call target for agents</p></div>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3"><PhoneOutgoing className="w-5 h-5 text-indigo-500" /><div><p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Target</p><p className="text-2xl font-black text-slate-900 tabular-nums">{dailyCallTarget} <span className="text-sm font-medium text-slate-400">calls/day</span></p></div></div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">New Target</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1"><PhoneOutgoing className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input type="number" min={1} max={999} value={targetInput} onChange={e => setTargetInput(e.target.value)} className="pl-10 h-12 text-lg font-bold rounded-xl border-slate-200 focus-visible:ring-indigo-500/25 tabular-nums" placeholder="1-999" /></div>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => setTargetInput('50')}><RotateCcw className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'Light', v: 30 }, { l: 'Standard', v: 50 }, { l: 'High', v: 75 }, { l: 'Aggressive', v: 100 }, { l: 'Power', v: 150 }, { l: 'Elite', v: 200 }].map(p => (
                <button key={p.l} onClick={() => setTargetInput(String(p.v))} className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl border-2 transition-all ${targetInput === String(p.v) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <span className="text-xs font-bold">{p.l}</span><span className="text-[10px] text-slate-400">{p.v}</span>
                </button>
              ))}
            </div>
            <Button className="w-full h-11 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50" disabled={saving || targetInput === String(dailyCallTarget)} onClick={saveTarget}>
              {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save: {targetInput} Calls</>}
            </Button>
          </div>
        </motion.div>

        {/* SMTP Configuration */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className={`p-5 border-b ${smtp.configured ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${smtp.configured ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-amber-500 to-orange-500'}`}>
                <Server className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">SMTP Configuration</h3>
                <p className="text-xs text-slate-500">Email server settings for sending emails</p>
              </div>
              {smtp.configured ? <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" /> : <AlertTriangle className="w-5 h-5 text-amber-500 ml-auto" />}
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-slate-500">SMTP Host</Label><Input value={smtp.smtp_host} onChange={e => setSmtp(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.hostinger.com" className="mt-1 h-10 rounded-xl text-sm" /></div>
              <div><Label className="text-xs text-slate-500">Port</Label><Input value={smtp.smtp_port} onChange={e => setSmtp(p => ({ ...p, smtp_port: e.target.value }))} placeholder="465" className="mt-1 h-10 rounded-xl text-sm" /></div>
            </div>
            <div><Label className="text-xs text-slate-500">From Name</Label><Input value={smtp.smtp_from_name} onChange={e => setSmtp(p => ({ ...p, smtp_from_name: e.target.value }))} placeholder="Matthews & Associates" className="mt-1 h-10 rounded-xl text-sm" /></div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-violet-600" /><p className="text-sm font-semibold text-slate-800">Consent Account (TCPA emails)</p></div>
              <div className="space-y-2">
                <Input value={smtp.smtp_consent_user} onChange={e => setSmtp(p => ({ ...p, smtp_consent_user: e.target.value }))} placeholder="consent@yourdomain.com" className="h-10 rounded-xl text-sm" />
                <div className="relative">
                  <Input type={showConsentPass ? 'text' : 'password'} value={smtp.smtp_consent_pass} onChange={e => setSmtp(p => ({ ...p, smtp_consent_pass: e.target.value }))} placeholder={smtp.smtp_consent_pass_set ? 'Already set - leave blank to keep' : 'Password'} className="h-10 rounded-xl text-sm pr-10" />
                  <button type="button" onClick={() => setShowConsentPass(!showConsentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showConsentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3"><Mail className="w-4 h-4 text-blue-600" /><p className="text-sm font-semibold text-slate-800">Claims Account (Follow-up, Docs)</p></div>
              <div className="space-y-2">
                <Input value={smtp.smtp_claims_user} onChange={e => setSmtp(p => ({ ...p, smtp_claims_user: e.target.value }))} placeholder="claims@yourdomain.com" className="h-10 rounded-xl text-sm" />
                <div className="relative">
                  <Input type={showClaimsPass ? 'text' : 'password'} value={smtp.smtp_claims_pass} onChange={e => setSmtp(p => ({ ...p, smtp_claims_pass: e.target.value }))} placeholder={smtp.smtp_claims_pass_set ? 'Already set - leave blank to keep' : 'Password'} className="h-10 rounded-xl text-sm pr-10" />
                  <button type="button" onClick={() => setShowClaimsPass(!showClaimsPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showClaimsPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 h-11 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white rounded-xl font-semibold disabled:opacity-50" disabled={smtpSaving} onClick={saveSmtp}>
                {smtpSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
              </Button>
            </div>

            {/* Test Email */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">Send Test Email</p>
              <div className="flex gap-2">
                <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="h-10 flex-1 rounded-xl text-sm" />
                <Button className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold disabled:opacity-50" disabled={smtpTesting || !testEmail} onClick={testSmtp}>
                  {smtpTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Test</>}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Sends a test email using your Consent account SMTP settings.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
