'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, UserRound, ListChecks, X } from 'lucide-react'

// Target lead fields the CSV columns can be mapped to (kept in sync with the upload API)
const TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zipCode', label: 'Zip Code' },
  { key: 'ssnLast4', label: 'SSN (Last 4)' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'caseType', label: 'Case Type' },
  { key: 'claimNumber', label: 'Claim Number' },
  { key: 'dateOfIncident', label: 'Date of Incident' },
  { key: 'claimAmount', label: 'Claim Amount' },
  { key: 'attorneyName', label: 'Attorney Name' },
  { key: 'insuranceCarrier', label: 'Insurance Carrier' },
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'incidentDescription', label: 'Incident Description' },
  { key: 'notes', label: 'Notes' },
]

const ALIASES: Record<string, string[]> = {
  firstName: ['firstname', 'first_name', 'first'],
  lastName: ['lastname', 'last_name', 'last'],
  phone: ['phone', 'phonenumber', 'phone_number', 'mobile'],
  email: ['email'],
  address: ['address'],
  city: ['city'],
  state: ['state'],
  zipCode: ['zipcode', 'zip', 'zip_code'],
  ssnLast4: ['ssnlast4', 'ssn_last4', 'ssn'],
  dateOfBirth: ['dateofbirth', 'dob', 'date_of_birth'],
  caseType: ['casetype', 'case_type'],
  claimNumber: ['claimnumber', 'claim_number'],
  dateOfIncident: ['dateofincident', 'date_of_incident'],
  claimAmount: ['claimamount', 'claim_amount'],
  attorneyName: ['attorneyname', 'attorney_name'],
  insuranceCarrier: ['insurancecarrier', 'insurance_carrier'],
  policyNumber: ['policynumber', 'policy_number'],
  incidentDescription: ['incidentdescription', 'incident_description'],
  notes: ['notes'],
}

const UNMAPPED = '__unmapped__'
const UNASSIGNED = '__unassigned__'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { result.push(current); current = '' }
      else { current += ch }
    }
  }
  result.push(current)
  return result.map(v => v.trim())
}

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const [users, setUsers] = useState<any[]>([])
  const [assignedToId, setAssignedToId] = useState<string>(UNASSIGNED)

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data.filter((u: any) => u.isActive !== false) : []))
      .catch(() => {})
  }, [])

  const resetFileState = () => {
    setFile(null)
    setCsvHeaders([])
    setRowCount(0)
    setMapping({})
  }

  const handleFileChange = async (f: File | null) => {
    setResult(null)
    if (!f) { resetFileState(); return }
    setFile(f)
    try {
      const text = await f.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (!lines.length) { setCsvHeaders([]); setRowCount(0); return }
      const headers = parseCSVLine(lines[0])
      setCsvHeaders(headers)
      setRowCount(Math.max(lines.length - 1, 0))

      // Auto-detect best-guess mapping so the admin doesn't have to map everything by hand
      const lowerHeaders = headers.map(h => h.toLowerCase())
      const auto: Record<string, string> = {}
      for (const field of TARGET_FIELDS) {
        const aliases = ALIASES[field.key] || [field.key.toLowerCase()]
        const idx = lowerHeaders.findIndex(h => aliases.includes(h))
        if (idx !== -1) auto[field.key] = headers[idx]
      }
      setMapping(auto)
    } catch {
      toast.error('Could not read that file')
      resetFileState()
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (assignedToId !== UNASSIGNED) formData.append('assignedToId', assignedToId)
      // Only send fields the admin actually mapped to a real column
      const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v && v !== UNMAPPED))
      if (Object.keys(cleanMapping).length) formData.append('mapping', JSON.stringify(cleanMapping))

      const res = await fetch('/api/leads/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Upload failed'); return }
      setResult(data)
      if (data.created > 0) toast.success(`${data.created} leads imported${data.assignedTo ? ` and assigned to ${data.assignedTo}` : ''}!`)
      if (data.errors > 0) toast.warning(`${data.errors} rows had errors`)
    } catch (e) { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Upload Lead Data</h2>
        <p className="text-slate-500 text-sm mt-1">Import leads from a CSV file</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-teal-400 transition-colors">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-1">Drop your CSV file here or click to browse</p>
            <p className="text-xs text-slate-400 mb-4">Supports columns: firstName, lastName, phone, email, city, state, caseType, claimNumber, etc.</p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={e => handleFileChange(e.target.files?.[0] || null)}
              className="block mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
            />
            {file && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="text-sm text-slate-600">{file.name} ({(file.size / 1024).toFixed(1)} KB) · {rowCount} rows</span>
                <button
                  onClick={resetFileState}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {result && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div><p className="text-lg font-bold text-emerald-700">{result.created}</p><p className="text-xs text-emerald-600">Created</p></div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div><p className="text-lg font-bold text-red-700">{result.errors}</p><p className="text-xs text-red-600">Errors</p></div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-slate-600" />
                <div><p className="text-lg font-bold text-slate-700">{result.total}</p><p className="text-xs text-slate-600">Total Rows</p></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {file && csvHeaders.length > 0 && (
        <>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <UserRound className="w-4 h-4 text-teal-600" /> Assign Leads To
              </CardTitle>
              <p className="text-xs text-slate-500">Every lead created from this file will be assigned to the selected agent. Leave unassigned to import without an owner.</p>
            </CardHeader>
            <CardContent>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Leave unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.role === 'ADMIN' ? '(Admin)' : ''} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <ListChecks className="w-4 h-4 text-teal-600" /> Map CSV Columns
              </CardTitle>
              <p className="text-xs text-slate-500">Choose which column from your file fills each lead field. Columns were auto-matched where possible — adjust as needed.</p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {TARGET_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-slate-600 shrink-0 w-40">{field.label}</label>
                    <Select
                      value={mapping[field.key] || UNMAPPED}
                      onValueChange={val => setMapping(prev => ({ ...prev, [field.key]: val }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleUpload} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : `Upload ${rowCount} Leads`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Supported CSV Columns</h4>
        <div className="flex flex-wrap gap-1.5">
          {TARGET_FIELDS.map(col => (
            <span key={col.key} className="text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">{col.key}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
