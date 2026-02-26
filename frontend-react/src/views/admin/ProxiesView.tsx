/**
 * Admin Proxies Management View
 * Manages proxy servers with CRUD, testing, quality checks, and batch operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  Proxy,
  ProxyProtocol,
  CreateProxyRequest,
  UpdateProxyRequest,
  PaginatedResponse,
  ProxyQualityCheckResult,
} from '@/types'
import {
  PlusIcon,
  TrashIcon,
  SearchIcon,
  RefreshIcon,
  ShieldIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

// ==================== Constants ====================

const PAGE_SIZE = 20

const PROTOCOLS: { value: ProxyProtocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'socks5h', label: 'SOCKS5H' },
]

// ==================== Helpers ====================

function protocolBadgeClass(protocol: string): string {
  const map: Record<string, string> = {
    http: 'badge-warning',
    https: 'badge-success',
    socks5: 'badge-purple',
    socks5h: 'badge-primary',
  }
  return map[protocol] || 'badge-gray'
}

function statusDot(status: string): string {
  return status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
}

function qualityGradeColor(grade: string | undefined): string {
  if (!grade) return 'text-gray-500'
  if (grade === 'A' || grade === 'A+') return 'text-emerald-600 dark:text-emerald-400'
  if (grade === 'B') return 'text-blue-600 dark:text-blue-400'
  if (grade === 'C') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ==================== Component ====================

export default function ProxiesView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // List state
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterProtocol, setFilterProtocol] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proxy | null>(null)
  const [showBatchDialog, setShowBatchDialog] = useState(false)

  // Create/Edit form
  const [proxyForm, setProxyForm] = useState<{
    name: string
    protocol: ProxyProtocol
    host: string
    port: number
    username: string
    password: string
  }>({
    name: '',
    protocol: 'http',
    host: '',
    port: 0,
    username: '',
    password: '',
  })

  // Batch create
  const [batchText, setBatchText] = useState('')

  // Testing & quality
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; message: string; success: boolean } | null>(null)
  const [qualityCheckingId, setQualityCheckingId] = useState<number | null>(null)
  const [qualityResult, setQualityResult] = useState<{ id: number; result: ProxyQualityCheckResult } | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // ==================== Data Loading ====================

  const loadProxies = useCallback(async (p: number = page) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (filterProtocol) filters.protocol = filterProtocol
      if (filterStatus) filters.status = filterStatus
      if (search) filters.search = search
      const data: PaginatedResponse<Proxy> = await adminAPI.proxies.list(
        p, PAGE_SIZE,
        filters as { protocol?: string; status?: 'active' | 'inactive'; search?: string },
        { signal: ctrl.signal }
      )
      setProxies(data.items || [])
      setTotal(data.total)
      setPages(data.pages)
      setPage(data.page)
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        showError(t('admin.proxies.loadFailed', 'Failed to load proxies'))
      }
    } finally {
      setLoading(false)
    }
  }, [page, filterProtocol, filterStatus, search, showError, t])

  useEffect(() => {
    loadProxies(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadProxies(1)
  }, [filterProtocol, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Actions ====================

  const handleSearch = () => {
    loadProxies(1)
  }

  const resetForm = () => {
    setProxyForm({ name: '', protocol: 'http', host: '', port: 0, username: '', password: '' })
  }

  const handleCreate = async () => {
    try {
      const req: CreateProxyRequest = {
        name: proxyForm.name,
        protocol: proxyForm.protocol,
        host: proxyForm.host,
        port: proxyForm.port,
        username: proxyForm.username || null,
        password: proxyForm.password || null,
      }
      await adminAPI.proxies.create(req)
      showSuccess(t('admin.proxies.created', 'Proxy created'))
      setShowCreateDialog(false)
      resetForm()
      loadProxies(1)
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Failed to create proxy')
    }
  }

  const handleEdit = (proxy: Proxy) => {
    setEditingProxy(proxy)
    setProxyForm({
      name: proxy.name,
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || '',
      password: '',
    })
  }

  const handleUpdate = async () => {
    if (!editingProxy) return
    try {
      const req: UpdateProxyRequest = {
        name: proxyForm.name,
        protocol: proxyForm.protocol,
        host: proxyForm.host,
        port: proxyForm.port,
        username: proxyForm.username || null,
      }
      if (proxyForm.password) {
        req.password = proxyForm.password
      }
      await adminAPI.proxies.update(editingProxy.id, req)
      showSuccess(t('admin.proxies.updated', 'Proxy updated'))
      setEditingProxy(null)
      resetForm()
      loadProxies()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Failed to update proxy')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminAPI.proxies.delete(deleteTarget.id)
      showSuccess(t('admin.proxies.deleted', 'Proxy deleted'))
      setDeleteTarget(null)
      loadProxies()
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Failed to delete proxy')
    }
  }

  const handleBatchCreate = async () => {
    const lines = batchText.split('\n').filter((l) => l.trim())
    if (lines.length === 0) {
      showError('No proxies to create')
      return
    }
    const parsed: Array<{ protocol: string; host: string; port: number; username?: string; password?: string }> = []
    for (const line of lines) {
      try {
        // Format: protocol://user:pass@host:port or protocol://host:port
        const trimmed = line.trim()
        const urlMatch = trimmed.match(/^(https?|socks5h?):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
        if (urlMatch) {
          parsed.push({
            protocol: urlMatch[1],
            host: urlMatch[4],
            port: parseInt(urlMatch[5]),
            username: urlMatch[2] || undefined,
            password: urlMatch[3] || undefined,
          })
        } else {
          // Try host:port format (default http)
          const simpleMatch = trimmed.match(/^([^:]+):(\d+)$/)
          if (simpleMatch) {
            parsed.push({ protocol: 'http', host: simpleMatch[1], port: parseInt(simpleMatch[2]) })
          }
        }
      } catch {
        // Skip invalid lines
      }
    }
    if (parsed.length === 0) {
      showError('No valid proxy format found. Use: protocol://[user:pass@]host:port')
      return
    }
    try {
      const result = await adminAPI.proxies.batchCreate(parsed)
      showSuccess(`Created: ${result.created}, Skipped: ${result.skipped}`)
      setShowBatchDialog(false)
      setBatchText('')
      loadProxies(1)
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Batch create failed')
    }
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const result = await adminAPI.proxies.testProxy(id)
      const parts = [result.message]
      if (result.latency_ms) parts.push(`${result.latency_ms}ms`)
      if (result.ip_address) parts.push(`IP: ${result.ip_address}`)
      if (result.country) parts.push(result.country)
      setTestResult({ id, message: parts.join(' | '), success: result.success })
    } catch (err: any) {
      setTestResult({ id, message: err?.message || 'Test failed', success: false })
    } finally {
      setTestingId(null)
    }
  }

  const handleQualityCheck = async (id: number) => {
    setQualityCheckingId(id)
    setQualityResult(null)
    try {
      const result = await adminAPI.proxies.checkProxyQuality(id)
      setQualityResult({ id, result })
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Quality check failed')
    } finally {
      setQualityCheckingId(null)
    }
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t('admin.proxies.title', 'Proxies')}</h1>
          <p className="page-description">{t('admin.proxies.description', 'Manage proxy servers')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => loadProxies()} title={t('common.refresh', 'Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowBatchDialog(true)}>
            {t('admin.proxies.batchCreate', 'Batch Create')}
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreateDialog(true) }}>
            <PlusIcon className="h-4 w-4" />
            {t('common.create', 'Create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterProtocol} onValueChange={setFilterProtocol}>
            <SelectTrigger className="w-auto text-sm">
              <SelectValue placeholder={t('admin.proxies.allProtocols', 'All Protocols')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('admin.proxies.allProtocols', 'All Protocols')}</SelectItem>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-auto text-sm">
              <SelectValue placeholder={t('admin.proxies.allStatuses', 'All Statuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('admin.proxies.allStatuses', 'All Statuses')}</SelectItem>
              <SelectItem value="active">{t('common.active', 'Active')}</SelectItem>
              <SelectItem value="inactive">{t('common.inactive', 'Inactive')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('admin.proxies.searchPlaceholder', 'Search by name or host...')}
                className="pl-9 text-sm"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch}>
              {t('common.search', 'Search')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('admin.proxies.name', 'Name')}</th>
                <th>{t('admin.proxies.protocol', 'Protocol')}</th>
                <th>{t('admin.proxies.hostPort', 'Host:Port')}</th>
                <th>{t('admin.proxies.status', 'Status')}</th>
                <th>{t('admin.proxies.latency', 'Latency')}</th>
                <th>{t('admin.proxies.quality', 'Quality')}</th>
                <th>{t('admin.proxies.accounts', 'Accounts')}</th>
                <th>{t('admin.proxies.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && proxies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="spinner mx-auto" />
                  </td>
                </tr>
              ) : proxies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    {t('common.noData', 'No data')}
                  </td>
                </tr>
              ) : (
                proxies.map((proxy) => (
                  <tr key={proxy.id}>
                    <td>
                      <div className="font-medium text-gray-900 dark:text-white">{proxy.name}</div>
                    </td>
                    <td>
                      <span className={`badge ${protocolBadgeClass(proxy.protocol)}`}>
                        {proxy.protocol.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {proxy.host}:{proxy.port}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${statusDot(proxy.status)}`} />
                        <span className="text-sm">{proxy.status}</span>
                      </div>
                    </td>
                    <td>
                      {proxy.latency_ms != null ? (
                        <span className={proxy.latency_ms < 500 ? 'text-emerald-600' : proxy.latency_ms < 1000 ? 'text-amber-600' : 'text-red-600'}>
                          {proxy.latency_ms}ms
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      {proxy.quality_grade ? (
                        <div>
                          <span className={`font-bold ${qualityGradeColor(proxy.quality_grade)}`}>
                            {proxy.quality_grade}
                          </span>
                          {proxy.quality_score != null && (
                            <span className="ml-1 text-xs text-gray-500">({proxy.quality_score})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="text-sm">{proxy.account_count ?? 0}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleEdit(proxy)}>
                          {t('common.edit', 'Edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleTest(proxy.id)}
                          disabled={testingId === proxy.id}
                        >
                          {testingId === proxy.id ? <span className="spinner h-3 w-3" /> : t('common.test', 'Test')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleQualityCheck(proxy.id)}
                          disabled={qualityCheckingId === proxy.id}
                          title={t('admin.proxies.qualityCheck', 'Quality Check')}
                        >
                          {qualityCheckingId === proxy.id ? (
                            <span className="spinner h-3 w-3" />
                          ) : (
                            <ShieldIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={() => setDeleteTarget(proxy)}
                        >
                          {t('common.delete', 'Delete')}
                        </Button>
                      </div>
                      {testResult && testResult.id === proxy.id && (
                        <div className={`text-xs mt-1 ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                          {testResult.message}
                        </div>
                      )}
                      {qualityResult && qualityResult.id === proxy.id && (
                        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-dark-800 p-2 text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${qualityGradeColor(qualityResult.result.grade)}`}>
                              Grade: {qualityResult.result.grade}
                            </span>
                            <span className="text-gray-500">Score: {qualityResult.result.score}</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400">{qualityResult.result.summary}</p>
                          {qualityResult.result.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className={
                                item.status === 'pass' ? 'text-emerald-600' :
                                item.status === 'warn' ? 'text-amber-600' :
                                item.status === 'challenge' ? 'text-orange-600' : 'text-red-600'
                              }>
                                [{item.status}]
                              </span>
                              <span>{item.target}</span>
                              {item.latency_ms != null && <span className="text-gray-500">{item.latency_ms}ms</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-dark-700 px-4 py-3">
            <span className="text-sm text-gray-500">{t('common.total', 'Total')}: {total}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => loadProxies(page - 1)}>
                {t('common.prev', 'Prev')}
              </Button>
              <span className="px-3 text-sm text-gray-700 dark:text-gray-300">{page} / {pages}</span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => loadProxies(page + 1)}>
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingProxy} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingProxy(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProxy
                ? t('admin.proxies.editTitle', 'Edit Proxy')
                : t('admin.proxies.createTitle', 'Create Proxy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.proxies.name', 'Name')}</Label>
              <Input
                value={proxyForm.name}
                onChange={(e) => setProxyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Proxy"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.protocol', 'Protocol')}</Label>
              <Select
                value={proxyForm.protocol}
                onValueChange={(v) => setProxyForm((f) => ({ ...f, protocol: v as ProxyProtocol }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOLS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>{t('admin.proxies.host', 'Host')}</Label>
                <Input
                  value={proxyForm.host}
                  onChange={(e) => setProxyForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="127.0.0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.proxies.port', 'Port')}</Label>
                <Input
                  type="number"
                  value={proxyForm.port || ''}
                  onChange={(e) => setProxyForm((f) => ({ ...f, port: parseInt(e.target.value) || 0 }))}
                  placeholder="8080"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.username', 'Username')}</Label>
              <Input
                value={proxyForm.username}
                onChange={(e) => setProxyForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={t('common.optional', 'Optional')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.password', 'Password')}</Label>
              <Input
                type="password"
                value={proxyForm.password}
                onChange={(e) => setProxyForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingProxy ? t('admin.proxies.leaveBlank', 'Leave blank to keep unchanged') : t('common.optional', 'Optional')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingProxy(null) }}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={editingProxy ? handleUpdate : handleCreate}
              disabled={!proxyForm.host || !proxyForm.port}
            >
              {editingProxy ? t('common.save', 'Save') : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Create Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.proxies.batchCreateTitle', 'Batch Create Proxies')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.proxies.batchHint', 'One proxy per line. Format: protocol://[user:pass@]host:port')}
            </p>
            <Textarea
              className="font-mono text-xs"
              rows={10}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'http://127.0.0.1:8080\nsocks5://user:pass@proxy.example.com:1080\nhttps://host:443'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleBatchCreate} disabled={!batchText.trim()}>
              <PlusIcon className="h-4 w-4" />
              {t('admin.proxies.batchCreate', 'Batch Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.proxies.deleteConfirm', 'Are you sure you want to delete proxy')} <strong>{deleteTarget?.name}</strong>?
              {(deleteTarget?.account_count ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600">
                  {t('admin.proxies.deleteWarning', 'This proxy is used by')} {deleteTarget?.account_count} {t('admin.proxies.accountsCount', 'account(s)')}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              <TrashIcon className="h-4 w-4" />
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
