/**
 * OAuth Callback View
 * Shows authorization code and state from OAuth callbacks.
 * Used for admin OAuth flows (e.g., Gemini).
 * Mirrors Vue auth/OAuthCallbackView.vue
 */

import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ClipboardIcon, CheckIcon } from '@/components/icons'

export default function OAuthCallbackView() {
  const { t } = useTranslation()
  const searchParams = useRouterState({ select: (s) => new URLSearchParams(s.location.search) })

  const code = searchParams.get('code') || ''
  const state = searchParams.get('state') || ''
  const errorParam = searchParams.get('error') || ''
  const errorDescription = searchParams.get('error_description') || ''
  const fullUrl = window.location.href

  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-dark-950">
      <div className="w-full max-w-lg">
        <div className="card p-6">
          <h1 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
            {t('oauth.title', 'OAuth Callback')}
          </h1>

          {errorParam ? (
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <p className="font-medium text-red-600 dark:text-red-400">{errorParam}</p>
              {errorDescription && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errorDescription}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('oauth.authorizationCode', 'Authorization Code')}
                </label>
                <div className="flex items-center gap-2">
                  <input type="text" value={code} readOnly className="input-field flex-1 font-mono text-sm" />
                  <button onClick={() => copyToClipboard(code, 'code')} className="btn-ghost btn-icon flex-shrink-0" title="Copy">
                    {copied === 'code' ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {state && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('oauth.state', 'State')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={state} readOnly className="input-field flex-1 font-mono text-sm" />
                    <button onClick={() => copyToClipboard(state, 'state')} className="btn-ghost btn-icon flex-shrink-0" title="Copy">
                      {copied === 'state' ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('oauth.callbackUrl', 'Callback URL')}
                </label>
                <div className="flex items-center gap-2">
                  <input type="text" value={fullUrl} readOnly className="input-field flex-1 font-mono text-xs" />
                  <button onClick={() => copyToClipboard(fullUrl, 'url')} className="btn-ghost btn-icon flex-shrink-0" title="Copy">
                    {copied === 'url' ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
