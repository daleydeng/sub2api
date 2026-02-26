import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { UserSubscription, AdminGroup, PaginatedResponse } from '@/types'
import { PlusIcon, SearchIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 20

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function formatCost(value: number) {
  if (value >= 1) return '$' + value.toFixed(2)
  if (value >= 0.01) return '$' + value.toFixed(3)
  return '$' + value.toFixed(4)
}

function daysRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'N/A'
  const now = Date.now()
  const exp = new Date(expiresAt).getTime()
  const diff = exp - now
  if (diff <= 0) return 'Expired'
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return `${days}d`
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface SimpleUser {
  id: number
  email: string
}

export default function SubscriptionsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // ==================== List State ====================
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all')
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all')

  // Groups for filter/select
  const [allGroups, setAllGroups] = useState<AdminGroup[]>([])

  const abortRef = useRef<AbortController | null>(null)

  // ==================== Dialog State ====================
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [selectedSub, setSelectedSub] = useState<UserSubscription | null>(null)
  const [saving, setSaving] = useState(false)

  // Assign form
  const [assignForm, setAssignForm] = useState({
    user_id: 0,
    group_id: 0,
    validity_days: 30,
  })
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<SimpleUser[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Extend form
  const [extendDays, setExtendDays] = useState(30)

  // ==================== Data Loading ====================
  const loadGroups = useCallback(async () => {
    try {
      const groups = await adminAPI.groups.getAll()
      setAllGroups(groups)
    } catch {
      // silent
    }
  }, [])

  const loadSubscriptions = useCallback(
    async (currentPage: number) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const filters: {
          status?: 'active' | 'expired' | 'revoked'
          group_id?: number
        } = {}
        if (statusFilter !== 'all') filters.status = statusFilter
        if (groupFilter !== 'all') filters.group_id = groupFilter

        const res: PaginatedResponse<UserSubscription> = await adminAPI.subscriptions.list(
          currentPage,
          PAGE_SIZE,
          filters,
          { signal: controller.signal }
        )
        setSubscriptions(res.items)
        setTotalPages(res.pages)
        setTotal(res.total)
      } catch (err: any) {
        if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
          showError(t('Failed to load subscriptions'))
        }
      } finally {
        setLoading(false)
      }
    },
    [statusFilter, groupFilter, showError, t]
  )

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    loadSubscriptions(page)
    return () => {
      abortRef.current?.abort()
    }
  }, [page, statusFilter, groupFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => loadSubscriptions(page)

  // ==================== User Search ====================
  const handleUserSearch = useCallback(
    (value: string) => {
      setUserSearch(value)
      if (userSearchRef.current) clearTimeout(userSearchRef.current)
      if (!value.trim()) {
        setUserResults([])
        return
      }
      userSearchRef.current = setTimeout(async () => {
        setSearchingUsers(true)
        try {
          const results = await adminAPI.usage.searchUsers(value.trim())
          setUserResults(results)
        } catch {
          // silent
        } finally {
          setSearchingUsers(false)
        }
      }, 300)
    },
    []
  )

  // ==================== Actions ====================
  const handleAssign = async () => {
    if (!assignForm.user_id || !assignForm.group_id) {
      showError(t('Please select a user and group'))
      return
    }
    setSaving(true)
    try {
      await adminAPI.subscriptions.assign({
        user_id: assignForm.user_id,
        group_id: assignForm.group_id,
        validity_days: assignForm.validity_days > 0 ? assignForm.validity_days : undefined,
      })
      showSuccess(t('Subscription assigned successfully'))
      setShowAssignDialog(false)
      setAssignForm({ user_id: 0, group_id: 0, validity_days: 30 })
      setUserSearch('')
      setUserResults([])
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to assign subscription'))
    } finally {
      setSaving(false)
    }
  }

  const openExtend = (sub: UserSubscription) => {
    setSelectedSub(sub)
    setExtendDays(30)
    setShowExtendDialog(true)
  }

  const handleExtend = async () => {
    if (!selectedSub || extendDays <= 0) return
    setSaving(true)
    try {
      await adminAPI.subscriptions.extend(selectedSub.id, { days: extendDays })
      showSuccess(t('Subscription extended successfully'))
      setShowExtendDialog(false)
      setSelectedSub(null)
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to extend subscription'))
    } finally {
      setSaving(false)
    }
  }

  const confirmRevoke = (sub: UserSubscription) => {
    setSelectedSub(sub)
    setShowRevokeDialog(true)
  }

  const handleRevoke = async () => {
    if (!selectedSub) return
    setSaving(true)
    try {
      await adminAPI.subscriptions.revoke(selectedSub.id)
      showSuccess(t('Subscription revoked successfully'))
      setShowRevokeDialog(false)
      setSelectedSub(null)
      refresh()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || t('Failed to revoke subscription'))
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
          {t('Subscription Management')}
          <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setAssignForm({ user_id: 0, group_id: 0, validity_days: 30 })
              setUserSearch('')
              setUserResults([])
              setShowAssignDialog(true)
            }}
            className="flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            {t('Assign Subscription')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="expired">{t('Expired')}</SelectItem>
              <SelectItem value="revoked">{t('Revoked')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={groupFilter === 'all' ? 'all' : String(groupFilter)}
            onValueChange={(v) => { setGroupFilter(v === 'all' ? 'all' : Number(v)); setPage(1) }}
          >
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Groups')}</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
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
        ) : subscriptions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('No subscriptions found')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-dark-700 dark:text-gray-400">
                  <th className="px-4 py-3">{t('User')}</th>
                  <th className="px-4 py-3">{t('Group')}</th>
                  <th className="px-4 py-3">{t('Status')}</th>
                  <th className="px-4 py-3">{t('Daily')}</th>
                  <th className="px-4 py-3">{t('Weekly')}</th>
                  <th className="px-4 py-3">{t('Monthly')}</th>
                  <th className="px-4 py-3">{t('Expires')}</th>
                  <th className="px-4 py-3">{t('Remaining')}</th>
                  <th className="px-4 py-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {sub.user?.email || `User #${sub.user_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {sub.group?.name || `Group #${sub.group_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] || ''}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                      {formatCost(sub.daily_usage_usd)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                      {formatCost(sub.weekly_usage_usd)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                      {formatCost(sub.monthly_usage_usd)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {formatDate(sub.expires_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()
                            ? 'text-red-500'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {daysRemaining(sub.expires_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {sub.status === 'active' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openExtend(sub)}
                              title={t('Extend')}
                            >
                              {t('Extend')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmRevoke(sub)}
                              className="text-red-500 hover:text-red-700"
                              title={t('Revoke')}
                            >
                              {t('Revoke')}
                            </Button>
                          </>
                        )}
                      </div>
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
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t('Previous')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Subscription Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Assign Subscription')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Search */}
            <div>
              <Label>{t('User')} *</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder={t('Search user by email...')}
                  className="pl-9"
                />
                {searchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="spinner h-4 w-4" />
                  </div>
                )}
              </div>
              {userResults.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-dark-800">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setAssignForm((f) => ({ ...f, user_id: u.id }))
                        setUserSearch(u.email)
                        setUserResults([])
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-dark-700 ${
                        assignForm.user_id === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {u.email}
                    </button>
                  ))}
                </div>
              )}
              {assignForm.user_id > 0 && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  {t('Selected')}: User #{assignForm.user_id}
                </p>
              )}
            </div>

            {/* Group Select */}
            <div className="space-y-2">
              <Label>{t('Group')} *</Label>
              <Select
                value={assignForm.group_id ? String(assignForm.group_id) : '0'}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, group_id: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select a group...')} />
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

            {/* Validity Days */}
            <div>
              <Label>{t('Validity Days')}</Label>
              <Input
                type="number"
                min={0}
                value={assignForm.validity_days}
                onChange={(e) =>
                  setAssignForm((f) => ({
                    ...f,
                    validity_days: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder={t('0 = no expiry')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleAssign} disabled={saving}>
              {saving ? <div className="spinner h-4 w-4" /> : t('Assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Extend Subscription')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('User')}: {selectedSub?.user?.email || `#${selectedSub?.user_id}`}
            <br />
            {t('Group')}: {selectedSub?.group?.name || `#${selectedSub?.group_id}`}
          </p>
          <div>
            <Label>{t('Days to extend')}</Label>
            <Input
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleExtend} disabled={saving}>
              {saving ? <div className="spinner h-4 w-4" /> : t('Extend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Revoke Subscription')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to revoke the subscription for')}{' '}
              <strong>{selectedSub?.user?.email || `User #${selectedSub?.user_id}`}</strong>{' '}
              {t('in group')}{' '}
              <strong>{selectedSub?.group?.name || `Group #${selectedSub?.group_id}`}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? <div className="spinner h-4 w-4" /> : t('Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
