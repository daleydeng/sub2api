import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  Account,
  AccountPlatform,
  AccountType,
  PaginatedResponse,
  CreateAccountRequest,
  UpdateAccountRequest,
  Group,
} from '@/types'
import { PlusIcon, TrashIcon, SearchIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ==================== Constants ====================

const PAGE_SIZE = 20

const PLATFORMS: { value: AccountPlatform; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'sora', label: 'Sora' },
]

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'oauth', label: 'OAuth' },
  { value: 'setup-token', label: 'Setup Token' },
  { value: 'apikey', label: 'API Key' },
  { value: 'upstream', label: 'Upstream' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'error', label: 'Error' },
]

const defaultCreateValues = {
  platform: 'anthropic' as AccountPlatform,
  type: 'oauth' as AccountType,
  name: '',
  credentials: '{}',
}

const defaultEditValues = {
  name: '',
  status: 'active',
  schedulable: true,
  priority: 0,
  notes: '',
}

// ==================== Helpers ====================

function platformBadgeClass(platform: string): string {
  const map: Record<string, string> = {
    anthropic: 'badge-purple',
    openai: 'badge-success',
    gemini: 'badge-primary',
    antigravity: 'badge-warning',
    sora: 'badge-danger',
  }
  return map[platform] || 'badge-gray'
}

function statusColor(status: string): string {
  if (status === 'active') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'error') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function statusDot(status: string): string {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'error') return 'bg-red-500'
  return 'bg-gray-400'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

// ==================== Component ====================

