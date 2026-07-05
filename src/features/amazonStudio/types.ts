import type { ApiProfile } from '../../types'

export type AmazonStyleDensityMode = 'rich' | 'minimal'

export interface AmazonPlannerSessionDraft {
  productTitle: string
  category: string
  brand: string
  color: string
  material: string
  audience: string
  sellingPoints: string
  packageIncludes: string
  scene: string
  forbidden: string
  kind?: string
}

export interface AmazonPlannerSessionStyleCandidate {
  label: string
  description: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPlannerSessionImagePlan {
  slot: string
  label: string
  kind?: string
  planMarkdown: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPlannerSessionAPlusPlan {
  slot: string
  label: string
  moduleType: string
  uploadSize: string
  generationSize: string
  planMarkdown: string
  textTitle: string
  textBody: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPlannerSessionAPlusModuleSpec {
  contentType: 'standard' | 'standard-large' | 'premium' | 'mobile' | 'optional'
  slot: string
  label: string
  displayLabel: string
  moduleType: string
  uploadWidth: number
  uploadHeight: number
  objective: string
}

export interface AmazonPlannerSessionStyleImage {
  candidateIndex: number
  imageId: string
}

export interface StyleReferenceEditState {
  title: string
  palette: string[]
  typography: string
  lighting: string
  material: string
  density: AmazonStyleDensityMode
}

export interface CustomStyleReference {
  id: string
  basePresetId?: string | null
  title: string
  editState: StyleReferenceEditState
  imageId: string
  createdAt: number
  updatedAt: number
}

export interface AmazonPlannerSession {
  id: string
  title: string
  mode: 'listing' | 'aplus'
  aPlusType: 'standard' | 'standard-large' | 'premium' | 'mobile'
  resolution: '2k' | '4k'
  listingImageCount?: number
  aPlusModuleSpecs?: Partial<Record<'standard' | 'standard-large' | 'premium' | 'mobile', AmazonPlannerSessionAPlusModuleSpec[]>>
  listingText: string
  referenceImageIds: string[]
  draft: AmazonPlannerSessionDraft
  seriesStyleGuides: {
    listing: string
    aplus: string
  }
  styleCandidates: AmazonPlannerSessionStyleCandidate[]
  styleImages: AmazonPlannerSessionStyleImage[]
  selectedStyleIndex: number | null
  selectedStylePresetId?: string | null
  selectedStyleReferenceImageId?: string | null
  selectedCustomStyleReferenceId?: string | null
  selectedCustomStyleReferenceSnapshot?: CustomStyleReference | null
  styleDensityMode?: AmazonStyleDensityMode
  imagePlans: AmazonPlannerSessionImagePlan[]
  aPlusPlans: AmazonPlannerSessionAPlusPlan[]
  selectedPlanIndex: number | null
  selectedAPlusPlanIndex: number | null
  createdAt: number
  updatedAt: number
}

export interface AmazonStudioSettings {
  plannerProfileId: string | null
  customStyleReferences: CustomStyleReference[]
}

export type PlannerApiProfile = ApiProfile
