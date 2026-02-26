/**
 * Operations Dashboard
 * Simple monitoring placeholder with ops_monitoring_enabled toggle and placeholder cards.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import { RefreshIcon, ShieldIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

// ==================== Toggle Switch ====================

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ==================== Placeholder Card ====================

function PlaceholderCard({ title, description, iconLabel }: { title: string; description: string; iconLabel: string }) {
  return (
    <div className="card card-hover p-6">
      <div className="flex items-start gap-4">
        <div className="stat-icon stat-icon-primary flex-shrink-0">
          <span className="text-lg font-bold">{iconLabel}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          <div className="mt-3 flex gap-2">
            <div className="skeleton h-8 w-24 rounded-lg" />
            <div className="skeleton h-8 w-16 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== Component ====================

export default function OpsDashboard() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [loading, setLoading] = useState(false)
  const [opsEnabled, setOpsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)

  // ==================== Data Loading ====================

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = await adminAPI.settings.getSettings()
      setOpsEnabled(settings.ops_monitoring_enabled ?? false)
    } catch (err: any) {
      showError(t('admin.ops.loadFailed', 'Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }, [showError, t])

  useEffect(() => {
    loadSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Actions ====================

  const handleToggle = async (enabled: boolean) => {
    setToggling(true)
    try {
      await adminAPI.settings.updateSettings({ ops_monitoring_enabled: enabled })
      setOpsEnabled(enabled)
      showSuccess(
        enabled
          ? t('admin.ops.enabled', 'Ops monitoring enabled')
          : t('admin.ops.disabled', 'Ops monitoring disabled')
      )
    } catch (err: any) {
      showError(err?.response?.data?.detail || err?.message || 'Failed to update settings')
    } finally {
      setToggling(false)
    }
  }

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('admin.ops.title', 'Operations Dashboard')}</h1>
          <p className="page-description">{t('admin.ops.description', 'System monitoring and health checks')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadSettings} title={t('common.refresh', 'Refresh')}>
          <RefreshIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Info Card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="stat-icon stat-icon-primary flex-shrink-0">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('admin.ops.monitoringTitle', 'Operations Monitoring')}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('admin.ops.monitoringDesc', 'When enabled, the system will collect real-time metrics, track account health, monitor API latencies, and generate alerts for anomalies. Data is collected via periodic polling and can be extended with WebSocket for live updates.')}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.ops.enableMonitoring', 'Enable Ops Monitoring')}
              </span>
              <Toggle value={opsEnabled} onChange={handleToggle} disabled={toggling} />
              {toggling && <span className="spinner h-4 w-4" />}
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Cards (shown when enabled) */}
      {opsEnabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <div className="stat-icon stat-icon-success">
                <span className="text-lg font-bold">OK</span>
              </div>
              <div className="min-w-0">
                <div className="stat-value">--</div>
                <div className="stat-label">{t('admin.ops.healthyAccounts', 'Healthy Accounts')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-danger">
                <span className="text-lg font-bold">!</span>
              </div>
              <div className="min-w-0">
                <div className="stat-value">--</div>
                <div className="stat-label">{t('admin.ops.activeAlerts', 'Active Alerts')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-primary">
                <span className="text-lg font-bold">ms</span>
              </div>
              <div className="min-w-0">
                <div className="stat-value">--</div>
                <div className="stat-label">{t('admin.ops.avgLatency', 'Avg Latency')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-warning">
                <span className="text-lg font-bold">%</span>
              </div>
              <div className="min-w-0">
                <div className="stat-value">--</div>
                <div className="stat-label">{t('admin.ops.successRate', 'Success Rate')}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PlaceholderCard
              title={t('admin.ops.realTimeMetrics', 'Real-Time Metrics')}
              description={t('admin.ops.realTimeMetricsDesc', 'Live request throughput, error rates, and latency percentiles. Requires WebSocket connection for streaming updates.')}
              iconLabel="RT"
            />
            <PlaceholderCard
              title={t('admin.ops.accountHealth', 'Account Health Monitor')}
              description={t('admin.ops.accountHealthDesc', 'Track the health status of all cloud service accounts. Automatic detection of rate limits, authentication failures, and quota exhaustion.')}
              iconLabel="AH"
            />
            <PlaceholderCard
              title={t('admin.ops.alertsConfig', 'Alerts & Notifications')}
              description={t('admin.ops.alertsConfigDesc', 'Configure alert thresholds for error rates, latency spikes, and account failures. Supports email and webhook notifications.')}
              iconLabel="AL"
            />
            <PlaceholderCard
              title={t('admin.ops.auditLog', 'Audit Log')}
              description={t('admin.ops.auditLogDesc', 'Review admin actions, configuration changes, and system events. Includes account modifications, setting updates, and access logs.')}
              iconLabel="AU"
            />
          </div>

          {/* Coming soon notice */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <span className="text-sm text-amber-600 dark:text-amber-400">i</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('admin.ops.comingSoon', 'Detailed monitoring dashboards with real-time charts and WebSocket streaming are coming in a future update. The ops_monitoring_enabled flag allows the backend to start collecting metrics in preparation.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disabled state hint */}
      {!opsEnabled && (
        <div className="card p-8">
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShieldIcon className="h-12 w-12" />
            </div>
            <h3 className="empty-state-title">{t('admin.ops.disabledTitle', 'Monitoring Disabled')}</h3>
            <p className="empty-state-description">
              {t('admin.ops.disabledDesc', 'Enable operations monitoring above to view real-time metrics, alerts, and health status for your accounts and proxies.')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