export default function AccountsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // List state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Testing
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; message: string; success: boolean } | null>(null)

  // Groups cache
  const [_groups, setGroups] = useState<Group[]>([])

  const abortRef = useRef<AbortController | null>(null)

  // ==================== Forms ====================

  const createForm = useForm({
    defaultValues: { ...defaultCreateValues },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) { showError(t('admin.accounts.nameRequired', 'Name is required')); return }
      try {
        let creds: Record<string, unknown> = {}
        try { creds = JSON.parse(value.credentials) } catch {
          showError(t('admin.accounts.invalidJson', 'Invalid JSON in credentials')); return
        }
        const req: CreateAccountRequest = { name: value.name.trim(), platform: value.platform, type: value.type, credentials: creds }
        await adminAPI.accounts.create(req)
        showSuccess(t('admin.accounts.created', 'Account created'))
        setShowCreateDialog(false)
        createForm.reset()
        loadAccounts(1)
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('admin.accounts.createFailed', 'Failed to create'))
      }
    },
  })

  const editForm = useForm({
    defaultValues: { ...defaultEditValues },
    onSubmit: async ({ value }) => {
      if (!selectedAccount) return
      try {
        const req: UpdateAccountRequest = {
          name: value.name.trim(),
          status: value.status as 'active' | 'inactive',
          schedulable: value.schedulable,
          priority: value.priority,
          notes: value.notes,
        }
        await adminAPI.accounts.update(selectedAccount.id, req)
        showSuccess(t('admin.accounts.updated', 'Account updated'))
        setShowEditDialog(false)
        setSelectedAccount(null)
        loadAccounts()
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('admin.accounts.updateFailed', 'Failed to update'))
      }
    },
  })

  // ==================== Data Loading ====================

  const loadAccounts = useCallback(async (p: number = page) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (filterPlatform !== 'all') filters.platform = filterPlatform
      if (filterType !== 'all') filters.type = filterType
      if (filterStatus !== 'all') filters.status = filterStatus
      if (search) filters.search = search
      const data: PaginatedResponse<Account> = await adminAPI.accounts.list(p, PAGE_SIZE, filters, { signal: ctrl.signal })
      setAccounts(data.items || [])
      setTotal(data.total)
      setPages(data.pages)
      setPage(data.page)
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        showError(t('admin.accounts.loadFailed', 'Failed to load accounts'))
      }
    } finally {
      setLoading(false)
    }
  }, [page, filterPlatform, filterType, filterStatus, search, showError, t])

  const loadGroups = useCallback(async () => {
    try {
      const data = await adminAPI.groups.list(1, 100)
      setGroups(data.items || [])
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { loadAccounts(1); loadGroups() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadAccounts(1) }, [filterPlatform, filterType, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Actions ====================

  const openEdit = (account: Account) => {
    setSelectedAccount(account)
    editForm.reset({
      name: account.name,
      status: account.status,
      schedulable: account.schedulable,
      priority: account.priority,
      notes: account.notes || '',
    })
    setShowEditDialog(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminAPI.accounts.delete(deleteTarget.id)
      showSuccess(t('admin.accounts.deleted', 'Account deleted'))
      setShowDeleteDialog(false)
      setDeleteTarget(null)
      loadAccounts()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('admin.accounts.deleteFailed', 'Failed to delete'))
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    let failed = 0
    for (const id of ids) {
      try { await adminAPI.accounts.delete(id) } catch { failed++ }
    }
    if (failed > 0) showError(`${failed} account(s) failed to delete`)
    else showSuccess(t('admin.accounts.bulkDeleted', `${ids.length} account(s) deleted`))
    setSelectedIds(new Set())
    setShowBulkDeleteDialog(false)
    loadAccounts()
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const result = await adminAPI.accounts.testAccount(id)
      setTestResult({ id, message: result.message + (result.latency_ms ? ` (${result.latency_ms}ms)` : ''), success: result.success })
    } catch (err: any) {
      setTestResult({ id, message: err?.message || 'Test failed', success: false })
    } finally {
      setTestingId(null)
    }
  }

  const handleToggleSchedulable = async (account: Account) => {
    try {
      await adminAPI.accounts.setSchedulable(account.id, !account.schedulable)
      loadAccounts()
    } catch (err: any) {
      showError(err?.response?.data?.detail || t('admin.accounts.toggleFailed', 'Failed to toggle schedulable'))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === accounts.length ? new Set() : new Set(accounts.map((a) => a.id)))
  }

  // ==================== Form Field Renderers ====================

  const renderCreateFields = (form: typeof createForm) => (
    <div className="space-y-4 py-2">
      <form.Field name="platform">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.platform', 'Platform')}</Label>
          <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as AccountPlatform)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}</form.Field>
      <form.Field name="type">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.type', 'Type')}</Label>
          <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as AccountType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACCOUNT_TYPES.map((at) => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}</form.Field>
      <form.Field name="name">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.columns.name', 'Name')} *</Label>
          <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Account name" />
        </div>
      )}</form.Field>
      <form.Field name="credentials">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.credentials', 'Credentials (JSON)')}</Label>
          <Textarea className="font-mono text-xs" rows={6} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder='{"access_token": "..."}' />
        </div>
      )}</form.Field>
    </div>
  )

  const renderEditFields = (form: typeof editForm) => (
    <div className="space-y-4 py-2">
      <form.Field name="name">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.columns.name', 'Name')} *</Label>
          <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        </div>
      )}</form.Field>
      <form.Field name="status">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.columns.status', 'Status')}</Label>
          <Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}</form.Field>
      <form.Field name="schedulable">{(field) => (
        <div className="flex items-center gap-3">
          <Label className="mb-0">{t('admin.accounts.columns.schedulable', 'Schedulable')}</Label>
          <button
            type="button"
            onClick={() => field.handleChange(!field.state.value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${field.state.value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${field.state.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}</form.Field>
      <form.Field name="priority">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.priority', 'Priority')}</Label>
          <Input type="number" value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)} />
        </div>
      )}</form.Field>
      <form.Field name="notes">{(field) => (
        <div className="space-y-2">
          <Label>{t('admin.accounts.notes', 'Notes')}</Label>
          <Textarea rows={3} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        </div>
      )}</form.Field>
    </div>
  )

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t('admin.accounts.title', 'Accounts')}</h1>
          <p className="page-description">{t('admin.accounts.description', 'Manage cloud service accounts')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4 mr-1" />
              {t('common.delete', 'Delete')} ({selectedIds.size})
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => loadAccounts()} title={t('common.refresh', 'Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="h-4 w-4 mr-1" />
            {t('common.create', 'Create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allPlatforms', 'All Platforms')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allPlatforms', 'All Platforms')}</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allTypes', 'All Types')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allTypes', 'All Types')}</SelectItem>
              {ACCOUNT_TYPES.map((at) => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allStatuses', 'All Statuses')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allStatuses', 'All Statuses')}</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAccounts(1)}
              placeholder={t('admin.accounts.searchPlaceholder', 'Search by name...')}
              className="pl-9"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadAccounts(1)}>
            {t('common.search', 'Search')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={accounts.length > 0 && selectedIds.size === accounts.length} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="px-4 py-3">{t('admin.accounts.columns.name', 'Name')}</th>
                <th className="px-4 py-3">{t('admin.accounts.columns.platformType', 'Platform / Type')}</th>
                <th className="px-4 py-3">{t('admin.accounts.columns.status', 'Status')}</th>
                <th className="px-4 py-3">{t('admin.accounts.columns.schedulable', 'Schedulable')}</th>
                <th className="px-4 py-3">{t('admin.accounts.columns.groups', 'Groups')}</th>
                <th className="px-4 py-3">{t('admin.accounts.proxy', 'Proxy')}</th>
                <th className="px-4 py-3">{t('admin.accounts.priority', 'Priority')}</th>
                <th className="px-4 py-3">{t('admin.accounts.lastUsed', 'Last Used')}</th>
                <th className="px-4 py-3 text-right">{t('admin.accounts.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && accounts.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center"><div className="spinner mx-auto" /></td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.noData', 'No data')}</td></tr>
              ) : accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(account.id)} onChange={() => toggleSelect(account.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{account.name}</div>
                    {account.notes && <div className="text-xs text-gray-500 truncate max-w-[200px]">{account.notes}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${platformBadgeClass(account.platform)}`}>{account.platform}</span>
                    <span className="badge badge-gray ml-1">{account.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${statusDot(account.status)}`} />
                      <span className={statusColor(account.status)}>{t(`admin.accounts.status.${account.status}`, account.status)}</span>
                    </div>
                    {account.error_message && (
                      <div className="text-xs text-red-500 truncate max-w-[150px]" title={account.error_message}>{account.error_message}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleSchedulable(account)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${account.schedulable ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${account.schedulable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {account.groups && account.groups.length > 0
                        ? account.groups.slice(0, 3).map((g) => <span key={g.id} className="badge badge-gray text-xs">{g.name}</span>)
                        : account.group_ids && account.group_ids.length > 0
                          ? <span className="text-xs text-gray-500">{account.group_ids.length} group(s)</span>
                          : <span className="text-xs text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {account.proxy ? (account.proxy.name || `${account.proxy.host}:${account.proxy.port}`) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">{account.priority}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(account.last_used_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>{t('common.edit', 'Edit')}</Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleTest(account.id)}
                        disabled={testingId === account.id}
                      >
                        {testingId === account.id ? <span className="spinner h-3 w-3" /> : t('common.test', 'Test')}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setDeleteTarget(account); setShowDeleteDialog(true) }}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    {testResult && testResult.id === account.id && (
                      <div className={`text-xs mt-1 text-right ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>{testResult.message}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.total', 'Total')}: {total}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => loadAccounts(page - 1)}>{t('common.prev', 'Prev')}</Button>
              <span className="text-sm text-gray-700 dark:text-gray-300">{page} / {pages}</span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => loadAccounts(page + 1)}>{t('common.next', 'Next')}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('admin.accounts.createTitle', 'Create Account')}</DialogTitle></DialogHeader>
          {renderCreateFields(createForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); createForm.reset() }} disabled={createForm.state.isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => createForm.handleSubmit()} disabled={createForm.state.isSubmitting}>
              {createForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setSelectedAccount(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('admin.accounts.editTitle', 'Edit Account')}</DialogTitle></DialogHeader>
          {renderEditFields(editForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={editForm.state.isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={editForm.state.isSubmitting}>
              {editForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.accounts.deleteConfirm', 'Are you sure you want to delete account')} <strong>{deleteTarget?.name}</strong>?{' '}
              {t('common.cannotUndo', 'This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.accounts.bulkDeleteConfirm', 'Are you sure you want to delete')} <strong>{selectedIds.size}</strong> {t('admin.accounts.accountsCount', 'account(s)')}?{' '}
              {t('common.cannotUndo', 'This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
