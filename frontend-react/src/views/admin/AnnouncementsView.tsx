import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { Announcement, AnnouncementStatus, BasePaginationResponse } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20

function formatDate(dateStr: string | null | undefined) { if (!dateStr) return '-'; return new Date(dateStr).toLocaleString() }
function toUnixSeconds(dateStr: string): number | undefined { if (!dateStr) return undefined; const ts = new Date(dateStr).getTime(); return isNaN(ts) ? undefined : Math.floor(ts / 1000) }
function toDatetimeLocal(dateStr: string | undefined | null): string { if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return ''; const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

const STATUS_COLORS: Record<AnnouncementStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export default function AnnouncementsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AnnouncementStatus>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)

  const loadAnnouncements = useCallback(async (currentPage: number, searchTerm: string) => {
    setLoading(true)
    try {
      const filters: { status?: string; search?: string } = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      if (searchTerm.trim()) filters.search = searchTerm.trim()
      const res: BasePaginationResponse<Announcement> = await adminAPI.announcements.list(currentPage, PAGE_SIZE, filters)
      setAnnouncements(res.items); setTotalPages(res.pages); setTotal(res.total)
    } catch (err: any) { showError(t('Failed to load announcements')) } finally { setLoading(false) }
  }, [statusFilter, showError, t])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); loadAnnouncements(1, value) }, 300)
  }, [loadAnnouncements])

  useEffect(() => { loadAnnouncements(page, search) }, [page, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => loadAnnouncements(page, search)

  const form = useForm({
    defaultValues: { title: '', content: '', status: 'draft' as AnnouncementStatus, starts_at: '', ends_at: '' },
    onSubmit: async ({ value }) => {
      if (!value.title.trim()) { showError(t('Title is required')); return }
      try {
        const payload: any = { title: value.title.trim(), content: value.content, status: value.status, targeting: {} }
        if (value.starts_at) payload.starts_at = toUnixSeconds(value.starts_at)
        if (value.ends_at) payload.ends_at = toUnixSeconds(value.ends_at)
        if (isEdit && selectedAnnouncement) {
          await adminAPI.announcements.update(selectedAnnouncement.id, payload)
          showSuccess(t('Announcement updated successfully'))
        } else {
          await adminAPI.announcements.create(payload)
          showSuccess(t('Announcement created successfully'))
        }
        setShowFormDialog(false); refresh()
      } catch (err: any) { showError(err?.response?.data?.detail || err?.message || t('Failed to save announcement')) }
    },
  })

  const openCreate = () => { setIsEdit(false); setSelectedAnnouncement(null); form.reset(); setShowFormDialog(true) }
  const openEdit = (ann: Announcement) => {
    setIsEdit(true); setSelectedAnnouncement(ann)
    form.reset({ title: ann.title, content: ann.content, status: ann.status, starts_at: toDatetimeLocal(ann.starts_at), ends_at: toDatetimeLocal(ann.ends_at) })
    setShowFormDialog(true)
  }

  const handleDelete = async () => {
    if (!selectedAnnouncement) return
    try {
      await adminAPI.announcements.delete(selectedAnnouncement.id)
      showSuccess(t('Announcement deleted successfully'))
      setShowDeleteDialog(false); setSelectedAnnouncement(null); refresh()
    } catch (err: any) { showError(err?.response?.data?.detail || err?.message || t('Failed to delete announcement')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('Announcement Management')} <span className="ml-2 text-sm font-normal text-gray-500">({total})</span></h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><PlusIcon className="mr-2 h-4 w-4" />{t('Create Announcement')}</Button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder={t('Search announcements...')} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="draft">{t('Draft')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="archived">{t('Archived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><div className="spinner" /></div> : announcements.length === 0 ? <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{t('No announcements found')}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400"><th className="px-4 py-3">{t('Title')}</th><th className="px-4 py-3">{t('Status')}</th><th className="px-4 py-3">{t('Starts')}</th><th className="px-4 py-3">{t('Ends')}</th><th className="px-4 py-3">{t('Created')}</th><th className="px-4 py-3 text-right">{t('Actions')}</th></tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {announcements.map((ann) => (
                  <tr key={ann.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="max-w-[240px] truncate px-4 py-3 font-medium text-gray-900 dark:text-white">{ann.title}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ann.status]}`}>{ann.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(ann.starts_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(ann.ends_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(ann.created_at)}</td>
                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(ann)}>{t('Edit')}</Button><Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setSelectedAnnouncement(ann); setShowDeleteDialog(true) }}><TrashIcon className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"><span className="text-sm text-gray-500 dark:text-gray-400">{t('Page')} {page} / {totalPages} ({total} {t('total')})</span><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('Previous')}</Button><Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t('Next')}</Button></div></div>}
      </div>

      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEdit ? t('Edit Announcement') : t('Create Announcement')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <form.Field name="title">{(field) => <div className="space-y-2"><Label>{t('Title')} *</Label><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('Announcement title')} /></div>}</form.Field>
            <form.Field name="content">{(field) => <div className="space-y-2"><Label>{t('Content')}</Label><Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={5} placeholder={t('Announcement content (supports Markdown)')} /></div>}</form.Field>
            <form.Field name="status">{(field) => <div className="space-y-2"><Label>{t('Status')}</Label><Select value={field.state.value} onValueChange={(v) => field.handleChange(v as AnnouncementStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">{t('Draft')}</SelectItem><SelectItem value="active">{t('Active')}</SelectItem><SelectItem value="archived">{t('Archived')}</SelectItem></SelectContent></Select></div>}</form.Field>
            <div className="grid grid-cols-2 gap-5">
              <form.Field name="starts_at">{(field) => <div className="space-y-2"><Label>{t('Starts At')}</Label><input type="datetime-local" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="input-field w-full" /></div>}</form.Field>
              <form.Field name="ends_at">{(field) => <div className="space-y-2"><Label>{t('Ends At')}</Label><input type="datetime-local" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="input-field w-full" /></div>}</form.Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={form.state.isSubmitting}>{t('Cancel')}</Button>
            <Button onClick={() => form.handleSubmit()} disabled={form.state.isSubmitting}>{form.state.isSubmitting ? <div className="spinner h-4 w-4" /> : isEdit ? t('Save') : t('Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedAnnouncement(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('Delete Announcement')}</AlertDialogTitle><AlertDialogDescription>{t('Are you sure you want to delete announcement')} <strong>{selectedAnnouncement?.title}</strong>? {t('This action cannot be undone.')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('Cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('Delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
