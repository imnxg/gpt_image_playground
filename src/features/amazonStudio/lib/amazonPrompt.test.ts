import { describe, expect, it } from 'vitest'
import { buildAmazonPrompt, DEFAULT_AMAZON_PROMPT_DRAFT } from './amazonPrompt'

describe('buildAmazonPrompt', () => {
  it('builds a compliant Amazon main image prompt', () => {
    const prompt = buildAmazonPrompt({
      ...DEFAULT_AMAZON_PROMPT_DRAFT,
      productTitle: 'Stainless Steel Water Bottle',
      category: 'Sports bottle',
      color: 'Black',
      sellingPoints: 'Leak proof\nKeeps drinks cold',
    })

    expect(prompt).toContain('Create a professional Amazon product listing image')
    expect(prompt).toContain('Product title: Stainless Steel Water Bottle')
    expect(prompt).toContain('Pure white background')
    expect(prompt).toContain('No Amazon, Prime')
  })
})
