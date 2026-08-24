'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, FileText, CheckCircle2, AlertCircle, Shield, HeartPulse } from 'lucide-react'

export default function ClaimantPortal({ token, mode }: { token: string; mode: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const url = mode === 'medical'
      ? `/api/medical-records/claimant?token=${token}`
      : `/api/claimant?token=${token}&mode=${mode}`
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Invalid or expired link')
        return r.json()
      })
      .then(d => { setData(d); if (d.hasUpload) setSubmitted(true) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, mode])

  const uploadMedicalRecord = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/medical-records/claimant?token=${token}`, { method: 'PATCH', body: formData })
      if (res.ok) {
        setSubmitted(true)
        toast.success('Medical records uploaded successfully!')
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  const uploadDoc = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('token', token)
      formData.append('file', file)
      const res = await fetch('/api/documents', { method: 'PATCH', body: formData })
      if (res.ok) {
        setSubmitted(true)
        toast.success('Document uploaded successfully!')
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  const submitTcpa = async () => {
    try {
      const res = await fetch('/api/claimant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mode, formData: {} }),
      })
      if (res.ok) {
        setSubmitted(true)
        toast.success('Form submitted successfully!')
      }
    } catch (e) { toast.error('Submission failed') }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full border-red-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Link Invalid</h2>
          <p className="text-slate-500">{error}</p>
        </CardContent>
      </Card>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full border-emerald-200">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Submitted Successfully!</h2>
          <p className="text-slate-500">Thank you. Your {mode === 'medical' ? 'medical records have been uploaded' : mode === 'tcpa' ? 'form has been submitted' : 'document has been uploaded'}. Our team will review it.</p>
        </CardContent>
      </Card>
    </div>
  )

  const claimant = data?.claimant || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 mb-4 shadow-lg shadow-slate-900/20">
            <Image src="/matthews-associates-logo.png" alt="Matthews & Associates" width={680} height={140} priority className="w-64 h-auto" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Records Retrieval &amp; Billing Team</h1>
          <p className="text-slate-500 text-xs mt-1">Secure {mode === 'medical' ? 'Medical Records Upload' : mode === 'tcpa' ? `TCPA ${data?.formType} Form` : 'Document Upload'} Portal</p>
        </div>

        {/* Claimant Info */}
        <Card className="border-slate-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" /> Request Details
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] text-slate-400 uppercase">Name</p><p className="font-medium text-slate-800">{claimant.firstName} {claimant.lastName}</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase">Case Type</p><p className="font-medium text-slate-800">{claimant.caseType || '-'}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* TCPA Form Placeholder */}
        {mode === 'tcpa' && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-800">TCPA {data?.formType} - Deposition Form</h3>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">Your TCPA deposition form will be displayed here. The actual form fields will be configured by your administrator. For now, click submit to confirm.</p>
              </div>
              <p className="text-xs text-slate-400 mb-4">By submitting, you confirm that the information above is accurate.</p>
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={submitTcpa}>
                Submit TCPA {data?.formType} Form
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Medical Records Upload */}
        {mode === 'medical' && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <HeartPulse className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-slate-800">Upload Medical Records</h3>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-rose-800">This secure portal is operated by Matthews &amp; Associates and hosted on Netlify&apos;s platform. Please upload only the records requested by your case manager. Accepted formats: PDF, JPG, PNG, DOC, DOCX (max 10MB).</p>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-rose-400 transition-colors mb-4">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-2">Select your medical records</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />
                {file && <p className="text-xs text-slate-500 mt-2">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
              </div>
              <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" onClick={uploadMedicalRecord} disabled={!file || uploading}>
                <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload Medical Records'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Document Upload */}
        {mode === 'docs' && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-800">Upload Supporting Documents</h3>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">This is a <strong>one-time use</strong> secure link. You can only upload once, so please ensure all documents are ready.</p>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors mb-4">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-2">Select your documents</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={uploadDoc} disabled={!file || uploading}>
                <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">&copy; {new Date().getFullYear()} Matthews &amp; Associates. All rights reserved.</p>
      </div>
    </div>
  )
}
