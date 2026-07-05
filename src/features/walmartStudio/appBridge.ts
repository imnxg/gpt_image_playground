import { normalizeParamsForSettings } from '../../lib/paramCompatibility'
import type { InputImage, TaskParams } from '../../types'
import { addImageFromFile, submitTask, useStore } from '../../store'

export { addImageFromFile, useStore }

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
