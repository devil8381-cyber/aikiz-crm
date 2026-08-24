'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import DripTaskQueue from '@/components/DripTaskQueue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, PhoneCall, Clock, CheckCircle2, AlertTriangle, PhoneOff,
  UserCheck, UserX, ArrowRight, Calendar, TrendingUp, Zap, Target, Activity, Wifi,
  PhoneOutgoing, Trophy, Flame, Award, ChevronRight
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string; pieColor: string }> = {
  New: { color: 'text-slate-600', bg: 'bg-slate-100', icon: Users, label: 'New', pieColor: '#94a3b8' },
  Interested: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: UserCheck, label: 'Interested', pieColor: '#10b981' },
  Signed: { color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle2, label: 'Signed', pieColor: '#14b8a6' },
  DNQ: { color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle, label: 'DNQ', pieColor: '#f59e0b' },
  'Not Interested': { color: 'text-red-600', bg: 'bg-red-50', icon: UserX, label: 'Not Int.', pieColor: '#ef4444' },
  Callback: { color: 'text-violet-600', bg: 'bg-violet-50', icon: Clock, label: 'Callback', pieColor: '#8b5cf6' },
  VM: { color: 'text-pink-600', bg: 'bg-pink-50', icon: PhoneOff, label: 'VM', pieColor: '#ec4899' },
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    let start = 0
    const duration = 600
    const step = Math.max(1, Math.floor(value / (duration / 16)))
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(start)
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}</span>
}

