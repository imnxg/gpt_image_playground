import { describe, expect, it } from 'vitest'
import { createStyleReferenceEditStateFromPreset, sanitizeStyleReferenceEditState } from './styleReferences'
import { STYLE_PRESETS } from './stylePresets'

describe('styleReferences', () => {
  it('sanitizes unsafe style reference text and colors', () => {
    const state = sanitizeStyleReferenceEditState({
      title: '夏季 Sale 50%',
      palette: ['ffffff', 'bad', '#111827'],
      typography: 'Amazon badge text',
      lighting: '',
      material: 'Glossy panels',
      density: 'minimal',
    })

    expect(state.title).not.toContain('夏季')
    expect(state.title).not.toContain('50')
    expect(state.palette[0]).toBe('#FFFFFF')
    expect(state.palette[1]).toMatch(/^#[0-9A-F]{6}$/)
    expect(state.density).toBe('minimal')
  })

  it('creates editable state from preset palette', () => {
    const preset = STYLE_PRESETS[0]
    const state = createStyleReferenceEditStateFromPreset(preset)

    expect(state.palette).toEqual(preset.palette)
    expect(state.title).toBeTruthy()
  })
})
