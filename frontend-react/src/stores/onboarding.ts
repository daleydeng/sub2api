/**
 * Onboarding Store (Zustand)
 * Manages onboarding tour state and control methods
 */

import { create } from 'zustand'
type Driver = {
  isActive?: () => boolean
  [key: string]: unknown
}

type VoidCallback = () => void
type NextStepCallback = (delay?: number) => Promise<void>
type IsCurrentStepCallback = (selector: string) => boolean

interface OnboardingState {
  _replayCallback: VoidCallback | null
  _nextStepCallback: NextStepCallback | null
  _isCurrentStepCallback: IsCurrentStepCallback | null
  _driverInstance: Driver | null
}

interface OnboardingActions {
  setReplayCallback: (callback: VoidCallback | null) => void
  setControlMethods: (methods: {
    nextStep: NextStepCallback
    isCurrentStep: IsCurrentStepCallback
  }) => void
  clearControlMethods: () => void
  setDriverInstance: (driver: Driver | null) => void
  getDriverInstance: () => Driver | null
  isDriverActive: () => boolean
  replay: () => void
  nextStep: (delay?: number) => Promise<void>
  isCurrentStep: (selector: string) => boolean
}

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()((set, get) => ({
  _replayCallback: null,
  _nextStepCallback: null,
  _isCurrentStepCallback: null,
  _driverInstance: null,

  setReplayCallback(callback) {
    set({ _replayCallback: callback })
  },

  setControlMethods(methods) {
    set({
      _nextStepCallback: methods.nextStep,
      _isCurrentStepCallback: methods.isCurrentStep,
    })
  },

  clearControlMethods() {
    set({ _nextStepCallback: null, _isCurrentStepCallback: null })
  },

  setDriverInstance(driver) {
    set({ _driverInstance: driver })
  },

  getDriverInstance() {
    return get()._driverInstance
  },

  isDriverActive() {
    return get()._driverInstance?.isActive?.() ?? false
  },

  replay() {
    get()._replayCallback?.()
  },

  async nextStep(delay = 0) {
    const cb = get()._nextStepCallback
    if (cb) await cb(delay)
  },

  isCurrentStep(selector: string) {
    const cb = get()._isCurrentStepCallback
    return cb ? cb(selector) : false
  },
}))
