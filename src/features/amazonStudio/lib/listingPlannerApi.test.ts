import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiProfile } from '../../../types'
import { callAmazonPlannerApi } from './listingPlannerApi'

const profile: ApiProfile = {
  id: 'planner',
  name: 'Planner',
  provider: 'openai',
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'key',
  model: 'gpt-5.5',
  timeout: 600,
  apiMode: 'responses',
  codexCli: false,
  apiProxy: false,
}

function createPlannerPayload() {
  return {
    product: {
      title: 'Water Bottle',
      category: 'Sports',
      brand: 'Acme',
      color: 'Black',
      material: 'Steel',
      audience: 'Adults',
      packageIncludes: 'Bottle',
    },
    sellingPoints: ['Leak proof'],
    seriesStyleGuide: 'Clean studio lighting.',
    imagePlans: ['MAIN', 'PT01', 'PT02', 'PT03', 'PT04', 'PT05', 'PT06'].map((slot) => ({
      slot,
      label: slot,
      planMarkdown: `Plan for ${slot}`,
      prompt: `Prompt for ${slot}`,
      negativePrompt: 'No badges.',
    })),
  }
}

describe('callAmazonPlannerApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls Responses API and parses listing plans', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify(createPlannerPayload()) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await callAmazonPlannerApi({
      listingText: 'Title: Water Bottle',
      baseDraft: {
        kind: 'main',
        productTitle: 'Water Bottle',
        category: 'Sports',
        brand: 'Acme',
        color: 'Black',
        material: 'Steel',
        sellingPoints: 'Leak proof',
        packageIncludes: 'Bottle',
        scene: '',
        forbidden: '',
        audience: 'Adults',
      },
      profile,
      listingImageCount: 7,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/responses')
    expect(result.mode).toBe('listing')
    expect(result.plans).toHaveLength(7)
    expect(result.plans[0].slot).toBe('MAIN')
  })
})
