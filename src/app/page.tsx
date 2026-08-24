'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import LoginForm from '@/components/LoginForm'
import Sidebar from '@/components/Sidebar'
import TimezoneBar from '@/components/TimezoneBar'
import Dashboard from '@/components/Dashboard'
import LeadsTable from '@/components/LeadsTable'
import FloatingScript from '@/components/FloatingScript'
import AdminUsers from '@/components/AdminUsers'
import AdminScriptEditor from '@/components/AdminScriptEditor'
import AdminUpload from '@/components/AdminUpload'
import AdminActivity from '@/components/AdminActivity'
import AdminSmsTemplates from '@/components/AdminSmsTemplates'
import AdminSettings from '@/components/AdminSettings'
import AdminEmailTemplates from '@/components/AdminEmailTemplates'
import ClaimantPortal from '@/components/ClaimantPortal'

function useClaimantParams() {
  // Parse URL params synchronously (no state needed - URL is static per page load)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  if (!params) return null
  const token = params.get('token')
  const mode = params.get('mode')
  if (token && (mode === 'tcpa' || mode === 'docs' || mode === 'medical')) {
    return { token, mode }
  }
  return null
}

function AppContent() {
  const { data: session, status } = useSession()
  const { view, scriptOpen } = useAppStore()
  const claimantParams = useClaimantParams()

  // Initialize DB on first load
  useEffect(() => {
    fetch('/api/init', { method: 'POST' }).catch(() => {})
  }, [])

  // Claimant portal (no auth needed)
  if (claimantParams) {
    return <ClaimantPortal token={claimantParams.token} mode={claimantParams.mode} />
  }

  // Auth loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Login
  if (!session) return <LoginForm />

  // Main App
  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />
      case 'leads': return <LeadsTable />
      case 'admin-users': return <AdminUsers />
      case 'admin-script': return <AdminScriptEditor />
      case 'admin-upload': return <AdminUpload />
      case 'admin-activity': return <AdminActivity />
      case 'admin-sms': return <AdminSmsTemplates />
      case 'admin-email': return <AdminEmailTemplates />
      case 'admin-settings': return <AdminSettings />
      default: return <Dashboard />
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TimezoneBar />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {renderView()}
        </main>
      </div>
      {scriptOpen && <FloatingScript />}
    </div>
  )
}

export default function Home() {
  return <AppContent />
}
