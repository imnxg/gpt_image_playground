import type { TaskParams } from '../../../types'

export type WalmartImageSlotId = 'primary' | 'front' | 'detail' | 'scale' | 'lifestyle'
export type WalmartResolution = '2k' | '4k'

export interface WalmartPromptDraft {
  productTitle: string
  category: string
  brand: string
  color: string
  material: string
  keyFeatures: string
  packageIncludes: string
  targetCustomer: string
  usageScene: string
  forbidden: string
}

export interface WalmartImageSlot {
  id: WalmartImageSlotId
  label: string
  shortLabel: string
  goal: string
  guidance: string[]
}

export const DEFAULT_WALMART_DRAFT: WalmartPromptDraft = {
  productTitle: '',
  category: '',
  brand: '',
  color: '',
  material: '',
  keyFeatures: '',
  packageIncludes: '',
  targetCustomer: '',
  usageScene: '',
  forbidden: '',
}

export const WALMART_IMAGE_SLOTS: WalmartImageSlot[] = [
  {
    id: 'primary',
    label: '主图',
    shortLabel: 'MAIN',
    goal: '搜索与 PDP 首图',
    guidance: [
      'Use a seamless pure white background, RGB 255,255,255.',
      'Square 1:1 composition prepared for a final Walmart asset around 2200x2200 px.',
      'Show the complete sold product clearly, centered and in focus, cropped close to the product without cutting off any edge.',
      'No lifestyle setting, decorative props, duplicate products, badges, price, coupon, shipping claim, review stars, text overlays, watermark, border, or marketplace UI.',
    ],
  },
  {
    id: 'front',
    label: '正面 / 角度图',
    shortLabel: 'ALT 1',
    goal: '补充主体外观',
    guidance: [
      'Show a clear front or three-quarter angle that matches the product title and key attributes.',
      'Keep lighting professional, product truthful, and the frame square.',
      'Use a clean white or very simple studio background unless the product scale requires a natural expected environment.',
      'No duplicate image from the main slot.',
    ],
  },
  {
    id: 'detail',
    label: '细节图',
    shortLabel: 'ALT 2',
    goal: '呈现材质与功能证据',
    guidance: [
      'Focus on one or two important product features, material details, construction, texture, ports, controls, seams, packaging facts, or included components.',
      'Use crisp commercial lighting and realistic product scale.',
      'Keep any on-image copy minimal, natural US English, and factual; avoid unsupported claims.',
    ],
  },
  {
    id: 'scale',
    label: '比例 / 套装图',
    shortLabel: 'ALT 3',
    goal: '表达尺寸或包装清单',
    guidance: [
      'Show believable product scale or all included items from the package contents.',
      'Use only context objects that clarify size and do not imply extra included accessories.',
      'Keep quantity, color, accessories, and variants faithful to the listing facts and reference images.',
    ],
  },
  {
    id: 'lifestyle',
    label: '场景图',
    shortLabel: 'ALT 4',
    goal: '真实使用场景',
    guidance: [
      'Show the product in a deliberate, appropriate lifestyle environment or surface with professional lighting.',
      'Keep the product as the clear hero and reference packaging only when relevant.',
      'Avoid claims, ratings, badges, competitor mentions, promotional text, and anything culturally insensitive or policy-risky.',
    ],
  },
]

const WALMART_COMPLIANCE_GUARD = [
  'Walmart Marketplace compliance guard:',
  '- Images must be accurate, truthful, rights-compliant, and aligned with Marketplace policies.',
  '- Match the product name, type, color, material, key attributes, package contents, and reference images exactly.',
  '- Do not show out-of-stock or sold-out messaging.',
  '- Do not include duplicate images, unrelated props, extra accessories, price, coupon, free shipping, review stars, seller claims, watermarks, borders, QR codes, marketplace badges, Walmart logo, or Walmart UI.',
  '- Avoid obscene, sexually suggestive, vulgar, hateful, violent, discriminatory, culturally insensitive, or unsafe content.',
  '- Produce an RGB square image. Final marketplace asset target: 1:1, seamless white background for main image, recommended 2200x2200 px, zoom-safe at 1500x1500 px or higher, file prepared under 5MB.',
].join('\n')

