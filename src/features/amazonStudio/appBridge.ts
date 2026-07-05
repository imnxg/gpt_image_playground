import { useEffect, useState } from 'react'
import { validateApiProfile } from '../../lib/apiProfiles'
import { normalizeParamsForSettings } from '../../lib/paramCompatibility'
import { storeImage } from '../../lib/db'
import type { ApiProfile, AppSettings, InputImage, TaskParams } from '../../types'
import { addImageFromFile, ensureImageCached, submitTask, useStore } from '../../store'
import type { AmazonStudioSettings, CustomStyleReference } from './types'

export { addImageFromFile, ensureImageCached, useStore }
export { validateApiProfile }

const STORAGE_KEY = 'amazonStudioSettings'
const SETTINGS_EVENT = 'amazon-studio-settings-change'

function normalizeCustomStyleReferences(value: unknown): CustomStyleReference[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): CustomStyleReference | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<CustomStyleReference>
      if (typeof record.id !== 'string' || !record.id.trim()) return null
      if (typeof record.title !== 'string' || typeof record.imageId !== 'string') return null
      if (!record.editState || typeof record.editState !== 'object') return null
      return {
        id: record.id,
        basePresetId: typeof record.basePresetId === 'string' ? record.basePresetId : null,
        title: record.title,
        editState: record.editState,
        imageId: record.imageId,
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
      } as CustomStyleReference
    })
    .filter((item): item is CustomStyleReference => Boolean(item))
}

export function readAmazonStudioSettings(): AmazonStudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const record = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    return {
      plannerProfileId: typeof record.plannerProfileId === 'string' ? record.plannerProfileId : null,
      customStyleReferences: normalizeCustomStyleReferences(record.customStyleReferences),
    }
  } catch {
    return {
      plannerProfileId: null,
      customStyleReferences: [],
    }
  }
}

export function setAmazonStudioSettings(patch: Partial<AmazonStudioSettings>) {
  const next = {
    ...readAmazonStudioSettings(),
    ...patch,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))
}

export function useAmazonStudioSettings() {
  const [settings, setSettings] = useState(readAmazonStudioSettings)

  useEffect(() => {
    const update = () => setSettings(readAmazonStudioSettings())
    window.addEventListener(SETTINGS_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(SETTINGS_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return settings
}

export function getAmazonPlannerProfiles(settings: AppSettings): ApiProfile[] {
  return settings.profiles.filter((profile) => profile.provider === 'openai' && profile.apiMode === 'responses')
}

export function getAmazonPlannerProfile(settings: AppSettings, plannerProfileId: string | null): ApiProfile | null {
  const profiles = getAmazonPlannerProfiles(settings)
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

export async function storeAmazonGeneratedReferenceImage(dataUrl: string): Promise<string> {
  return storeImage(dataUrl, 'upload')
}

export function applyAmazonPromptToInput(prompt: string, params: Partial<TaskParams>) {
  const state = useStore.getState()
  state.setPrompt(prompt)
  state.setParams(params)
}

export async function submitAmazonPrompt(opts: {
  prompt: string
  params: Partial<TaskParams>
  inputImages: InputImage[]
  styleReferenceImage?: InputImage | null
}) {
  const state = useStore.getState()
  const previous = {
    prompt: state.prompt,
    inputImages: state.inputImages,
    params: state.params,
    maskDraft: state.maskDraft,
  }
  const nextImages = opts.styleReferenceImage && !opts.inputImages.some((img) => img.id === opts.styleReferenceImage?.id)
    ? [...opts.inputImages, opts.styleReferenceImage]
    : opts.inputImages

  state.setPrompt(opts.prompt)
  state.setInputImages(nextImages)
  state.setParams(opts.params)
  state.clearMaskDraft()

  await submitTask()

  const latest = useStore.getState()
  latest.setPrompt(previous.prompt)
  latest.setInputImages(previous.inputImages)
  latest.setParams(normalizeParamsForSettings(previous.params, latest.settings, { hasInputImages: previous.inputImages.length > 0 }))
  latest.setMaskDraft(previous.maskDraft)
  return true
}
