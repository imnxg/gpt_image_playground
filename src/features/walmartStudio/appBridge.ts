import { useEffect, useState } from 'react'
import { normalizeParamsForSettings } from '../../lib/paramCompatibility'
import { validateApiProfile } from '../../lib/apiProfiles'
import type { ApiProfile, AppSettings, InputImage, TaskParams } from '../../types'
import { addImageFromFile, submitTask, useStore } from '../../store'

export { addImageFromFile, useStore }
export { validateApiProfile }

const STORAGE_KEY = 'walmartStudioSettings'
const SETTINGS_EVENT = 'walmart-studio-settings-change'

export interface WalmartStudioSettings {
  plannerProfileId: string | null
}

export function readWalmartStudioSettings(): WalmartStudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const record = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    return {
      plannerProfileId: typeof record.plannerProfileId === 'string' ? record.plannerProfileId : null,
    }
  } catch {
    return {
      plannerProfileId: null,
    }
  }
}

export function setWalmartStudioSettings(patch: Partial<WalmartStudioSettings>) {
  const next = {
    ...readWalmartStudioSettings(),
    ...patch,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))
}

export function useWalmartStudioSettings() {
  const [settings, setSettings] = useState(readWalmartStudioSettings)

  useEffect(() => {
    const update = () => setSettings(readWalmartStudioSettings())
    window.addEventListener(SETTINGS_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(SETTINGS_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return settings
}

export function getWalmartPlannerProfiles(settings: AppSettings): ApiProfile[] {
  return settings.profiles.filter((profile) => profile.provider === 'openai' && profile.apiMode === 'responses')
}

export function getWalmartPlannerProfile(settings: AppSettings, plannerProfileId: string | null): ApiProfile | null {
  const profiles = getWalmartPlannerProfiles(settings)
  return profiles.find((profile) => profile.id === plannerProfileId) ?? profiles.find((profile) => profile.id === settings.activeProfileId) ?? profiles[0] ?? null
}

export function isOfficialDeepSeekPlannerProfile(profile: Pick<ApiProfile, 'provider' | 'baseUrl' | 'apiMode'>): boolean {
  if (profile.provider !== 'openai' || profile.apiMode !== 'responses') return false
  const rawBaseUrl = profile.baseUrl.trim()
  if (!rawBaseUrl) return false

  const input = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(rawBaseUrl)
    ? rawBaseUrl
    : `https://${rawBaseUrl}`

  try {
    return new URL(input).hostname.toLowerCase() === 'api.deepseek.com'
  } catch {
    return /^(?:https?:\/\/)?api\.deepseek\.com(?:[/:]|$)/i.test(rawBaseUrl)
  }
}

export function applyWalmartPromptToInput(prompt: string, params: Partial<TaskParams>) {
  const state = useStore.getState()
  state.setPrompt(prompt)
  state.setParams(params)
}

export async function submitWalmartPrompt(opts: {
  prompt: string
  params: Partial<TaskParams>
  inputImages: InputImage[]
}) {
  const state = useStore.getState()
  const previous = {
    prompt: state.prompt,
    inputImages: state.inputImages,
    params: state.params,
    maskDraft: state.maskDraft,
  }

  state.setPrompt(opts.prompt)
  state.setInputImages(opts.inputImages)
  state.setParams(opts.params)
  state.clearMaskDraft()

  await submitTask()

  const latest = useStore.getState()
  latest.setPrompt(previous.prompt)
  latest.setInputImages(previous.inputImages)
  latest.setParams(normalizeParamsForSettings(previous.params, latest.settings, { hasInputImages: previous.inputImages.length > 0 }))
  latest.setMaskDraft(previous.maskDraft)
}
