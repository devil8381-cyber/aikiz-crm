'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2, Shield, Users } from 'lucide-react'

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      setUsers(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const createUser = async () => {
    try {
      await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast.success('User created successfully')
      setShowCreate(false)
      setForm({ name: '', email: '', password: '', role: 'AGENT' })
      fetchUsers()
    } catch (e) { toast.error('Failed to create user') }
  }

  const updateUser = async () => {
    if (!editUser) return
    try {
      const body: any = { name: form.name, email: form.email, role: form.role }
      if (form.password) body.password = form.password
      await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      toast.success('User updated')
      setEditUser(null)
      fetchUsers()
    } catch (e) { toast.error('Failed to update user') }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' })
      toast.success('User deleted')
      fetchUsers()
    } catch (e) { toast.error('Failed to delete user') }
  }

  const openEdit = (u: any) => {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage agents and administrators</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setForm({ name: '', email: '', password: '', role: 'AGENT' }); setShowCreate(true) }}>
          <UserPlus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Leads</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400"><div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'ADMIN' ? 'default' : 'outline'} className={u.role === 'ADMIN' ? 'bg-teal-600 text-white' : ''}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u._count?.leads || 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'default' : 'secondary'} className={u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteUser(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editUser} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditUser(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@matthewsassoc.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{editUser ? 'New Password (leave blank to keep)' : 'Password'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editUser ? 'Leave blank to keep current' : 'password123'} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENT">Agent</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={editUser ? updateUser : createUser}>
              {editUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}