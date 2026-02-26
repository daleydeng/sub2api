import { useState, useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { authAPI } from '@/api/auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EyeIcon, EyeSlashIcon } from '@/components/icons'

export default function ResetPasswordView() {
  const { t } = useTranslation()
  const searchParams = useRouterState({ select: (s) => new URLSearchParams(s.location.search) })

  const email = searchParams.get('email') || ''
  const token = searchParams.get('token') || ''

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    if (!email || !token) setInvalidLink(true)
  }, [email, token])

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      if (value.password.length < 6) {
        setError(t('resetPassword.passwordTooShort', 'Password must be at least 6 characters'))
        return
      }
      if (value.password !== value.confirmPassword) {
        setError(t('resetPassword.passwordMismatch', 'Passwords do not match'))
        return
      }
      setError('')
      try {
        await authAPI.resetPassword({ email, token, new_password: value.password })
        setSuccess(true)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || t('resetPassword.error', 'Failed to reset password')
        setError(msg)
      }
    },
  })

  if (invalidLink) {
    return (
      <AuthLayout subtitle={t('resetPassword.subtitle', 'Reset your password')}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('resetPassword.invalidLink', 'Invalid or expired link')}</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t('resetPassword.invalidLinkDescription', 'This password reset link is invalid or has expired.')}</p>
          <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">{t('resetPassword.requestNewLink', 'Request a new link')}</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle={t('resetPassword.subtitle', 'Reset your password')} footer={<Link to="/login" className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400">{t('resetPassword.backToLogin', 'Back to Login')}</Link>}>
      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{t('resetPassword.success', 'Password reset successfully')}</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t('resetPassword.successDescription', 'Your password has been updated. You can now log in with your new password.')}</p>
          <Link to="/login" className="btn-primary inline-block px-6 py-2.5 text-sm">{t('resetPassword.goToLogin', 'Go to Login')}</Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="space-y-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          <div>
            <Label>{t('common.email', 'Email')}</Label>
            <Input value={email} readOnly disabled className="bg-gray-50 dark:bg-dark-800" />
          </div>

          <form.Field name="password">
            {(field) => (
              <div>
                <Label>{t('resetPassword.newPassword', 'New Password')}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pr-10"
                    placeholder={t('resetPassword.passwordPlaceholder', 'Enter new password')}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div>
                <Label>{t('resetPassword.confirmPassword', 'Confirm Password')}</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('resetPassword.confirmPasswordPlaceholder', 'Confirm new password')}
                />
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={form.state.isSubmitting || !form.state.values.password || !form.state.values.confirmPassword} className="w-full">
            {form.state.isSubmitting ? <><div className="spinner mr-2 h-4 w-4" />{t('common.loading', 'Loading...')}</> : t('resetPassword.submit', 'Reset Password')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
