import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { RedeemCode, RedeemCodeType, AdminGroup, PaginatedResponse } from '@/types'
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  RefreshIcon,
  ClipboardIcon,
  CheckIcon,
  DownloadIcon,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function maskCode(code: string): string {
  if (code.length <= 8) return code
  return code.slice(0, 4) + '****' + code.slice(-4)
}

const TYPE_COLORS: Record<RedeemCodeType, string> = {
  balance: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  concurrency: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  subscription: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  invitation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  unused: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  used: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function RedeemView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // ==================== List State ====================
  const [codes, setCodes] = useState<RedeemCode[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | RedeemCodeType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired' | 'unused'>('all')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Groups for subscription type
  const [allGroups, setAllGroups] = useState<AdminGroup[]>([])

  // ==================== Dialog State ====================
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCode, setSelectedCode] = useState<RedeemCode | null>(null)
  const [saving, setSaving] = useState(false)

  // Generate form
  const [genForm, setGenForm] = useState({
    type: 'balance' as RedeemCodeType,
    value: 1,
    count: 1,
    group_id: 0,
    validity_days: 30,
  })

  // Generated codes result
  const [generatedCodes, setGeneratedCodes] = useState<RedeemCode[]>([])

  // Copy state
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // ==================== Data Loading ====================
  const loadGroups = useCallback(async () => {
    try {
      const groups = await adminAPI.groups.getAll()
      setAllGroups(groups)
    } catch {
      // silent
    }
  }, [])

  const loadCodes = useCallback(
    async (currentPage: number, searchTerm: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const filters: {
          type?: RedeemCodeType
          status?: 'active' | 'used' | 'expired' | 'unused'
          search?: string
        } = {}
        if (typeFilter !== 'all') filters.type = typeFilter
        if (statusFilter !== 'all') filters.status = statusFilter
        if (searchTerm.trim()) filters.search = searchTerm.trim()

        const res: PaginatedResponse<RedeemCode> = await adminAPI.redeem.list(
          currentPage,
          PAGE_SIZE,
          filters,
          { signal: controller.signal }
        )
        setCodes(res.items)
        setTotalPages(res.pages)
        setTotal(res.total)
      } catch (err: any) {
        if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
          showError(t('Failed to load redeem codes'))
        }
      } finally {
        setLoading(false)
      }
    },
    [typeFilter, statusFilter, showError, t]
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setPage(1)
        loadCodes(1, value)
      }, 300)
    },
    [loadCodes]
  )

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    loadCodes(page, search)
    return () => {
      abortRef.current?.abort()
    }
  }, [page, typeFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => loadCodes(page, search)

  // ==================== Actions ====================
  const handleGenerate = async () => {
    if (genForm.count < 1 || genForm.value <= 0) {
      showError(t('Invalid count or value'))
      return
    }
    if (genForm.type === 'subscription' && !genForm.group_id) {
      showError(t('Please select a group for subscription codes'))
      return
    }
    setSaving(true)
    try {
      const result = await adminAPI.redeem.generate(
        genForm.count,
        genForm.type,
        genForm.value,
        genForm.type === 'subscription' ? genForm.group_id : undefined,
        genForm.type === 'subscription' ? genForm.validity_days : undefined
      )
      setGeneratedCodes(result)
      setShowGenerateDialog(false)
      setShowResultDialog(true)
      showSuccess(t('Generated') + ` ${result.length} ` + t('codes successfully'))
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to generate codes'))
    } finally {
      setSaving(false)
    }
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      showError(t('Failed to copy'))
    }
  }

  const handleCopyAllCodes = async () => {
    try {
      const text = generatedCodes.map((c) => c.code).join('\n')
      await navigator.clipboard.writeText(text)
      showSuccess(t('All codes copied to clipboard'))
    } catch {
      showError(t('Failed to copy'))
    }
  }

  const handleDownloadCodes = () => {
    const text = generatedCodes.map((c) => c.code).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redeem-codes-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCodes = async () => {
    try {
      const filters: { type?: RedeemCodeType; status?: 'active' | 'used' | 'expired' } = {}
      if (typeFilter !== 'all') filters.type = typeFilter
      if (statusFilter !== 'all' && statusFilter !== 'unused') {
        filters.status = statusFilter as 'active' | 'used' | 'expired'
      }
      const blob = await adminAPI.redeem.exportCodes(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redeem-codes-export-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to export codes'))
    }
  }

  const confirmDelete = (code: RedeemCode) => {
    setSelectedCode(code)
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!selectedCode) return
    setSaving(true)
    try {
      await adminAPI.redeem.delete(selectedCode.id)
      showSuccess(t('Redeem code deleted'))
      setShowDeleteDialog(false)
      setSelectedCode(null)
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to delete code'))
    } finally {
      setSaving(false)
    }
  }

  // ==================== Render ====================
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('Redeem Code Management')}
          <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleExportCodes} className="flex items-center gap-1 text-sm" title={t('Export CSV')}>
            <DownloadIcon className="h-4 w-4" />
            {t('Export')}
          </Button>
          <Button variant="ghost" onClick={refresh} className="btn-icon" title={t('Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setGenForm({ type: 'balance', value: 1, count: 1, group_id: 0, validity_days: 30 })
              setShowGenerateDialog(true)
            }}
            className="flex items-center gap-1 text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            {t('Generate Codes')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('Search codes...')}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Types')}</SelectItem>
              <SelectItem value="balance">{t('Balance')}</SelectItem>
              <SelectItem value="concurrency">{t('Concurrency')}</SelectItem>
              <SelectItem value="subscription">{t('Subscription')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="unused">{t('Unused')}</SelectItem>
              <SelectItem value="used">{t('Used')}</SelectItem>
              <SelectItem value="expired">{t('Expired')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : codes.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('No redeem codes found')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400">
                  <th className="px-4 py-3">{t('Code')}</th>
                  <th className="px-4 py-3">{t('Type')}</th>
                  <th className="px-4 py-3">{t('Value')}</th>
                  <th className="px-4 py-3">{t('Status')}</th>
                  <th className="px-4 py-3">{t('Used By')}</th>
                  <th className="px-4 py-3">{t('Used At')}</th>
                  <th className="px-4 py-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {codes.map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-gray-900 dark:text-white">
                          {maskCode(code.code)}
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() => handleCopyCode(code.code)}
                          className="p-0.5 h-auto"
                          title={t('Copy')}
                        >
                          {copiedCode === code.code ? (
                            <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[code.type] || ''}`}
                      >
                        {code.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {code.type === 'balance' ? `$${code.value}` : code.value}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[code.status] || ''}`}
                      >
                        {code.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {code.user?.email || (code.used_by ? `User #${code.used_by}` : '-')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {formatDate(code.used_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => confirmDelete(code)}
                        className="text-red-500 hover:text-red-700 p-1 h-auto"
                        title={t('Delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('Page')} {page} / {totalPages} ({total} {t('total')})
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm disabled:opacity-50"
              >
                {t('Previous')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-sm disabled:opacity-50"
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Codes Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Generate Redeem Codes')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('Type')}</Label>
              <Select value={genForm.type} onValueChange={(v) => setGenForm((f) => ({ ...f, type: v as RedeemCodeType }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">{t('Balance')}</SelectItem>
                  <SelectItem value="concurrency">{t('Concurrency')}</SelectItem>
                  <SelectItem value="subscription">{t('Subscription')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('Value')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={genForm.type === 'balance' ? '0.01' : '1'}
                  value={genForm.value}
                  onChange={(e) =>
                    setGenForm((f) => ({
                      ...f,
                      value: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Count')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={genForm.count}
                  onChange={(e) =>
                    setGenForm((f) => ({
                      ...f,
                      count: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>

            {genForm.type === 'subscription' && (
              <>
                <div className="space-y-2">
                  <Label>{t('Group')} *</Label>
                  <Select value={String(genForm.group_id)} onValueChange={(v) => setGenForm((f) => ({ ...f, group_id: Number(v) }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('Select a group...')}</SelectItem>
                      {allGroups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name} ({g.platform})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('Validity Days')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={genForm.validity_days}
                    onChange={(e) =>
                      setGenForm((f) => ({
                        ...f,
                        validity_days: parseInt(e.target.value) || 30,
                      }))
                    }
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleGenerate} disabled={saving}>
              {saving ? <div className="spinner h-4 w-4" /> : t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Codes Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Generated Codes')} ({generatedCodes.length})</DialogTitle>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-dark-800">
            {generatedCodes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border-b border-gray-200 py-1.5 last:border-0 dark:border-gray-700"
              >
                <span className="font-mono text-xs text-gray-900 dark:text-white">
                  {c.code}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => handleCopyCode(c.code)}
                  className="p-0.5 h-auto"
                  title={t('Copy')}
                >
                  {copiedCode === c.code ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleCopyAllCodes} className="flex items-center gap-1 text-sm">
              <ClipboardIcon className="h-4 w-4" />
              {t('Copy All')}
            </Button>
            <Button variant="outline" onClick={handleDownloadCodes} className="flex items-center gap-1 text-sm">
              <DownloadIcon className="h-4 w-4" />
              {t('Download')}
            </Button>
            <Button onClick={() => setShowResultDialog(false)} className="text-sm">
              {t('Done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Redeem Code')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete code')}{' '}
              <strong className="font-mono">{selectedCode ? maskCode(selectedCode.code) : ''}</strong>?{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? <div className="spinner h-4 w-4" /> : t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
