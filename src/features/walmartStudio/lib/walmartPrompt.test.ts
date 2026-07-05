import { describe, expect, it } from 'vitest'
import {
  buildWalmartPrompt,
  DEFAULT_WALMART_DRAFT,
  getWalmartComplianceChecks,
  getWalmartRequestParams,
  WALMART_IMAGE_SLOTS,
} from './walmartPrompt'

describe('walmartPrompt', () => {
  it('builds a Walmart primary image prompt with current marketplace constraints', () => {
    const prompt = buildWalmartPrompt({
      ...DEFAULT_WALMART_DRAFT,
      productTitle: 'Stainless Steel Tumbler',
      category: 'Drinkware',
      color: 'Black',
      keyFeatures: 'Leak resistant\nKeeps drinks cold',
    }, 'primary')

    expect(prompt).toContain('Walmart Marketplace product image')
    expect(prompt).toContain('seamless pure white background')
    expect(prompt).toContain('2200x2200')
    expect(prompt).toContain('1500x1500')
    expect(prompt).toContain('under 5MB')
    expect(prompt).toContain('Walmart logo')
    expect(prompt).toContain('Walmart UI')
  })

  it('exposes five default PDP image slots', () => {
    expect(WALMART_IMAGE_SLOTS.map((slot) => slot.id)).toEqual(['primary', 'front', 'detail', 'scale', 'lifestyle'])
  })

  it('uses jpeg square generation params', () => {
    expect(getWalmartRequestParams('2k')).toMatchObject({
      size: '2048x2048',
      output_format: 'jpeg',
      output_compression: 90,
      transparent_output: false,
    })
  })

  it('flags missing product title and reference image warnings', () => {
    const checks = getWalmartComplianceChecks(DEFAULT_WALMART_DRAFT, 'detail', 0)
    expect(checks.find((check) => check.label === '商品名称')?.status).toBe('missing')
    expect(checks.find((check) => check.label === '参考图')?.status).toBe('warning')
  })
})
