import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiProfile } from '../../../types'
import { callWalmartPlannerApi } from './walmartPlannerApi'

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
      title: 'Stainless Steel Tumbler',
      category: 'Drinkware',
      brand: 'Acme',
      color: 'Black',
      material: 'Steel',
      targetCustomer: 'Adults',
      packageIncludes: 'Tumbler',
    },
    keyFeatures: ['Leak resistant'],
    imagePlans: [
      ['primary', 'MAIN'],
      ['front', 'ALT 1'],
      ['detail', 'ALT 2'],
      ['scale', 'ALT 3'],
      ['lifestyle', 'ALT 4'],
    ].map(([slotId, slot]) => ({
      slotId,
      slot,
      label: slot,
      planMarkdown: `Plan for ${slot}`,
      prompt: `Prompt for ${slot}`,
      negativePrompt: 'No badges.',
    })),
  }
}

describe('callWalmartPlannerApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls Responses API and parses Walmart PDP plans', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify(createPlannerPayload()) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await callWalmartPlannerApi({
      listingText: 'Title: Stainless Steel Tumbler',
      profile,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/v1/responses')
    expect(result.plans).toHaveLength(5)
    expect(result.plans[0]).toMatchObject({
      slotId: 'primary',
      slot: 'MAIN',
    })
    expect(result.parsed.inferred.productTitle).toBe('Stainless Steel Tumbler')
  })
})
