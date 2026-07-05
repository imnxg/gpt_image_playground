import type { ApiProfile } from '../../../types'
import { DEFAULT_RESPONSES_MODEL } from '../../../lib/apiProfiles'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from '../../../lib/devProxy'
import { getApiErrorMessage } from '../../../lib/imageApiShared'
import { isOfficialDeepSeekPlannerProfile } from '../appBridge'
import {
  DEFAULT_WALMART_DRAFT,
  WALMART_IMAGE_SLOTS,
  type WalmartImagePlan,
  type WalmartImageSlotId,
  type WalmartListingParseResult,
  type WalmartPromptDraft,
} from './walmartPrompt'
import {
  isEventStreamResponse,
  looksLikeServerSentEvents,
  readJsonServerSentEvents,
  readJsonServerSentEventText,
} from '../../amazonStudio/lib/serverSentEvents'

interface WalmartPlannerApiPayload {
  product?: {
    title?: string
    category?: string
    brand?: string
    color?: string
    material?: string
    targetCustomer?: string
    packageIncludes?: string
  }
  keyFeatures?: string[]
  imagePlans?: Array<Partial<WalmartImagePlan>>
}

export interface WalmartPlannerApiResult {
  parsed: WalmartListingParseResult
  plans: WalmartImagePlan[]
}

const DEEPSEEK_TEXT_ONLY_PLANNER_GUARD = 'Because DeepSeek cannot receive or understand reference images in this request, do not infer or describe product facts that are not explicitly present in the listing text or user-provided product facts. Do not invent colors, shapes, structures, accessories, logos, bundle quantity, package contents, materials, printed text, ports, buttons, or product variants. If a visual detail is unknown, keep the prompt neutral and refer to the exact product described by the provided facts.'

const PRODUCT_REFERENCE_FACTS_ONLY_PLANNER_GUIDE = [
  'Product reference image rule:',
  '- Use product reference images only to identify product facts: real appearance, color, shape, structure, included accessories, materials, package contents, and feature evidence.',
  '- Do not use product reference images to choose unsupported product facts, promotional claims, badges, ratings, or extra accessories.',
  '- Keep every plan truthful to the pasted Walmart listing and user-provided product facts.',
].join('\n')

const PRODUCT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    brand: { type: 'string' },
    color: { type: 'string' },
    material: { type: 'string' },
    targetCustomer: { type: 'string' },
    packageIncludes: { type: 'string' },
  },
  required: ['title', 'category', 'brand', 'color', 'material', 'targetCustomer', 'packageIncludes'],
} as const

const WALMART_PLANNER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product: PRODUCT_SCHEMA,
    keyFeatures: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: { type: 'string' },
    },
    imagePlans: {
      type: 'array',
      minItems: WALMART_IMAGE_SLOTS.length,
      maxItems: WALMART_IMAGE_SLOTS.length,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          slotId: { type: 'string', enum: WALMART_IMAGE_SLOTS.map((slot) => slot.id) },
          slot: { type: 'string', enum: WALMART_IMAGE_SLOTS.map((slot) => slot.shortLabel) },
          label: {
            type: 'string',
            description: 'Concise Simplified Chinese label for UI display.',
          },
          planMarkdown: {
            type: 'string',
            description: 'Detailed Simplified Chinese planning write-up for this slot. Markdown is allowed.',
          },
          prompt: {
            type: 'string',
            description: 'Professional English image-generation prompt only. Never include Chinese characters.',
          },
          negativePrompt: {
            type: 'string',
            description: 'English negative prompt for the image model. Never include Chinese characters.',
          },
        },
        required: ['slotId', 'slot', 'label', 'planMarkdown', 'prompt', 'negativePrompt'],
      },
    },
  },
  required: ['product', 'keyFeatures', 'imagePlans'],
} as const

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getStringValue(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value ? value : undefined
}

