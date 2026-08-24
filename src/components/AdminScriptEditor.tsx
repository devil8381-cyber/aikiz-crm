'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Save, FileText } from 'lucide-react'

export default function AdminScriptEditor() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/script')
      .then(r => r.json())
      .then(data => { setTitle(data.title || ''); setContent(data.content || '') })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveScript = async () => {
    setSaving(true)
    try {
      await fetch('/api/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      toast.success('Script saved successfully')
    } catch (e) { toast.error('Failed to save script') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Script Editor</h2>
          <p className="text-slate-500 text-sm mt-1">Edit the calling script that agents see in the floating panel</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={saveScript} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Script'}
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Script Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Main Calling Script" />
          </div>
          <div className="space-y-1.5">
            <Label>Script Content (Markdown supported)</Label>
            <p className="text-xs text-slate-400">Use # for headings, - for lists, &quot;...&quot; for scripted dialogue</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[500px] p-4 rounded-lg border border-slate-200 font-mono text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
              placeholder="Write your calling script here..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}