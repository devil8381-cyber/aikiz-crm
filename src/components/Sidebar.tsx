'use client'

import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Users, FileText, Upload, Activity, Phone, LogOut,
  ChevronLeft, ChevronRight, Shield, ScrollText, Headphones, MessageSquare, Settings, Mail
} from 'lucide-react'

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'AGENT'], accent: 'bg-teal-500' },
  { id: 'leads' as const, label: 'Leads', icon: Users, roles: ['ADMIN', 'AGENT'], accent: 'bg-blue-500' },
  { id: 'admin-users' as const, label: 'Users', icon: Shield, roles: ['ADMIN'], accent: 'bg-amber-500' },
  { id: 'admin-script' as const, label: 'Script Editor', icon: FileText, roles: ['ADMIN'], accent: 'bg-emerald-500' },
  { id: 'admin-upload' as const, label: 'Upload Data', icon: Upload, roles: ['ADMIN'], accent: 'bg-violet-500' },
  { id: 'admin-activity' as const, label: 'Activity Logs', icon: Activity, roles: ['ADMIN'], accent: 'bg-rose-500' },
  { id: 'admin-sms' as const, label: 'SMS Templates', icon: MessageSquare, roles: ['ADMIN'], accent: 'bg-sky-500' },
  { id: 'admin-email' as const, label: 'Email Templates', icon: Mail, roles: ['ADMIN'], accent: 'bg-violet-500' },
  { id: 'admin-settings' as const, label: 'Settings', icon: Settings, roles: ['ADMIN'], accent: 'bg-slate-500' },
]
export default function Sidebar() {
  const { data: session } = useSession()
  const user = session?.user as any
  const { view, setView, sidebarCollapsed, setSidebarCollapsed, scriptOpen, setScriptOpen } = useAppStore()
  const isAdmin = user?.role === 'ADMIN'

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role || ''))

  return (
    <div
      className={sidebarCollapsed ? 'w-16 h-full flex flex-col bg-slate-900 text-white' : 'w-60 h-full flex flex-col bg-slate-900 text-white'}
      style={{ transition: 'width 300ms' }}
    >
      <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-700 min-h-[58px]">
        <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0"><Phone className="w-4 h-4 text-white" /></div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <Image src="/matthews-associates-logo.png" alt="Matthews & Associates" width={680} height={140} className="w-40 h-auto" />
            <p className="text-slate-400 text-[10px] mt-1">Records Retrieval &amp; Billing Team</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              ].join(' ')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {active && !sidebarCollapsed && (
                <span className="ml-auto text-[10px] font-bold text-teal-300">●</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-2 pb-2">
        <button
          onClick={() => setScriptOpen(!scriptOpen)}
          className={[
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            scriptOpen
              ? 'text-teal-400 bg-teal-900'
              : 'text-slate-500 hover:bg-slate-800 hover:text-white',
          ].join(' ')}
          title={sidebarCollapsed ? 'Toggle Script' : undefined}
        >
          <ScrollText className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Script Panel</span>}
        </button>
      </div>

      <div className="px-3 py-3 border-t border-slate-700">
        {!sidebarCollapsed && (
          <div className="mb-2 px-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-900 text-teal-400">
              {user?.role || 'AGENT'}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!sidebarCollapsed && 'Sign Out'}
        </Button>
      </div>

      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-8 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-teal-600 hover:text-white transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </div>
  )
}
