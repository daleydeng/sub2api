/**
 * Admin Settings Store (Zustand)
 * Manages admin settings state with localStorage caching
 */

import { create } from 'zustand'
import { adminAPI } from '@/api'

function readCachedBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    // ignore localStorage failures
  }
  return defaultValue
}

function writeCachedBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    // ignore localStorage failures
  }
}

function readCachedString(key: string, defaultValue: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (typeof raw === 'string' && raw.length > 0) return raw
  } catch {
    // ignore localStorage failures
  }
  return defaultValue
}

function writeCachedString(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore localStorage failures
  }
}

interface AdminSettingsState {
  loaded: boolean
  loading: boolean
  opsMonitoringEnabled: boolean
  opsRealtimeMonitoringEnabled: boolean
  opsQueryModeDefault: string
}

interface AdminSettingsActions {
  fetch: (force?: boolean) => Promise<void>
  setOpsMonitoringEnabledLocal: (value: boolean) => void
  setOpsRealtimeMonitoringEnabledLocal: (value: boolean) => void
  setOpsQueryModeDefaultLocal: (value: string) => void
}

export const useAdminSettingsStore = create<AdminSettingsState & AdminSettingsActions>()(
  (set, get) => ({
    loaded: false,
    loading: false,
    opsMonitoringEnabled: readCachedBool('ops_monitoring_enabled_cached', true),
    opsRealtimeMonitoringEnabled: readCachedBool('ops_realtime_monitoring_enabled_cached', true),
    opsQueryModeDefault: readCachedString('ops_query_mode_default_cached', 'auto'),

    async fetch(force = false): Promise<void> {
      const state = get()
      if (state.loaded && !force) return
      if (state.loading) return

      set({ loading: true })
      try {
        const settings = await adminAPI.settings.getSettings()

        const opsMonitoringEnabled = settings.ops_monitoring_enabled ?? true
        writeCachedBool('ops_monitoring_enabled_cached', opsMonitoringEnabled)

        const opsRealtimeMonitoringEnabled = settings.ops_realtime_monitoring_enabled ?? true
        writeCachedBool('ops_realtime_monitoring_enabled_cached', opsRealtimeMonitoringEnabled)

        const opsQueryModeDefault = settings.ops_query_mode_default || 'auto'
        writeCachedString('ops_query_mode_default_cached', opsQueryModeDefault)

        set({
          opsMonitoringEnabled,
          opsRealtimeMonitoringEnabled,
          opsQueryModeDefault,
          loaded: true,
        })
      } catch (err) {
        set({ loaded: true })
        console.error('[adminSettings] Failed to fetch settings:', err)
      } finally {
        set({ loading: false })
      }
    },

    setOpsMonitoringEnabledLocal(value: boolean) {
      writeCachedBool('ops_monitoring_enabled_cached', value)
      set({ opsMonitoringEnabled: value, loaded: true })
    },

    setOpsRealtimeMonitoringEnabledLocal(value: boolean) {
      writeCachedBool('ops_realtime_monitoring_enabled_cached', value)
      set({ opsRealtimeMonitoringEnabled: value, loaded: true })
    },

    setOpsQueryModeDefaultLocal(value: string) {
      const v = value || 'auto'
      writeCachedString('ops_query_mode_default_cached', v)
      set({ opsQueryModeDefault: v, loaded: true })
    },
  }),
)

// Event listener for ops-monitoring-disabled (from axios interceptor)
if (typeof window !== 'undefined') {
  window.addEventListener('ops-monitoring-disabled', () => {
    useAdminSettingsStore.getState().setOpsMonitoringEnabledLocal(false)
  })
}