function extractResponseText(payload: unknown): string {
  if (!isRecordValue(payload)) return ''
  if (typeof payload.output_text === 'string') return payload.output_text

  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const chatChunks: string[] = []
  for (const choice of choices) {
    if (!isRecordValue(choice)) continue
    if (isRecordValue(choice.message)) {
      const content = choice.message.content
      if (typeof content === 'string') chatChunks.push(content)
      else if (Array.isArray(content)) {
        for (const part of content) {
          if (isRecordValue(part) && typeof part.text === 'string') chatChunks.push(part.text)
        }
      }
    }
    if (isRecordValue(choice.delta) && typeof choice.delta.content === 'string') chatChunks.push(choice.delta.content)
  }
  if (chatChunks.length) return chatChunks.join('\n').trim()

  const output = Array.isArray(payload.output) ? payload.output : []
  const chunks: string[] = []
  for (const item of output) {
    if (!isRecordValue(item) || !Array.isArray(item.content)) continue
    for (const part of item.content) {
      if (isRecordValue(part) && typeof part.text === 'string') chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}

function getPlannerPayloadFromEvent(event: Record<string, unknown>): unknown {
  if (isRecordValue(event.response)) return event.response
  if (isRecordValue(event.item)) return { output: [event.item] }
  return null
}

function getPlannerTextFromEvent(event: Record<string, unknown>): string {
  const directText = extractResponseText(event)
  if (directText) return directText

  const payloadText = extractResponseText(getPlannerPayloadFromEvent(event))
  if (payloadText) return payloadText

  const text = getStringValue(event, 'text')
  if (text) return text

  if (isRecordValue(event.part)) {
    const partText = getStringValue(event.part, 'text')
    if (partText) return partText
  }

  return ''
}

async function readPlannerTextFromSseResponse(response: Response): Promise<string> {
  let completedText = ''
  let outputItemText = ''
  let doneText = ''
  let deltaText = ''

  await readJsonServerSentEvents(response, (event) => {
    const type = getStringValue(event, 'type')
    if (type === 'response.output_text.delta') {
      deltaText += getStringValue(event, 'delta') ?? ''
      return
    }

    const text = getPlannerTextFromEvent(event)
    if (!text) return

    if (type === 'response.completed') completedText = text
    else if (type === 'response.output_item.done') outputItemText = text
    else if (type === 'response.output_text.done' || type === 'response.content_part.done') doneText = text
    else if (!type) deltaText += text
  })

  return completedText.trim() || outputItemText.trim() || doneText.trim() || deltaText.trim()
}

async function readPlannerTextFromSseText(rawText: string): Promise<string> {
  let completedText = ''
  let outputItemText = ''
  let doneText = ''
  let deltaText = ''

  await readJsonServerSentEventText(rawText, (event) => {
    const type = getStringValue(event, 'type')
    if (type === 'response.output_text.delta') {
      deltaText += getStringValue(event, 'delta') ?? ''
      return
    }

    const text = getPlannerTextFromEvent(event)
    if (!text) return

    if (type === 'response.completed') completedText = text
    else if (type === 'response.output_item.done') outputItemText = text
    else if (type === 'response.output_text.done' || type === 'response.content_part.done') doneText = text
    else if (!type) deltaText += text
  })

  return completedText.trim() || outputItemText.trim() || doneText.trim() || deltaText.trim()
}

function truncateForError(text: string) {
  const trimmed = text.trim()
  if (trimmed.length <= 1200) return trimmed
  return `${trimmed.slice(0, 1200)}...`
}

async function readPlannerResponseText(response: Response): Promise<string> {
  if (isEventStreamResponse(response)) {
    const text = await readPlannerTextFromSseResponse(response)
    if (!text) throw new Error('AI 策划流式接口未返回文本内容')
    return text
  }

  const rawText = await response.text()
  if (!rawText.trim()) throw new Error('AI 策划接口返回空内容')

  if (looksLikeServerSentEvents(rawText)) {
    const text = await readPlannerTextFromSseText(rawText)
    if (!text) throw new Error('AI 策划流式接口未返回文本内容')
    return text
  }

  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json') && !contentType.includes('+json') && !/^[{\[]/.test(rawText.trimStart())) {
    throw new Error(`AI 策划接口返回了非 JSON 内容：${truncateForError(rawText)}`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawText)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`AI 策划接口返回了无法解析的 JSON：${message}\n\n${truncateForError(rawText)}`)
  }

  const text = extractResponseText(payload)
  if (!text) throw new Error('AI 策划接口未返回文本内容')
  return text
}

function parsePlannerPayload(text: string): WalmartPlannerApiPayload {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  return JSON.parse(fenced ?? trimmed) as WalmartPlannerApiPayload
}

