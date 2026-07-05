import { describe, expect, it } from 'vitest'
import {
  buildAmazonAPlusPlanPrompt,
  buildAmazonPlanPrompt,
  getAmazonListingImageSlots,
  getAPlusModuleGenerationSize,
  normalizeAPlusModuleSpecs,
  normalizeListingImageCount,
} from './listingPlanner'

describe('listingPlanner', () => {
  it('normalizes listing image count and slot names', () => {
    expect(normalizeListingImageCount(3)).toBe(7)
    expect(normalizeListingImageCount(20)).toBe(12)
    expect(getAmazonListingImageSlots(8)).toEqual(['MAIN', 'PT01', 'PT02', 'PT03', 'PT04', 'PT05', 'PT06', 'PT07'])
  })

  it('builds listing prompts with style reference guidance', () => {
    const prompt = buildAmazonPlanPrompt({
      prompt: 'Photorealistic product photo.',
      negativePrompt: 'No badges.',
      seriesStyleGuide: 'Consistent clean studio lighting.',
      styleReferenceAttached: true,
      styleDensityMode: 'minimal',
      selectedVisualStyle: {
        label: 'Clean tech',
        description: 'Clean tech style.',
        palette: ['#FFFFFF', '#111827'],
      },
    })

    expect(prompt).toContain('Photorealistic product photo.')
    expect(prompt).toContain('Style reference rule')
    expect(prompt).toContain('Clean tech style.')
    expect(prompt).toContain('No badges.')
  })

  it('normalizes A+ modules and generation sizes', () => {
    const specs = normalizeAPlusModuleSpecs('mobile', [{ slot: 'A+M01', uploadWidth: 600, uploadHeight: 450 }])
    expect(specs[0].slot).toBe('A+M01')
    expect(getAPlusModuleGenerationSize(specs[0], '2K')).toMatch(/x/)

    const prompt = buildAmazonAPlusPlanPrompt({
      prompt: 'Premium A+ module image.',
      negativePrompt: 'No QR code.',
      seriesStyleGuide: 'Balanced brand system.',
      styleReferenceAttached: false,
      styleDensityMode: 'rich',
      selectedVisualStyle: null,
    })
    expect(prompt).toContain('Premium A+ module image.')
    expect(prompt).toContain('No QR code.')
  })
})
