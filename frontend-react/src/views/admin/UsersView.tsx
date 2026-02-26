import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, PaginatedResponse } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

export default function UsersView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const loadUsers = useCallback(async (currentPage: number, searchTerm: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const filters: { status?: 'active' | 'disabled'; role?: 'admin' | 'user'; search?: string } = {}
      if (roleFilter !== 'all') filters.role = roleFilter
      if (statusFilter !== 'all') filters.status = statusFilter
      if (searchTerm.trim()) filters.search = searchTerm.trim()
      const res: PaginatedResponse<AdminUser> = await adminAPI.users.list(currentPage, PAGE_SIZE, filters, { signal: controller.signal })
      setUsers(res.items)
      setTotalPages(res.pages)
      setTotal(res.total)
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') showError(t('Failed to load users'))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, statusFilter, showError, t])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); loadUsers(1, value) }, 300)
  }, [loadUsers])

  useEffect(() => {
    loadUsers(page, search)
    return () => { abortRef.current?.abort() }
  }, [page, roleFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => loadUsers(page, search)

  const createForm = useForm({
    defaultValues: { email: '', password: '', balance: 0, concurrency: 1 },
    onSubmit: async ({ value }) => {
      if (!value.email || !value.password) {
        showError(t('Email and password are required'))
        return
      }
      try {
        await adminAPI.users.create(value)
        showSuccess(t('User created successfully'))
        setShowCreateDialog(false)
        createForm.reset()
        refresh()
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('Failed to create user'))
      }
    },
  })

  const editForm = useForm({
    defaultValues: { balance: 0, concurrency: 1, role: 'user' as 'admin' | 'user', status: 'active' as 'active' | 'disabled', notes: '' },
    onSubmit: async ({ value }) => {
      if (!selectedUser) return
      try {
        await adminAPI.users.update(selectedUser.id, value)
        showSuccess(t('User updated successfully'))
        setShowEditDialog(false)
        setSelectedUser(null)
        refresh()
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('Failed to update user'))
      }
    },
  })

  const { Field: CreateForm_Field } = createForm
  const { Field: EditForm_Field } = editForm

  const openEdit = (user: AdminUser) => {
    setSelectedUser(user)
    editForm.reset({
      balance: user.balance,
      concurrency: user.concurrency,
      role: user.role,
      status: user.status,
      notes: user.notes || '',
    })
    setShowEditDialog(true)
  }

  const handleToggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    try {
      await adminAPI.users.toggleStatus(user.id, newStatus)
      showSuccess(t('User status updated'))
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to toggle status'))
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return
    try {
      await adminAPI.users.delete(selectedUser.id)
      showSuccess(t('User deleted successfully'))
      setShowDeleteDialog(false)
      setSelectedUser(null)
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to delete user'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('User Management')} <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="mr-2 h-4 w-4" />{t('Create User')}
          </Button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder={t('Search by email...')} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Roles')}</SelectItem>
              <SelectItem value="admin">{t('Admin')}</SelectItem>
              <SelectItem value="user">{t('User')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="disabled">{t('Disabled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('No users found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400">
                  <th className="px-4 py-3">{t('Email')}</th>
                  <th className="px-4 py-3">{t('Role')}</th>
                  <th className="px-4 py-3">{t('Balance')}</th>
                  <th className="px-4 py-3">{t('Concurrency')}</th>
                  <th className="px-4 py-3">{t('Status')}</th>
                  <th className="px-4 py-3">{t('Created')}</th>
                  <th className="px-4 py-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>{user.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">${user.balance.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.current_concurrency !== undefined ? `${user.current_concurrency}/${user.concurrency}` : user.concurrency}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{user.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>{t('Edit')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)}>{user.status === 'active' ? t('Disable') : t('Enable')}</Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setSelectedUser(user); setShowDeleteDialog(true) }}><TrashIcon className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('Page')} {page} / {totalPages} ({total} {t('total')})</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('Previous')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t('Next')}</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('Create User')}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createForm.handleSubmit() }} className="space-y-5 py-2">
            <CreateForm_Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Email')} *</Label>
                  <Input type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="user@example.com" />
                </div>
              )}
            </CreateForm_Field>
            <CreateForm_Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Password')} *</Label>
                  <Input type="password" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </CreateForm_Field>
            <div className="grid grid-cols-2 gap-5">
              <CreateForm_Field name="balance">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Balance')} ($)</Label>
                    <Input type="number" step="0.01" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </CreateForm_Field>
              <CreateForm_Field name="concurrency">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Concurrency')}</Label>
                    <Input type="number" min={1} value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </CreateForm_Field>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={createForm.state.isSubmitting}>{t('Cancel')}</Button>
            <Button onClick={() => createForm.handleSubmit()} disabled={createForm.state.isSubmitting}>
              {createForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('Edit User')} - {selectedUser?.email}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editForm.handleSubmit() }} className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <EditForm_Field name="balance">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Balance')} ($)</Label>
                    <Input type="number" step="0.01" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </EditForm_Field>
              <EditForm_Field name="concurrency">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Concurrency')}</Label>
                    <Input type="number" min={1} value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </EditForm_Field>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <EditForm_Field name="role">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Role')}</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'admin' | 'user')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('User')}</SelectItem>
                        <SelectItem value="admin">{t('Admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
              <EditForm_Field name="status">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Status')}</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'active' | 'disabled')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('Active')}</SelectItem>
                        <SelectItem value="disabled">{t('Disabled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
            </div>
            <EditForm_Field name="notes">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Notes')}</Label>
                  <Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={3} />
                </div>
              )}
            </EditForm_Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={editForm.state.isSubmitting}>{t('Cancel')}</Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={editForm.state.isSubmitting}>
              {editForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete User')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete user')} <strong>{selectedUser?.email}</strong>? {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
