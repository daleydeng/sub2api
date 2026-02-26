import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminGroup, GroupPlatform, CreateGroupRequest, UpdateGroupRequest, PaginatedResponse } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20
const PLATFORMS: GroupPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'sora']
const PLATFORM_COLORS: Record<GroupPlatform, string> = {
  anthropic: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  openai: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  gemini: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  antigravity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  sora: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const defaultForm = { name: '', description: '', platform: 'anthropic' as GroupPlatform, subscription_type: 'standard' as 'standard' | 'subscription', rate_multiplier: 1, is_exclusive: false }

export default function GroupsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<'all' | GroupPlatform>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null)

  const loadGroups = useCallback(async (currentPage: number, searchTerm: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const filters: { platform?: GroupPlatform; status?: 'active' | 'inactive'; search?: string } = {}
      if (platformFilter !== 'all') filters.platform = platformFilter
      if (statusFilter !== 'all') filters.status = statusFilter
      if (searchTerm.trim()) filters.search = searchTerm.trim()
      const res: PaginatedResponse<AdminGroup> = await adminAPI.groups.list(currentPage, PAGE_SIZE, filters, { signal: controller.signal })
      setGroups(res.items)
      setTotalPages(res.pages)
      setTotal(res.total)
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') showError(t('Failed to load groups'))
    } finally {
      setLoading(false)
    }
  }, [platformFilter, statusFilter, showError, t])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); loadGroups(1, value) }, 300)
  }, [loadGroups])

  useEffect(() => { loadGroups(page, search); return () => { abortRef.current?.abort() } }, [page, platformFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => loadGroups(page, search)

  const createForm = useForm({
    defaultValues: { ...defaultForm },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) { showError(t('Group name is required')); return }
      try {
        const payload: CreateGroupRequest = { name: value.name.trim(), description: value.description.trim() || null, platform: value.platform, subscription_type: value.subscription_type, rate_multiplier: value.rate_multiplier, is_exclusive: value.is_exclusive }
        await adminAPI.groups.create(payload)
        showSuccess(t('Group created successfully'))
        setShowCreateDialog(false)
        createForm.reset()
        refresh()
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('Failed to create group'))
      }
    },
  })

  const editForm = useForm({
    defaultValues: { ...defaultForm },
    onSubmit: async ({ value }) => {
      if (!selectedGroup || !value.name.trim()) { showError(t('Group name is required')); return }
      try {
        const payload: UpdateGroupRequest = { name: value.name.trim(), description: value.description.trim() || null, platform: value.platform, subscription_type: value.subscription_type, rate_multiplier: value.rate_multiplier, is_exclusive: value.is_exclusive }
        await adminAPI.groups.update(selectedGroup.id, payload)
        showSuccess(t('Group updated successfully'))
        setShowEditDialog(false)
        setSelectedGroup(null)
        refresh()
      } catch (err: any) {
        showError(err?.response?.data?.detail || err?.message || t('Failed to update group'))
      }
    },
  })

  const openEdit = (group: AdminGroup) => {
    setSelectedGroup(group)
    editForm.reset({ name: group.name, description: group.description || '', platform: group.platform, subscription_type: group.subscription_type, rate_multiplier: group.rate_multiplier, is_exclusive: group.is_exclusive })
    setShowEditDialog(true)
  }

  const handleDelete = async () => {
    if (!selectedGroup) return
    try {
      await adminAPI.groups.delete(selectedGroup.id)
      showSuccess(t('Group deleted successfully'))
      setShowDeleteDialog(false)
      setSelectedGroup(null)
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to delete group'))
    }
  }

  const renderFormFields = (form: typeof createForm) => (
    <div className="space-y-5 py-2">
      <form.Field name="name">{(field) => <div className="space-y-2"><Label>{t('Name')} *</Label><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('Group name')} /></div>}</form.Field>
      <form.Field name="description">{(field) => <div className="space-y-2"><Label>{t('Description')}</Label><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('Optional description')} /></div>}</form.Field>
      <div className="grid grid-cols-2 gap-5">
        <form.Field name="platform">{(field) => <div className="space-y-2"><Label>{t('Platform')}</Label><Select value={field.state.value} onValueChange={(v) => field.handleChange(v as GroupPlatform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>}</form.Field>
        <form.Field name="subscription_type">{(field) => <div className="space-y-2"><Label>{t('Subscription Type')}</Label><Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'standard' | 'subscription')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">{t('Standard')}</SelectItem><SelectItem value="subscription">{t('Subscription')}</SelectItem></SelectContent></Select></div>}</form.Field>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <form.Field name="rate_multiplier">{(field) => <div className="space-y-2"><Label>{t('Rate Multiplier')}</Label><Input type="number" step="0.01" min={0} value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} /></div>}</form.Field>
        <form.Field name="is_exclusive">{(field) => <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={field.state.value} onChange={(e) => field.handleChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />{t('Exclusive')}</label></div>}</form.Field>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('Group Management')}<span className="ml-2 text-sm font-normal text-gray-500">({total})</span></h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}><PlusIcon className="mr-2 h-4 w-4" />{t('Create Group')}</Button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder={t('Search groups...')} className="pl-9" />
          </div>
          <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Platforms')}</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="inactive">{t('Inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><div className="spinner" /></div> : groups.length === 0 ? <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('No groups found')}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400"><th className="px-4 py-3">{t('Name')}</th><th className="px-4 py-3">{t('Platform')}</th><th className="px-4 py-3">{t('Type')}</th><th className="px-4 py-3">{t('Rate')}</th><th className="px-4 py-3">{t('Exclusive')}</th><th className="px-4 py-3">{t('Accounts')}</th><th className="px-4 py-3">{t('Status')}</th><th className="px-4 py-3 text-right">{t('Actions')}</th></tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {groups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{group.name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[group.platform] || 'bg-gray-100 text-gray-700'}`}>{group.platform}</span></td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{group.subscription_type}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{group.rate_multiplier}x</td>
                    <td className="px-4 py-3">{group.is_exclusive ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('Yes')}</span> : <span className="text-xs text-gray-400">{t('No')}</span>}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{group.account_count ?? '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${group.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{group.status}</span></td>
                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(group)}>{t('Edit')}</Button><Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setSelectedGroup(group); setShowDeleteDialog(true) }}><TrashIcon className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"><span className="text-sm text-gray-500 dark:text-gray-400">{t('Page')} {page} / {totalPages} ({total} {t('total')})</span><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('Previous')}</Button><Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t('Next')}</Button></div></div>}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('Create Group')}</DialogTitle></DialogHeader>
          {renderFormFields(createForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={createForm.state.isSubmitting}>{t('Cancel')}</Button>
            <Button onClick={() => createForm.handleSubmit()} disabled={createForm.state.isSubmitting}>{createForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('Edit Group')}</DialogTitle></DialogHeader>
          {renderFormFields(editForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={editForm.state.isSubmitting}>{t('Cancel')}</Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={editForm.state.isSubmitting}>{editForm.state.isSubmitting ? <div className="spinner h-4 w-4" /> : t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedGroup(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('Delete Group')}</AlertDialogTitle><AlertDialogDescription>{t('Are you sure you want to delete group')} <strong>{selectedGroup?.name}</strong>? {t('This action cannot be undone.')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('Cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('Delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
