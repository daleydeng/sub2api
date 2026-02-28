/**
 * Admin System Settings View
 * Card-based layout with multiple configuration sections:
 * Admin API Key, Registration, Defaults, Site, SMTP, Turnstile, LinuxDo, Purchase, Stream Timeout.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { SystemSettings, StreamTimeoutSettings, AdminApiKeyStatus, UpdateSettingsRequest } from '@/api/admin/settings'
import { extractErrorMessage } from '@/hooks/useDataTableQuery'
import {
  RefreshIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  CheckIcon,
  ClipboardIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

// ==================== Section Card ====================

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <div className="card-body space-y-4">
        {children}
      </div>
    </div>
  )
}

// ==================== Component ====================

export default function SettingsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Settings state
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Admin API Key
  const [apiKeyStatus, setApiKeyStatus] = useState<AdminApiKeyStatus | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)

  // Stream timeout
  const [streamTimeout, setStreamTimeout] = useState<StreamTimeoutSettings | null>(null)

  // SMTP test
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)

  // SMTP password (separate from settings since settings returns configured flag)
  const [smtpPassword, setSmtpPassword] = useState('')

  // Turnstile & LinuxDo secrets
  const [turnstileSecretKey, setTurnstileSecretKey] = useState('')
  const [linuxdoClientSecret, setLinuxdoClientSecret] = useState('')

  // ==================== Data Loading ====================

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsData, keyData, stData] = await Promise.all([
        adminAPI.settings.getSettings(),
        adminAPI.settings.getAdminApiKey(),
        adminAPI.settings.getStreamTimeoutSettings(),
      ])
      setSettings(settingsData)
      setApiKeyStatus(keyData)
      setStreamTimeout(stData)
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, t('admin.settings.failedToLoad', 'Failed to load settings')))
    } finally {
      setLoading(false)
    }
  }, [showError, t])

  useEffect(() => {
    loadSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Settings Update ====================

  const updateField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const req: UpdateSettingsRequest = {
        registration_enabled: settings.registration_enabled,
        email_verify_enabled: settings.email_verify_enabled,
        promo_code_enabled: settings.promo_code_enabled,
        password_reset_enabled: settings.password_reset_enabled,
        invitation_code_enabled: settings.invitation_code_enabled,
        totp_enabled: settings.totp_enabled,
        default_balance: settings.default_balance,
        default_concurrency: settings.default_concurrency,
        site_name: settings.site_name,
        site_subtitle: settings.site_subtitle,
        api_base_url: settings.api_base_url,
        contact_info: settings.contact_info,
        doc_url: settings.doc_url,
        home_content: settings.home_content,
        purchase_subscription_enabled: settings.purchase_subscription_enabled,
        purchase_subscription_url: settings.purchase_subscription_url,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_from_email: settings.smtp_from_email,
        smtp_from_name: settings.smtp_from_name,
        smtp_use_tls: settings.smtp_use_tls,
        turnstile_enabled: settings.turnstile_enabled,
        turnstile_site_key: settings.turnstile_site_key,
        linuxdo_connect_enabled: settings.linuxdo_connect_enabled,
        linuxdo_connect_client_id: settings.linuxdo_connect_client_id,
        linuxdo_connect_redirect_url: settings.linuxdo_connect_redirect_url,
        onboarding_enabled: settings.onboarding_enabled,
      }
      // Include secrets only if user entered them
      if (smtpPassword) req.smtp_password = smtpPassword
      if (turnstileSecretKey) req.turnstile_secret_key = turnstileSecretKey
      if (linuxdoClientSecret) req.linuxdo_connect_client_secret = linuxdoClientSecret

      const updated = await adminAPI.settings.updateSettings(req)
      setSettings(updated)
      setSmtpPassword('')
      setTurnstileSecretKey('')
      setLinuxdoClientSecret('')
      showSuccess(t('admin.settings.settingsSaved', 'Settings saved successfully'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, t('admin.settings.failedToSave', 'Failed to save settings')))
    } finally {
      setSaving(false)
    }
  }

  // ==================== Admin API Key ====================

  const handleRegenerateApiKey = async () => {
    setApiKeyLoading(true)
    try {
      const result = await adminAPI.settings.regenerateAdminApiKey()
      setNewApiKey(result.key)
      setShowApiKey(true)
      const keyData = await adminAPI.settings.getAdminApiKey()
      setApiKeyStatus(keyData)
      showSuccess(t('admin.settings.adminApiKey.keyGenerated', 'New admin API key generated'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, 'Failed to regenerate API key'))
    } finally {
      setApiKeyLoading(false)
    }
  }

  const handleDeleteApiKey = async () => {
    setApiKeyLoading(true)
    try {
      await adminAPI.settings.deleteAdminApiKey()
      setApiKeyStatus({ exists: false, masked_key: '' })
      setNewApiKey(null)
      showSuccess(t('admin.settings.adminApiKey.keyDeleted', 'Admin API key deleted'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, 'Failed to delete API key'))
    } finally {
      setApiKeyLoading(false)
    }
  }

  const copyApiKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey)
      showSuccess(t('common.copied', 'Copied to clipboard'))
    }
  }

  // ==================== SMTP Test ====================

  const handleTestSmtp = async () => {
    if (!settings) return
    setTestingSmtp(true)
    try {
      await adminAPI.settings.testSmtpConnection({
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_password: smtpPassword || 'CONFIGURED',
        smtp_use_tls: settings.smtp_use_tls,
      })
      showSuccess(t('admin.settings.smtpConnectionSuccess', 'SMTP connection successful'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, t('admin.settings.failedToTestSmtp', 'SMTP connection test failed')))
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!settings || !testEmail) return
    setSendingTestEmail(true)
    try {
      await adminAPI.settings.sendTestEmail({
        email: testEmail,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_password: smtpPassword || 'CONFIGURED',
        smtp_from_email: settings.smtp_from_email,
        smtp_from_name: settings.smtp_from_name,
        smtp_use_tls: settings.smtp_use_tls,
      })
      showSuccess(t('admin.settings.testEmailSent', 'Test email sent successfully'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, t('admin.settings.failedToSendTestEmail', 'Failed to send test email')))
    } finally {
      setSendingTestEmail(false)
    }
  }

  // ==================== Stream Timeout ====================

  const handleSaveStreamTimeout = async () => {
    if (!streamTimeout) return
    try {
      const updated = await adminAPI.settings.updateStreamTimeoutSettings(streamTimeout)
      setStreamTimeout(updated)
      showSuccess(t('admin.settings.streamTimeout.saved', 'Stream timeout settings saved'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, t('admin.settings.streamTimeout.saveFailed', 'Failed to save stream timeout settings')))
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

  if (!settings) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('admin.settings.title', 'Settings')}</h1>
          <p className="page-description">{t('admin.settings.description', 'System configuration')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadSettings} title={t('common.refresh', 'Refresh')}>
          <RefreshIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Admin API Key */}
      <SectionCard title={t('admin.settings.adminApiKey.title', 'Admin API Key')} description={t('admin.settings.adminApiKey.description', 'Global API key for external system integration with full admin access')}>
        <div className="flex items-center gap-3">
          {apiKeyStatus?.exists ? (
            <>
              <code className="code flex-1 truncate">{apiKeyStatus.masked_key}</code>
              <Button variant="secondary" size="sm" onClick={handleRegenerateApiKey} disabled={apiKeyLoading}>
                <RefreshIcon className="h-4 w-4" />
                {t('admin.settings.adminApiKey.regenerate', 'Regenerate')}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteApiKey} disabled={apiKeyLoading}>
                <TrashIcon className="h-4 w-4" />
                {t('common.delete', 'Delete')}
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">{t('admin.settings.adminApiKey.notConfigured', 'Admin API key not configured')}</span>
              <Button size="sm" onClick={handleRegenerateApiKey} disabled={apiKeyLoading}>
                {apiKeyLoading ? <span className="spinner h-4 w-4" /> : t('admin.settings.adminApiKey.create', 'Create Key')}
              </Button>
            </>
          )}
        </div>
        {newApiKey && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              {t('admin.settings.adminApiKey.keyWarning', 'This key will only be shown once. Please copy it now.')}
            </p>
            <div className="flex items-center gap-2">
              <code className="code flex-1 text-xs break-all">
                {showApiKey ? newApiKey : '****' + newApiKey.slice(-8)}
              </code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyApiKey}>
                <ClipboardIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Registration */}
      <SectionCard title={t('admin.settings.registration.title', 'Registration Settings')} description={t('admin.settings.registration.description', 'Control user registration and verification')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ['registration_enabled', t('admin.settings.registration.enableRegistration', 'Registration Enabled')],
            ['email_verify_enabled', t('admin.settings.registration.emailVerification', 'Email Verification')],
            ['promo_code_enabled', t('admin.settings.registration.promoCode', 'Promo Code')],
            ['invitation_code_enabled', t('admin.settings.registration.invitationCode', 'Invitation Code Registration')],
            ['totp_enabled', t('admin.settings.registration.totp', 'Two-Factor Authentication (2FA)')],
            ['onboarding_enabled', t('admin.settings.registration.onboardingTour', 'Onboarding Tour')],
          ] as [keyof SystemSettings, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <Toggle value={settings[key] as boolean} onChange={(v) => updateField(key, v as SystemSettings[typeof key])} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Default Settings */}
      <SectionCard title={t('admin.settings.defaults.title', 'Default User Settings')} description={t('admin.settings.defaults.description', 'Default values for new users')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="input-label">{t('admin.settings.defaults.defaultBalance', 'Default Balance')}</label>
            <input
              type="number"
              className="input"
              value={settings.default_balance}
              onChange={(e) => updateField('default_balance', parseFloat(e.target.value) || 0)}
              step="0.01"
            />
          </div>
          <div>
            <label className="input-label">{t('admin.settings.defaults.defaultConcurrency', 'Default Concurrency')}</label>
            <input
              type="number"
              className="input"
              value={settings.default_concurrency}
              onChange={(e) => updateField('default_concurrency', parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
        </div>
      </SectionCard>

      {/* Site Settings */}
      <SectionCard title={t('admin.settings.site.title', 'Site Settings')} description={t('admin.settings.site.description', 'Customize site branding')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="input-label">{t('admin.settings.site.siteName', 'Site Name')}</label>
            <input
              type="text"
              className="input"
              value={settings.site_name}
              onChange={(e) => updateField('site_name', e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">{t('admin.settings.site.siteSubtitle', 'Site Subtitle')}</label>
            <input
              type="text"
              className="input"
              value={settings.site_subtitle}
              onChange={(e) => updateField('site_subtitle', e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">{t('admin.settings.site.apiBaseUrl', 'API Base URL')}</label>
            <input
              type="text"
              className="input"
              value={settings.api_base_url}
              onChange={(e) => updateField('api_base_url', e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
          <div>
            <label className="input-label">{t('admin.settings.site.contactInfo', 'Contact Info')}</label>
            <input
              type="text"
              className="input"
              value={settings.contact_info}
              onChange={(e) => updateField('contact_info', e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">{t('admin.settings.site.docUrl', 'Documentation URL')}</label>
            <input
              type="text"
              className="input"
              value={settings.doc_url}
              onChange={(e) => updateField('doc_url', e.target.value)}
              placeholder="https://docs.example.com"
            />
          </div>
        </div>
        <div>
          <label className="input-label">{t('admin.settings.site.homeContent', 'Home Page Content')}</label>
          <textarea
            className="input font-mono text-xs"
            rows={4}
            value={settings.home_content}
            onChange={(e) => updateField('home_content', e.target.value)}
          />
        </div>
      </SectionCard>

      {/* SMTP Settings (shown when email_verify is enabled) */}
      {settings.email_verify_enabled && (
        <SectionCard title={t('admin.settings.smtp.title', 'SMTP Settings')} description={t('admin.settings.smtp.description', 'Configure email sending for verification codes')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">{t('admin.settings.smtp.host', 'SMTP Host')}</label>
              <input
                type="text"
                className="input"
                value={settings.smtp_host}
                onChange={(e) => updateField('smtp_host', e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="input-label">{t('admin.settings.smtp.port', 'SMTP Port')}</label>
              <input
                type="number"
                className="input"
                value={settings.smtp_port}
                onChange={(e) => updateField('smtp_port', parseInt(e.target.value) || 587)}
              />
            </div>
            <div>
              <label className="input-label">{t('admin.settings.smtp.username', 'SMTP Username')}</label>
              <input
                type="text"
                className="input"
                value={settings.smtp_username}
                onChange={(e) => updateField('smtp_username', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">
                {t('admin.settings.smtp.password', 'SMTP Password')}
                {settings.smtp_password_configured && (
                  <span className="ml-2 text-xs text-emerald-600">{t('admin.settings.smtp.passwordConfiguredHint', 'Password configured')}</span>
                )}
              </label>
              <input
                type="password"
                className="input"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={settings.smtp_password_configured ? t('admin.settings.smtp.passwordHint', 'Leave empty to keep existing password') : ''}
              />
            </div>
            <div>
              <label className="input-label">{t('admin.settings.smtp.fromEmail', 'From Email')}</label>
              <input
                type="email"
                className="input"
                value={settings.smtp_from_email}
                onChange={(e) => updateField('smtp_from_email', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">{t('admin.settings.smtp.fromName', 'From Name')}</label>
              <input
                type="text"
                className="input"
                value={settings.smtp_from_name}
                onChange={(e) => updateField('smtp_from_name', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('admin.settings.smtp.useTls', 'Use TLS')}</span>
              <Toggle value={settings.smtp_use_tls} onChange={(v) => updateField('smtp_use_tls', v)} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleTestSmtp} disabled={testingSmtp}>
                {testingSmtp ? <span className="spinner h-3 w-3" /> : t('admin.settings.smtp.testConnection', 'Test Connection')}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              className="input flex-1"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t('admin.settings.testEmail.recipientEmailPlaceholder', 'Enter email address for test')}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail || !testEmail}
            >
              {sendingTestEmail ? <span className="spinner h-3 w-3" /> : t('admin.settings.testEmail.sendTestEmail', 'Send Test Email')}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Cloudflare Turnstile */}
      <SectionCard title={t('admin.settings.turnstile.title', 'Cloudflare Turnstile')} description={t('admin.settings.turnstile.description', 'Bot protection for login and registration')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('admin.settings.turnstile.enableTurnstile', 'Enable Turnstile')}</span>
          <Toggle value={settings.turnstile_enabled} onChange={(v) => updateField('turnstile_enabled', v)} />
        </div>
        {settings.turnstile_enabled && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">{t('admin.settings.turnstile.siteKey', 'Site Key')}</label>
              <input
                type="text"
                className="input"
                value={settings.turnstile_site_key}
                onChange={(e) => updateField('turnstile_site_key', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">
                {t('admin.settings.turnstile.secretKey', 'Secret Key')}
                {settings.turnstile_secret_key_configured && (
                  <span className="ml-2 text-xs text-emerald-600">{t('admin.settings.turnstile.secretKeyConfiguredHint', 'Secret key configured')}</span>
                )}
              </label>
              <input
                type="password"
                className="input"
                value={turnstileSecretKey}
                onChange={(e) => setTurnstileSecretKey(e.target.value)}
                placeholder={settings.turnstile_secret_key_configured ? t('admin.settings.turnstile.secretKeyHint', 'Leave empty to keep the current value') : ''}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* LinuxDo OAuth */}
      <SectionCard title={t('admin.settings.linuxdo.title', 'LinuxDo Connect Login')} description={t('admin.settings.linuxdo.description', 'Configure LinuxDo Connect OAuth for Sub2API end-user login')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('admin.settings.linuxdo.enable', 'Enable LinuxDo Login')}</span>
          <Toggle value={settings.linuxdo_connect_enabled} onChange={(v) => updateField('linuxdo_connect_enabled', v)} />
        </div>
        {settings.linuxdo_connect_enabled && (
          <div className="space-y-4">
            <div>
              <label className="input-label">{t('admin.settings.linuxdo.clientId', 'Client ID')}</label>
              <input
                type="text"
                className="input"
                value={settings.linuxdo_connect_client_id}
                onChange={(e) => updateField('linuxdo_connect_client_id', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">
                {t('admin.settings.linuxdo.clientSecret', 'Client Secret')}
                {settings.linuxdo_connect_client_secret_configured && (
                  <span className="ml-2 text-xs text-emerald-600">{t('admin.settings.linuxdo.clientSecretConfiguredHint', 'Secret configured')}</span>
                )}
              </label>
              <input
                type="password"
                className="input"
                value={linuxdoClientSecret}
                onChange={(e) => setLinuxdoClientSecret(e.target.value)}
                placeholder={settings.linuxdo_connect_client_secret_configured ? t('admin.settings.linuxdo.clientSecretHint', 'Leave empty to keep the current value') : ''}
              />
            </div>
            <div>
              <label className="input-label">{t('admin.settings.linuxdo.redirectUrl', 'Redirect URL')}</label>
              <input
                type="text"
                className="input"
                value={settings.linuxdo_connect_redirect_url}
                onChange={(e) => updateField('linuxdo_connect_redirect_url', e.target.value)}
                placeholder="https://example.com/auth/linuxdo/callback"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Purchase */}
      <SectionCard title={t('admin.settings.purchase.title', 'Purchase Page')} description={t('admin.settings.purchase.description', 'Show a "Purchase Subscription" entry in the sidebar and open the configured URL in an iframe')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('admin.settings.purchase.enabled', 'Show Purchase Entry')}</span>
          <Toggle value={settings.purchase_subscription_enabled} onChange={(v) => updateField('purchase_subscription_enabled', v)} />
        </div>
        {settings.purchase_subscription_enabled && (
          <div>
            <label className="input-label">{t('admin.settings.purchase.url', 'Purchase URL')}</label>
            <input
              type="text"
              className="input"
              value={settings.purchase_subscription_url}
              onChange={(e) => updateField('purchase_subscription_url', e.target.value)}
              placeholder="https://shop.example.com"
            />
          </div>
        )}
      </SectionCard>

      {/* Stream Timeout */}
      <SectionCard title={t('admin.settings.streamTimeout.title', 'Stream Timeout Handling')} description={t('admin.settings.streamTimeout.description', 'Configure account handling strategy when upstream response times out')}>
        {streamTimeout && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('admin.settings.streamTimeout.enabled', 'Enable Stream Timeout Handling')}</span>
              <Toggle
                value={streamTimeout.enabled}
                onChange={(v) => setStreamTimeout((prev) => prev ? { ...prev, enabled: v } : prev)}
              />
            </div>
            {streamTimeout.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="input-label">{t('admin.settings.streamTimeout.action', 'Action')}</label>
                  <Select
                    value={streamTimeout.action}
                    onValueChange={(v) => setStreamTimeout((prev) => prev ? { ...prev, action: v as StreamTimeoutSettings['action'] } : prev)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="temp_unsched">{t('admin.settings.streamTimeout.actionTempUnsched', 'Temporarily Unschedulable')}</SelectItem>
                      <SelectItem value="error">{t('admin.settings.streamTimeout.actionError', 'Mark as Error')}</SelectItem>
                      <SelectItem value="none">{t('admin.settings.streamTimeout.actionNone', 'No Action')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="input-label">{t('admin.settings.streamTimeout.thresholdCount', 'Trigger Threshold (count)')}</label>
                    <input
                      type="number"
                      className="input"
                      value={streamTimeout.threshold_count}
                      onChange={(e) => setStreamTimeout((prev) => prev ? { ...prev, threshold_count: parseInt(e.target.value) || 1 } : prev)}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="input-label">{t('admin.settings.streamTimeout.thresholdWindowMinutes', 'Threshold Window (minutes)')}</label>
                    <input
                      type="number"
                      className="input"
                      value={streamTimeout.threshold_window_minutes}
                      onChange={(e) => setStreamTimeout((prev) => prev ? { ...prev, threshold_window_minutes: parseInt(e.target.value) || 5 } : prev)}
                      min={1}
                    />
                  </div>
                  {streamTimeout.action === 'temp_unsched' && (
                    <div>
                      <label className="input-label">{t('admin.settings.streamTimeout.tempUnschedMinutes', 'Pause Duration (minutes)')}</label>
                      <input
                        type="number"
                        className="input"
                        value={streamTimeout.temp_unsched_minutes}
                        onChange={(e) => setStreamTimeout((prev) => prev ? { ...prev, temp_unsched_minutes: parseInt(e.target.value) || 30 } : prev)}
                        min={1}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleSaveStreamTimeout}>
                    <CheckIcon className="h-4 w-4" />
                    {t('admin.settings.saveSettings', 'Save Settings')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Master Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <span className="spinner h-4 w-4" />
          ) : (
            <CheckIcon className="h-5 w-5" />
          )}
          {t('admin.settings.saveSettings', 'Save Settings')}
        </Button>
      </div>
    </div>
  )
}
