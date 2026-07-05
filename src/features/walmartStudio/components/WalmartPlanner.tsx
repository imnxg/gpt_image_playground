import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { addImageFromFile, applyWalmartPromptToInput, submitWalmartPrompt, useStore } from '../appBridge'
import {
  buildWalmartPrompt,
  DEFAULT_WALMART_DRAFT,
  getWalmartComplianceChecks,
  getWalmartRequestParams,
  WALMART_IMAGE_SLOTS,
  type WalmartImageSlotId,
  type WalmartPromptDraft,
  type WalmartResolution,
} from '../lib/walmartPrompt'
import { CloseIcon, CopyIcon, PhotoIcon, RefreshIcon } from '../../../components/icons'

const FIELD_CLASS = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400'
const API_MAX_IMAGES = 16

function updateDraft<K extends keyof WalmartPromptDraft>(
  draft: WalmartPromptDraft,
  key: K,
  value: WalmartPromptDraft[K],
) {
  return { ...draft, [key]: value }
}

function getCheckClass(status: string) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
  if (status === 'missing') return 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200'
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'
}

export default function WalmartPlanner() {
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const showToast = useStore((s) => s.showToast)
  const [draft, setDraft] = useState<WalmartPromptDraft>(DEFAULT_WALMART_DRAFT)
  const [slotId, setSlotId] = useState<WalmartImageSlotId>('primary')
  const [resolution, setResolution] = useState<WalmartResolution>('2k')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prompt = useMemo(() => buildWalmartPrompt(draft, slotId), [draft, slotId])
  const params = useMemo(() => getWalmartRequestParams(resolution), [resolution])
  const checks = useMemo(() => getWalmartComplianceChecks(draft, slotId, inputImages.length), [draft, slotId, inputImages.length])
  const selectedSlot = WALMART_IMAGE_SLOTS.find((slot) => slot.id === slotId) ?? WALMART_IMAGE_SLOTS[0]

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = API_MAX_IMAGES - inputImages.length
    const selected = Array.from(files).slice(0, Math.max(0, remaining))
    if (!selected.length) {
      showToast(`参考图最多 ${API_MAX_IMAGES} 张`, 'error')
      return
    }
    for (const file of selected) {
      try {
        await addImageFromFile(file)
      } catch (err) {
        showToast(`图片添加失败：${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    }
    if (files.length > selected.length) showToast(`最多添加 ${API_MAX_IMAGES} 张参考图`, 'info')
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files)
    event.target.value = ''
  }

  const applyPrompt = () => {
    applyWalmartPromptToInput(prompt, params)
    showToast('已填入 Walmart 图片提示词', 'success')
  }

  const submitPrompt = async () => {
    if (!draft.productTitle.trim()) {
      showToast('请先填写商品名称', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await submitWalmartPrompt({ prompt, params, inputImages })
      showToast('Walmart 图片任务已提交', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      showToast('提示词已复制', 'success')
    } catch {
      showToast('复制失败，请手动选择提示词', 'error')
    }
  }

  const reset = () => {
    setDraft(DEFAULT_WALMART_DRAFT)
    setSlotId('primary')
    setResolution('2k')
    showToast('Walmart 工作台已清空', 'info')
  }

  return (
    <section className="pt-6 lg:pt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Walmart 图片工作台</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">PDP 主图与附图策划 · 1:1 · RGB · 2200px 推荐</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-white/[0.04]"
          >
            <CopyIcon className="h-4 w-4" />
            复制
          </button>
          <button
            type="button"
            onClick={applyPrompt}
            className="inline-flex h-10 items-center rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-400/25 dark:bg-gray-950 dark:text-blue-200 dark:hover:bg-blue-400/10"
          >
            填入输入栏
          </button>
          <button
            type="button"
            onClick={submitPrompt}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:bg-gray-400"
          >
            {isSubmitting ? '提交中...' : '一键提交'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">商品信息</div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                重置
              </button>
            </div>
            <div className="grid gap-3">
              <label>
                <span className={LABEL_CLASS}>商品名称</span>
                <input value={draft.productTitle} onChange={(event) => setDraft(updateDraft(draft, 'productTitle', event.target.value))} className={FIELD_CLASS} placeholder="Exact product title" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={LABEL_CLASS}>类目</span>
                  <input value={draft.category} onChange={(event) => setDraft(updateDraft(draft, 'category', event.target.value))} className={FIELD_CLASS} placeholder="Category" />
                </label>
                <label>
                  <span className={LABEL_CLASS}>品牌 / 型号</span>
                  <input value={draft.brand} onChange={(event) => setDraft(updateDraft(draft, 'brand', event.target.value))} className={FIELD_CLASS} placeholder="Brand or model" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={LABEL_CLASS}>颜色 / 变体</span>
                  <input value={draft.color} onChange={(event) => setDraft(updateDraft(draft, 'color', event.target.value))} className={FIELD_CLASS} placeholder="Color" />
                </label>
                <label>
                  <span className={LABEL_CLASS}>材质 / 表面</span>
                  <input value={draft.material} onChange={(event) => setDraft(updateDraft(draft, 'material', event.target.value))} className={FIELD_CLASS} placeholder="Material" />
                </label>
              </div>
              <label>
                <span className={LABEL_CLASS}>核心卖点</span>
                <textarea value={draft.keyFeatures} onChange={(event) => setDraft(updateDraft(draft, 'keyFeatures', event.target.value))} className={`${FIELD_CLASS} min-h-20 resize-y`} placeholder="- Feature 1&#10;- Feature 2" />
              </label>
              <label>
                <span className={LABEL_CLASS}>包装清单</span>
                <input value={draft.packageIncludes} onChange={(event) => setDraft(updateDraft(draft, 'packageIncludes', event.target.value))} className={FIELD_CLASS} placeholder="What is included" />
              </label>
              <label>
                <span className={LABEL_CLASS}>目标用户</span>
                <input value={draft.targetCustomer} onChange={(event) => setDraft(updateDraft(draft, 'targetCustomer', event.target.value))} className={FIELD_CLASS} placeholder="Target customer" />
              </label>
              <label>
                <span className={LABEL_CLASS}>场景方向</span>
                <input value={draft.usageScene} onChange={(event) => setDraft(updateDraft(draft, 'usageScene', event.target.value))} className={FIELD_CLASS} placeholder="Optional usage scene" />
              </label>
              <label>
                <span className={LABEL_CLASS}>禁用元素</span>
                <textarea value={draft.forbidden} onChange={(event) => setDraft(updateDraft(draft, 'forbidden', event.target.value))} className={`${FIELD_CLASS} min-h-16 resize-y`} placeholder="Exclude visual risks" />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">产品参考图</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{inputImages.length}/{API_MAX_IMAGES} 张</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              >
                <PhotoIcon className="h-4 w-4" />
                添加
              </button>
            </div>
            {inputImages.length ? (
              <div className="grid grid-cols-4 gap-2">
                {inputImages.map((image, index) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <button type="button" onClick={() => setLightboxImageId(image.id, inputImages.map((item) => item.id))} className="h-full w-full">
                      <img src={image.dataUrl} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeInputImage(index)}
                      className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      title="移除"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500 dark:border-white/[0.08] dark:text-gray-400">
                建议上传真实产品图以锁定颜色、结构、配件和包装事实
              </div>
            )}
            {inputImages.length > 0 && (
              <button type="button" onClick={clearInputImages} className="mt-3 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-300">
                清空参考图
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">图片位</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{selectedSlot.shortLabel} · {selectedSlot.goal}</div>
              </div>
              <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/[0.04]">
                {(['2k', '4k'] as WalmartResolution[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setResolution(item)}
                    className={`h-8 rounded-md px-3 text-xs font-semibold transition ${resolution === item ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {WALMART_IMAGE_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotId(slot.id)}
                  className={`min-h-[70px] rounded-lg border px-3 py-2 text-left transition ${slotId === slot.id ? 'border-blue-300 bg-blue-50 text-blue-900 ring-2 ring-blue-500/10 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-100' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/[0.04]'}`}
                >
                  <div className="text-xs font-black">{slot.shortLabel}</div>
                  <div className="mt-1 text-sm font-semibold">{slot.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            {checks.map((check) => (
              <div key={check.label} className={`rounded-lg border px-3 py-2 ${getCheckClass(check.status)}`}>
                <div className="text-xs font-bold">{check.label}</div>
                <div className="mt-1 text-[11px] leading-snug opacity-85">{check.detail}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-950">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">生成提示词</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{params.size} · JPEG · 90</div>
            </div>
            <textarea value={prompt} readOnly className={`${FIELD_CLASS} min-h-[460px] resize-y font-mono text-xs leading-relaxed`} />
          </div>
        </div>
      </div>
    </section>
  )
}