function StatCard({ icon: Icon, label, value, gradient, delay }: { icon: any; label: string; value: number; gradient: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      className={`relative overflow-hidden rounded-2xl p-5 text-white ${gradient} shadow-lg`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.1] rounded-full -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/[0.05] rounded-full translate-y-6 -translate-x-6" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.2] flex items-center justify-center backdrop-blur-sm"><Icon className="w-5 h-5" /></div>
          <TrendingUp className="w-4 h-4 text-white/[0.5]" />
        </div>
        <p className="text-3xl font-bold"><AnimatedNumber value={value} /></p>
        <p className="text-sm text-white/[0.8] mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const { data: session } = useSession()
  const user = session?.user as any
  const { setView, setSelectedLeadId, triggerRefresh, wsConnected, onlineAgents, todayCalls, setTodayCalls, dailyCallTarget, setDailyCallTarget } = useAppStore()
  const [stats, setStats] = useState<any>(null)
  const [callbacks, setCallbacks] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const firstLoadDone = useRef(false)

  const fetchDashboard = useCallback(async (showLoading: boolean) => {
    if (showLoading) { setLoading(true); setError('') }
    try {
      const [sRes, cRes, lbRes] = await Promise.all([
        fetch('/api/stats').catch(() => null),
        fetch('/api/callbacks?active=true').catch(() => null),
        fetch('/api/leaderboard').catch(() => null),
      ])
      if (sRes?.ok) { const d = await sRes.json(); setStats(d); setTodayCalls(d.todayCalls || 0); if (d.dailyCallTarget) setDailyCallTarget(d.dailyCallTarget) }
      if (cRes?.ok) setCallbacks(await cRes.json())
      if (lbRes?.ok) setLeaderboard((await lbRes.json()).leaderboard || [])
      if (showLoading && !sRes?.ok) setError('Failed to load stats')
    } catch (e: any) { if (showLoading) setError(e.message || 'Failed to load dashboard') }
    finally { setLoading(false) }
  }, [setTodayCalls, setDailyCallTarget])

  useEffect(() => { fetchDashboard(true) }, [fetchDashboard])

  useEffect(() => {
    if (!firstLoadDone.current) { firstLoadDone.current = true; return }
    fetchDashboard(false)
  }, [triggerRefresh, fetchDashboard])

  const todayCb = callbacks.filter((cb: any) => cb.callbackDate === new Date().toISOString().split('T')[0])
  const sb = stats?.statusBreakdown || {}
  const callPct = Math.min(100, Math.round((todayCalls / (dailyCallTarget || 50)) * 100))
  const targetReached = todayCalls >= (dailyCallTarget || 50)
  const remaining = Math.max(0, (dailyCallTarget || 50) - todayCalls)
  const totalLeads = stats?.totalLeads || 0
  const interested = sb['Interested'] || 0
  const signed = sb['Signed'] || 0
  const funnelData = [
    { stage: 'Total Leads', count: totalLeads, pct: 100, color: '#94a3b8' },
    { stage: 'Interested', count: interested, pct: totalLeads > 0 ? Math.round((interested / totalLeads) * 100) : 0, color: '#10b981' },
    { stage: 'Signed', count: signed, pct: totalLeads > 0 ? Math.round((signed / totalLeads) * 100) : 0, color: '#14b8a6' },
  ]
  const pieData = Object.entries(STATUS_CONFIG).map(([status, cfg]) => ({ name: cfg.label, value: sb[status] || 0, color: cfg.pieColor })).filter(d => d.value > 0)
  const barData = Object.entries(STATUS_CONFIG).map(([status, cfg]) => ({ name: cfg.label, count: sb[status] || 0, fill: cfg.pieColor }))

  if (error && !stats) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle className="w-10 h-10 text-amber-500" />
      <p className="text-slate-600 font-medium">Could not load analytics</p>
      <Button variant="outline" onClick={() => { setError(''); setView('dashboard') }}>Retry</Button>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  )

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back, <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">{user?.name || 'User'}</span>
          </h2>
          <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening with your leads today</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-teal-200 bg-teal-50 text-teal-700">
            <Zap className="w-3 h-3" /> Synced
          </Badge>
        </div>
      </motion.div>

      <AnimatePresence>
        {todayCb.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-1">
              <div className="bg-white rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><PhoneCall className="w-4 h-4 text-amber-600" /></div>
                  <div><h3 className="font-bold text-amber-900">Today&apos;s Callbacks</h3><p className="text-xs text-amber-600">{todayCb.length} pending</p></div>
                </div>
                <div className="space-y-2">
                  {todayCb.map((cb: any) => (
                    <div key={cb.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold">{cb.lead?.firstName?.[0]}{cb.lead?.lastName?.[0]}</div>
                        <div>
                          <p className="font-bold text-slate-900">Callback: <span className="text-orange-600">{cb.lead?.firstName} {cb.lead?.lastName}</span></p>
                          <p className="text-sm text-slate-500 mt-0.5">{cb.lead?.phone} &middot; {cb.callbackTime} {cb.ampm} ({cb.timezone?.split('/').pop()?.replace('_', ' ')})</p>
                        </div>
                      </div>
                      <Button size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md rounded-xl" onClick={() => { setSelectedLeadId(cb.lead?.id); setView('leads') }}>
                        Call Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DripTaskQueue />

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`relative overflow-hidden rounded-2xl p-1 ${targetReached ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500' : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600'}`}>
        <div className="bg-white rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${targetReached ? 'bg-gradient-to-br from-emerald-400 to-green-500' : 'bg-gradient-to-br from-indigo-500 to-violet-500'} shadow-lg`}>
                {targetReached ? <Trophy className="w-7 h-7 text-white" /> : <PhoneOutgoing className="w-7 h-7 text-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{targetReached ? 'Target Reached!' : 'Daily Call Target'}</h3>
                  {targetReached && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                </div>
                <p className="text-sm text-slate-500">{targetReached ? 'Amazing work!' : `${remaining} more calls to reach your daily goal`}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-4xl font-black tabular-nums ${targetReached ? 'text-emerald-600' : 'text-slate-900'}`}>{todayCalls}<span className="text-lg font-semibold text-slate-400">/{dailyCallTarget}</span></p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">calls today</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className={`h-3.5 rounded-full overflow-hidden ${targetReached ? 'bg-emerald-100' : 'bg-slate-100'}`}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${callPct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                className={`h-full rounded-full relative ${targetReached ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500' : callPct >= 80 ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500'}`}>
                {callPct >= 5 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-sm">{callPct}%</span>}
              </motion.div>
            </div>
          </div>
          {!targetReached && (<div className="flex items-center gap-2 mt-3">
            <Flame className={`w-4 h-4 ${callPct >= 80 ? 'text-orange-500' : callPct >= 50 ? 'text-amber-500' : 'text-indigo-400'}`} />
            <span className="text-xs font-semibold text-slate-500">{callPct === 0 && "Let's get started!"}{callPct > 0 && callPct < 25 && 'Great start!'}{callPct >= 25 && callPct < 50 && 'Building momentum!'}{callPct >= 50 && callPct < 75 && 'Halfway there!'}{callPct >= 75 && 'Almost there!'}</span>
          </div>)}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-teal-600" /><h3 className="font-bold text-slate-800">Conversion Funnel</h3></div>
          <div className="space-y-3">
            {funnelData.map((item, i) => (
              <div key={item.stage} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700">{item.stage}</span>
                  <div className="flex items-center gap-2"><span className="text-sm font-black text-slate-900">{item.count}</span><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.pct}%</span></div>
                </div>
                <div className="h-8 rounded-xl bg-slate-100 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }} className="h-full rounded-xl" style={{ backgroundColor: item.color }} />
                </div>
                {i < funnelData.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-auto my-0.5" />}
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><Award className="w-4 h-4 text-amber-500" /><h3 className="font-bold text-slate-800">Agent Leaderboard</h3><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-auto">Today</span></div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {leaderboard.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">No data yet</p> : leaderboard.map((a: any, i: number) => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? 'bg-amber-50 border-amber-200' : i === 1 ? 'bg-slate-50 border-slate-100' : 'border-slate-50 hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="text-sm font-bold text-slate-800 truncate">{a.name}</p>{i === 0 && <Trophy className="w-3.5 h-3.5 text-amber-500" />}</div>
                  <p className="text-[10px] text-slate-400">{a.totalLeads} leads &middot; {a.signed} signed &middot; {a.conversionRate}% conv.</p>
                </div>
                <div className="text-right shrink-0"><p className="text-lg font-black tabular-nums text-slate-900">{a.todayCalls}</p><p className="text-[10px] text-slate-400">calls</p></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={totalLeads} gradient="bg-gradient-to-br from-teal-500 to-teal-700" delay={0} />
        <StatCard icon={PhoneOutgoing} label="Today's Calls" value={todayCalls} gradient="bg-gradient-to-br from-indigo-500 to-violet-700" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Signed Deals" value={signed} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" delay={0.2} />
        <StatCard icon={Calendar} label="Today's Leads" value={stats?.todayLeads || 0} gradient="bg-gradient-to-br from-amber-500 to-orange-600" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-teal-600" /><h3 className="font-bold text-slate-800">Status Distribution</h3></div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>{pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-12">No data yet</p>}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => { const count = sb[status] || 0; if (count === 0) return null; return (<div key={status} className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.pieColor }} /><span className="text-slate-600">{cfg.label}</span><span className="font-bold text-slate-800 ml-auto">{count}</span></div>) })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-teal-600" /><h3 className="font-bold text-slate-800">Leads by Status</h3></div>
          <ResponsiveContainer width="100%" height={240}><BarChart data={barData} barSize={28}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{barData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-teal-600" /><h3 className="font-bold text-slate-800">Quick Status</h3></div>
          <div className="space-y-2.5">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const Icon = cfg.icon; const count = sb[status] || 0; const total = totalLeads || 1; const pct = Math.round((count / total) * 100)
              return (
                <button key={status} onClick={() => setView('leads')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all group text-left">
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}><Icon className={`w-4 h-4 ${cfg.color}`} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold text-slate-700">{cfg.label}</span><span className="text-sm font-bold text-slate-900">{count}</span></div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: cfg.pieColor }} /></div>
                  </div>
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-violet-600" /><h3 className="font-bold text-slate-800">Upcoming Callbacks</h3></div>
          <Badge variant="outline" className="text-xs border-violet-200 text-violet-700 bg-violet-50">{callbacks.length} pending</Badge>
        </div>
        {callbacks.length === 0 ? (
          <div className="text-center py-8"><PhoneCall className="w-10 h-10 text-slate-200 mx-auto mb-2" /><p className="text-slate-400 text-sm">No pending callbacks</p></div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {callbacks.slice(0, 10).map((cb: any, i: number) => (
              <motion.div key={cb.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-violet-50 to-slate-50 hover:from-violet-100 hover:to-slate-100 transition-all cursor-pointer group"
                onClick={() => { setSelectedLeadId(cb.lead?.id); setView('leads') }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-violet-500/25">{cb.lead?.firstName?.[0]}{cb.lead?.lastName?.[0]}</div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800 group-hover:text-violet-700 transition-colors">{cb.lead?.firstName} {cb.lead?.lastName}</p>
                    <p className="text-xs text-slate-400">{cb.callbackDate} at {cb.callbackTime} {cb.ampm} &middot; {cb.timezone?.split('/').pop()?.replace('_', ' ')}</p>
                  </div>
                </div>
                <Badge className="bg-white/80 text-xs text-violet-700 border border-violet-100 shadow-sm">{cb.lead?.caseType}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}