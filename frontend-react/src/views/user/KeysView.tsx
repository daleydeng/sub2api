import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { keysAPI } from '@/api/keys'
import { usageAPI, type BatchApiKeysUsageResponse } from '@/api/usage'
import { userGroupsAPI } from '@/api/groups'
import type { ApiKey, Group } from '@/types'
import {
  ClipboardIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  RefreshIcon,
} from '@/components/icons'
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

function maskKey(key: string): string {
  if (key.length <= 12) return key
  return key.slice(0, 8) + '...' + key.slice(-4)
}

function formatCost(c: number): string {
  if (c >= 1000) return (c / 1000).toFixed(2) + 'K'
  if (c >= 1) return c.toFixed(2)
  if (c >= 0.01) return c.toFixed(3)
  return c.toFixed(4)
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString()
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'inactive': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    case 'quota_exhausted': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'expired': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

export default function KeysView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const [usageStats, setUsageStats] = useState<BatchApiKeysUsageResponse['stats']>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)

  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const createForm = useForm({
    defaultValues: {
      name: '',
      groupId: null as number | null,
      quota: 0,
      expiresInDays: 0,
      customKey: '',
    },
  })

  const editForm = useForm({
    defaultValues: {
      name: '',
      groupId: null as number | null,
      status: 'active' as 'active' | 'inactive',
      quota: 0,
      ipWhitelist: '',
      ipBlacklist: '',
    },
  })

  const { Field: CreateForm_Field } = createForm
  const { Field: EditForm_Field } = editForm

  const abortRef = useRef<AbortController | null>(null)

  const loadKeys = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const res = await keysAPI.list(page, pageSize, { signal: controller.signal })
      setKeys(res.items || [])
      setTotalPages(res.pages)
      setTotal(res.total)
      const ids = (res.items || []).map((k) => k.id)
      if (ids.length > 0) {
        try {
          const usage = await usageAPI.getDashboardApiKeysUsage(ids, { signal: controller.signal })
          setUsageStats(usage.stats || {})
        } catch { }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'CanceledError' && (err as { code?: string }).code !== 'ERR_CANCELED') {
        showError(t('keys.loadFailed', 'Failed to load API keys'))
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, showError, t])

  const loadGroups = useCallback(async () => {
    try {
      const data = await userGroupsAPI.getAvailable()
      setGroups(data || [])
    } catch { }
  }, [])

  useEffect(() => {
    loadKeys()
    loadGroups()
    return () => { abortRef.current?.abort() }
  }, [loadKeys, loadGroups])

  const copyToClipboard = useCallback(async (key: ApiKey) => {
    try {
      await navigator.clipboard.writeText(key.key)
      setCopiedId(key.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showError(t('keys.copyFailed', 'Failed to copy key'))
    }
  }, [showError, t])

  const toggleStatus = useCallback(async (key: ApiKey) => {
    const newStatus = key.status === 'active' ? 'inactive' : 'active'
    try {
      await keysAPI.toggleStatus(key.id, newStatus)
      showSuccess(t('keys.statusUpdated', 'Status updated'))
      loadKeys()
    } catch {
      showError(t('keys.statusUpdateFailed', 'Failed to update status'))
    }
  }, [loadKeys, showError, showSuccess, t])

  const handleCreate = useCallback(async () => {
    const values = createForm.store.state.values
    if (!values.name.trim()) { showError(t('keys.nameRequired', 'Key name is required')); return }
    setCreating(true)
    try {
      await keysAPI.create(
        values.name.trim(),
        values.groupId,
        values.customKey.trim() || undefined,
        undefined,
        undefined,
        values.quota > 0 ? values.quota : undefined,
        values.expiresInDays > 0 ? values.expiresInDays : undefined,
      )
      showSuccess(t('keys.created', 'API key created successfully'))
      setShowCreateDialog(false)
      createForm.reset()
      loadKeys()
    } catch (err) {
      showError((err as { response?: { data?: { error?: string } } }).response?.data?.error || t('keys.createFailed', 'Failed to create API key'))
    } finally {
      setCreating(false)
    }
  }, [createForm, loadKeys, showError, showSuccess, t])

  const openEdit = useCallback((key: ApiKey) => {
    setSelectedKey(key)
    editForm.reset({
      name: key.name,
      groupId: key.group_id,
      status: key.status === 'active' ? 'active' : 'inactive',
      quota: key.quota,
      ipWhitelist: (key.ip_whitelist || []).join('\n'),
      ipBlacklist: (key.ip_blacklist || []).join('\n'),
    })
    setShowEditDialog(true)
  }, [editForm])

  const handleEdit = useCallback(async () => {
    if (!selectedKey) return
    const values = editForm.store.state.values
    setSaving(true)
    try {
      await keysAPI.update(selectedKey.id, {
        name: values.name.trim(),
        group_id: values.groupId,
        status: values.status,
        quota: values.quota,
        ip_whitelist: values.ipWhitelist.trim() ? values.ipWhitelist.trim().split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
        ip_blacklist: values.ipBlacklist.trim() ? values.ipBlacklist.trim().split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
      })
      showSuccess(t('keys.updated', 'API key updated'))
      setShowEditDialog(false)
      loadKeys()
    } catch (err) {
      showError((err as { response?: { data?: { error?: string } } }).response?.data?.error || t('keys.updateFailed', 'Failed to update API key'))
    } finally {
      setSaving(false)
    }
  }, [selectedKey, editForm, loadKeys, showError, showSuccess, t])

  const handleDelete = useCallback(async () => {
    if (!selectedKey) return
    setDeleting(true)
    try {
      await keysAPI.delete(selectedKey.id)
      showSuccess(t('keys.deleted', 'API key deleted'))
      setShowDeleteDialog(false)
      setSelectedKey(null)
      loadKeys()
    } catch {
      showError(t('keys.deleteFailed', 'Failed to delete API key'))
    } finally {
      setDeleting(false)
    }
  }, [selectedKey, loadKeys, showError, showSuccess, t])

  const getGroupName = useCallback((groupId: number | null): string => {
    if (!groupId) return t('keys.default', 'Default')
    const group = groups.find((g) => g.id === groupId)
    return group?.name || `#${groupId}`
  }, [groups, t])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('keys.title', 'API Keys')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('keys.description', 'Manage your API keys for accessing the service.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadKeys} title={t('common.refresh', 'Refresh')}>
            <RefreshIcon className="h-5 w-5" />
          </Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('keys.create', 'Create Key')}
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="spinner" /></div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('keys.empty', 'No API keys yet. Create your first one.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-dark-700 dark:bg-dark-800 dark:text-gray-400">
                  <th className="px-4 py-3">{t('keys.name', 'Name')}</th>
                  <th className="px-4 py-3">{t('keys.key', 'Key')}</th>
                  <th className="px-4 py-3">{t('keys.group', 'Group')}</th>
                  <th className="px-4 py-3">{t('keys.usage', 'Usage')}</th>
                  <th className="px-4 py-3">{t('keys.quota', 'Quota')}</th>
                  <th className="px-4 py-3">{t('keys.status', 'Status')}</th>
                  <th className="px-4 py-3">{t('common.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const usage = usageStats[String(key.id)]
                  const quotaPercent = key.quota > 0 ? Math.min(100, (key.quota_used / key.quota) * 100) : 0
                  return (
                    <tr key={key.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-dark-800 dark:hover:bg-dark-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
                        {key.expires_at && <div className="text-xs text-gray-400 dark:text-gray-500">{t('keys.expires', 'Expires')}: {formatDate(key.expires_at)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-dark-700 dark:text-gray-300">{maskKey(key.key)}</code>
                          <button onClick={() => copyToClipboard(key)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={t('keys.copy', 'Copy')}>
                            {copiedId === key.id ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{getGroupName(key.group_id)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {usage ? <><div>{t('keys.today', 'Today')}: ${formatCost(usage.today_actual_cost || 0)}</div><div>{t('common.total', 'Total')}: ${formatCost(usage.total_actual_cost || 0)}</div></> : <span>-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {key.quota > 0 ? (
                          <div className="w-24">
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-gray-500 dark:text-gray-400">${formatCost(key.quota_used)}</span>
                              <span className="text-gray-400 dark:text-gray-500">${formatCost(key.quota)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
                              <div className={`h-full rounded-full transition-all ${quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${quotaPercent}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-xs text-gray-400 dark:text-gray-500">{t('keys.unlimited', 'Unlimited')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleStatus(key)} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(key.status)}`}>
                          {t(`keys.status_${key.status}`, key.status)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(key)} className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">{t('common.edit', 'Edit')}</button>
                          <button onClick={() => { setSelectedKey(key); setShowDeleteDialog(true) }} className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-dark-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.showing', 'Showing')} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} {t('common.of', 'of')} {total}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('common.prev', 'Prev')}</Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">...</span>}
                  <Button variant={p === page ? 'default' : 'ghost'} size="sm" onClick={() => setPage(p)}>{p}</Button>
                </span>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t('common.next', 'Next')}</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('keys.createTitle', 'Create API Key')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <CreateForm_Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.name', 'Name')} *</Label>
                  <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('keys.namePlaceholder', 'My API Key')} />
                </div>
              )}
            </CreateForm_Field>
            <CreateForm_Field name="groupId">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.group', 'Group')}</Label>
                  <Select value={String(field.state.value ?? '__none__')} onValueChange={(v) => field.handleChange(v === '__none__' ? null : Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('keys.default', 'Default')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('keys.default', 'Default')}</SelectItem>
                      {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CreateForm_Field>
            <div className="grid grid-cols-2 gap-5">
              <CreateForm_Field name="quota">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('keys.quota', 'Quota')} (USD)</Label>
                    <Input type="number" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} min={0} step={0.01} placeholder="0 = unlimited" />
                  </div>
                )}
              </CreateForm_Field>
              <CreateForm_Field name="expiresInDays">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('keys.expiresInDays', 'Expires (days)')}</Label>
                    <Input type="number" value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)} min={0} placeholder="0 = never" />
                  </div>
                )}
              </CreateForm_Field>
            </div>
            <CreateForm_Field name="customKey">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.customKey', 'Custom Key')}</Label>
                  <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('keys.customKeyPlaceholder', 'Leave empty for auto-generated')} />
                </div>
              )}
            </CreateForm_Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleCreate} disabled={creating || !createForm.store.state.values.name.trim()}>
              {creating ? <span className="flex items-center gap-2"><div className="spinner h-4 w-4" />{t('common.creating', 'Creating...')}</span> : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('keys.editTitle', 'Edit API Key')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <EditForm_Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.name', 'Name')}</Label>
                  <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </EditForm_Field>
            <div className="grid grid-cols-2 gap-5">
              <EditForm_Field name="groupId">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('keys.group', 'Group')}</Label>
                    <Select value={String(field.state.value ?? '__none__')} onValueChange={(v) => field.handleChange(v === '__none__' ? null : Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('keys.default', 'Default')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('keys.default', 'Default')}</SelectItem>
                        {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
              <EditForm_Field name="status">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('keys.status', 'Status')}</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'active' | 'inactive')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('keys.status_active', 'Active')}</SelectItem>
                        <SelectItem value="inactive">{t('keys.status_inactive', 'Inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
            </div>
            <EditForm_Field name="quota">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.quota', 'Quota')} (USD)</Label>
                  <Input type="number" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} min={0} step={0.01} />
                </div>
              )}
            </EditForm_Field>
            <EditForm_Field name="ipWhitelist">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.ipWhitelist', 'IP Whitelist')}</Label>
                  <Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={3} placeholder={t('keys.ipPlaceholder', 'One IP per line')} />
                </div>
              )}
            </EditForm_Field>
            <EditForm_Field name="ipBlacklist">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.ipBlacklist', 'IP Blacklist')}</Label>
                  <Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={3} placeholder={t('keys.ipPlaceholder', 'One IP per line')} />
                </div>
              )}
            </EditForm_Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <span className="flex items-center gap-2"><div className="spinner h-4 w-4" />{t('common.saving', 'Saving...')}</span> : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedKey(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keys.deleteTitle', 'Delete API Key')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('keys.deleteConfirm', 'Are you sure you want to delete this API key?')}
              <span className="mt-2 block font-medium text-foreground">{selectedKey?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <span className="flex items-center gap-2"><div className="spinner h-4 w-4" />{t('common.deleting', 'Deleting...')}</span> : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