function normalizeLines(value: string) {
  return value
    .split(/\r?\n|[;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatOptionalLine(label: string, value: string) {
  const text = value.trim()
  return text ? `- ${label}: ${text}` : ''
}

export function getWalmartImageSlot(id: WalmartImageSlotId): WalmartImageSlot {
  return WALMART_IMAGE_SLOTS.find((slot) => slot.id === id) ?? WALMART_IMAGE_SLOTS[0]
}

export function getWalmartRequestParams(resolution: WalmartResolution): Partial<TaskParams> {
  return {
    size: resolution === '4k' ? '4096x4096' : '2048x2048',
    quality: 'high',
    output_format: 'jpeg',
    output_compression: 90,
    transparent_output: false,
    n: 1,
  }
}

export function buildWalmartPrompt(draft: WalmartPromptDraft, slotId: WalmartImageSlotId) {
  const slot = getWalmartImageSlot(slotId)
  const features = normalizeLines(draft.keyFeatures)
  const forbidden = normalizeLines(draft.forbidden)
  const productFacts = [
    formatOptionalLine('Product title', draft.productTitle),
    formatOptionalLine('Category', draft.category),
    formatOptionalLine('Brand or model', draft.brand),
    formatOptionalLine('Color / variant', draft.color),
    formatOptionalLine('Material / finish', draft.material),
    formatOptionalLine('Package includes', draft.packageIncludes),
    formatOptionalLine('Target customer', draft.targetCustomer),
  ].filter(Boolean)

  return [
    'Create a professional Walmart Marketplace product image.',
    '',
    'Product facts:',
    productFacts.length ? productFacts.join('\n') : '- Product title: [exact product name from listing]',
    ...(features.length ? ['', 'Key features to communicate visually:', ...features.map((item) => `- ${item}`)] : []),
    ...(draft.usageScene.trim() ? ['', `Usage scene direction: ${draft.usageScene.trim()}`] : []),
    '',
    `Image slot: ${slot.shortLabel} - ${slot.label} (${slot.goal}).`,
    ...slot.guidance.map((item) => `- ${item}`),
    '',
    WALMART_COMPLIANCE_GUARD,
    ...(forbidden.length ? ['', 'Additional exclusions:', ...forbidden.map((item) => `- ${item}`)] : []),
    '',
    'Rendering requirements:',
    '- Photorealistic commercial product photography, sharp product edges, clean lighting, accurate proportions, no artifacts, no pixelation.',
    '- If reference images are provided, preserve the exact product appearance and do not invent extra parts, logos, accessories, packaging text, or variants.',
  ].join('\n')
}

export function getWalmartComplianceChecks(draft: WalmartPromptDraft, slotId: WalmartImageSlotId, referenceImageCount: number) {
  const slot = getWalmartImageSlot(slotId)
  return [
    {
      label: '商品名称',
      status: draft.productTitle.trim() ? 'ready' : 'missing',
      detail: draft.productTitle.trim() ? '已填写' : '需要准确商品名',
    },
    {
      label: '图片位',
      status: 'ready',
      detail: `${slot.shortLabel} · ${slot.goal}`,
    },
    {
      label: 'Walmart 规格',
      status: 'ready',
      detail: '1:1 / RGB / 2200px 建议 / 1500px Zoom',
    },
    {
      label: '参考图',
      status: referenceImageCount > 0 ? 'ready' : 'warning',
      detail: referenceImageCount > 0 ? `${referenceImageCount} 张参考图` : '建议上传实拍参考图',
    },
    {
      label: '主图白底',
      status: slotId === 'primary' ? 'ready' : 'warning',
      detail: slotId === 'primary' ? '纯白无缝背景' : '附图可按用途选择场景',
    },
  ]
}