function normalizeSlotId(value: unknown, index: number): WalmartImageSlotId {
  if (typeof value === 'string' && WALMART_IMAGE_SLOTS.some((slot) => slot.id === value)) {
    return value as WalmartImageSlotId
  }
  return WALMART_IMAGE_SLOTS[index]?.id ?? 'primary'
}

function normalizeParsedListing(payload: WalmartPlannerApiPayload): WalmartListingParseResult {
  const product = payload.product ?? {}
  const keyFeatures = Array.isArray(payload.keyFeatures)
    ? payload.keyFeatures.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 6)
    : []

  if (!product.title?.trim()) throw new Error('AI 策划结果缺少商品标题')

  return {
    title: product.title.trim(),
    bullets: keyFeatures,
    inferred: {
      productTitle: product.title.trim(),
      category: product.category?.trim() ?? '',
      brand: product.brand?.trim() ?? '',
      color: product.color?.trim() ?? '',
      material: product.material?.trim() ?? '',
      targetCustomer: product.targetCustomer?.trim() ?? '',
      packageIncludes: product.packageIncludes?.trim() ?? '',
      keyFeatures: keyFeatures.join('\n'),
    },
  }
}

function normalizePlan(plan: Partial<WalmartImagePlan> | undefined, index: number): WalmartImagePlan {
  const slot = WALMART_IMAGE_SLOTS[index] ?? WALMART_IMAGE_SLOTS[0]
  const slotId = normalizeSlotId(plan?.slotId, index)
  const slotMeta = WALMART_IMAGE_SLOTS.find((item) => item.id === slotId) ?? slot
  return {
    slotId,
    slot: plan?.slot || slotMeta.shortLabel,
    label: plan?.label || slotMeta.label,
    planMarkdown: plan?.planMarkdown || '',
    prompt: plan?.prompt || '',
    negativePrompt: plan?.negativePrompt || '',
  }
}

function normalizePlannerApiPayload(payload: WalmartPlannerApiPayload): WalmartPlannerApiResult {
  const parsed = normalizeParsedListing(payload)
  const rawPlans = Array.isArray(payload.imagePlans) ? payload.imagePlans : []
  if (rawPlans.length !== WALMART_IMAGE_SLOTS.length) throw new Error(`AI 策划结果不是 ${WALMART_IMAGE_SLOTS.length} 张图`)

  const plans = WALMART_IMAGE_SLOTS.map((slot, index) => {
    const bySlot = rawPlans.find((plan) => plan?.slotId === slot.id || plan?.slot === slot.shortLabel)
    return normalizePlan(bySlot ?? rawPlans[index], index)
  })
  const emptyPrompt = plans.find((plan) => !plan.prompt.trim())
  if (emptyPrompt) throw new Error(`AI 策划结果缺少 ${emptyPrompt.slot} 的提示词`)
  const emptyPlan = plans.find((plan) => !plan.planMarkdown.trim())
  if (emptyPlan) throw new Error(`AI 策划结果缺少 ${emptyPlan.slot} 的策划说明`)

  return {
    parsed,
    plans,
  }
}

function formatDraftFact(label: string, value: string) {
  const trimmed = value.trim()
  return trimmed ? `- ${label}: ${trimmed}` : ''
}

function buildUserProductFactsText(baseDraft: WalmartPromptDraft) {
  const facts = [
    formatDraftFact('Product title', baseDraft.productTitle),
    formatDraftFact('Category', baseDraft.category),
    formatDraftFact('Brand or model', baseDraft.brand),
    formatDraftFact('Color / variant', baseDraft.color),
    formatDraftFact('Material / finish', baseDraft.material),
    formatDraftFact('Target customer', baseDraft.targetCustomer),
    formatDraftFact('Package includes', baseDraft.packageIncludes),
    formatDraftFact('Key features', baseDraft.keyFeatures),
    formatDraftFact('Usage scene direction', baseDraft.usageScene),
    formatDraftFact('Do not show / avoid', baseDraft.forbidden),
  ].filter(Boolean)

  return facts.length
    ? ['User-provided product facts. Treat these as authoritative and do not contradict them:', ...facts].join('\n')
    : ''
}

function buildPlannerInstructions(baseDraft: WalmartPromptDraft, textOnlyReferenceGuard: boolean) {
  return [
    'You are a Walmart Marketplace PDP image-planning agent. The user provides Walmart listing copy and optional product reference images.',
    `Create a complete visual plan for exactly ${WALMART_IMAGE_SLOTS.length} Walmart PDP image slots in this order: ${WALMART_IMAGE_SLOTS.map((slot) => `${slot.shortLabel} ${slot.label}`).join(', ')}.`,
    'The application fixes the slot order only. You must decide the strategy, composition, product evidence, copy approach, prompt content, and negative prompt content.',
    'Walmart image requirements:',
    '- Main image must use a seamless pure white RGB background, show the complete sold product clearly, and avoid text overlays, badges, props, borders, watermarks, marketplace UI, price, coupons, shipping claims, or review stars.',
    '- Alternate images may show angle, detail, scale/package contents, or lifestyle use, but must stay truthful to the listing and reference images.',
    '- Keep all image prompts square 1:1, professional commercial product photography, zoom-safe, realistic, rights-compliant, and free of unsupported claims.',
    '- Do not include Walmart logo, Walmart UI, seller badges, QR codes, competitor names, ratings, obscene content, hateful content, unsafe use, or culturally insensitive content.',
    PRODUCT_REFERENCE_FACTS_ONLY_PLANNER_GUIDE,
    textOnlyReferenceGuard ? DEEPSEEK_TEXT_ONLY_PLANNER_GUARD : '',
    'For each slot, write planMarkdown in Simplified Chinese as a detailed agent-style plan, then write a professional English image prompt and English negative prompt.',
    'Field language rules: label and planMarkdown must be Simplified Chinese; prompt and negativePrompt must be English.',
    'Do not generate images. Only return JSON matching the schema.',
    baseDraft.category ? `Known category: ${baseDraft.category}` : '',
  ].filter(Boolean).join('\n')
}

function buildPlannerInputText(listingText: string, includeReferenceImageInstruction: boolean, userProductFacts: string) {
  return [
    'Parse this Walmart listing copy and produce the five-image PDP visual plan.',
    'Use the title, bullets, specifications, and package contents from the pasted text. If a field is uncertain, infer conservatively from the listing.',
    includeReferenceImageInstruction ? 'If reference images are attached, use them to understand the actual product appearance and included items.' : '',
    userProductFacts,
    '',
    listingText,
  ].filter((item) => item !== '').join('\n')
}

function buildResponsesPlannerInput(text: string, referenceImageDataUrls: string[]) {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text,
        },
        ...referenceImageDataUrls.map((url) => ({
          type: 'input_image',
          image_url: url,
        })),
      ],
    },
  ]
}

export async function callWalmartPlannerApi(options: {
  listingText: string
  baseDraft?: WalmartPromptDraft
  profile: ApiProfile
  referenceImageDataUrls?: string[]
  model?: string
  signal?: AbortSignal
}): Promise<WalmartPlannerApiResult> {
  const baseDraft = options.baseDraft ?? DEFAULT_WALMART_DRAFT
  const model = options.model?.trim() || options.profile.model.trim() || DEFAULT_RESPONSES_MODEL
  const proxyConfig = readClientDevProxyConfig()
  const useApiProxy = shouldUseApiProxy(options.profile.apiProxy, proxyConfig)
  const isDeepSeekPlannerProfile = isOfficialDeepSeekPlannerProfile(options.profile)
  const inputText = buildPlannerInputText(
    options.listingText,
    !isDeepSeekPlannerProfile,
    isDeepSeekPlannerProfile ? buildUserProductFactsText(baseDraft) : '',
  )
  const referenceImageDataUrls = isDeepSeekPlannerProfile ? [] : options.referenceImageDataUrls ?? []
  const response = await fetch(
    buildApiUrl(options.profile.baseUrl, 'responses', proxyConfig, useApiProxy),
    {
      method: 'POST',
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${options.profile.apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        model,
        instructions: buildPlannerInstructions(baseDraft, isDeepSeekPlannerProfile),
        input: buildResponsesPlannerInput(inputText, referenceImageDataUrls),
        text: {
          format: {
            type: 'json_schema',
            name: 'walmart_pdp_image_plan',
            strict: true,
            schema: WALMART_PLANNER_SCHEMA,
          },
        },
        stream: false,
      }),
    },
  )

  if (!response.ok) {
    const message = await getApiErrorMessage(response)
    throw new Error(`HTTP ${response.status}: ${message}`)
  }
  const text = await readPlannerResponseText(response)
  return normalizePlannerApiPayload(parsePlannerPayload(text))
}
