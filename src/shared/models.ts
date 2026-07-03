import { PEKPIK_MODELS, isPekpikDeepSeekModel } from './pekpikModels'

export type AiProvider = 'gemini' | 'groq' | 'grok' | 'cerebras' | 'other' | 'custom'

export interface CustomPreset {
  id: string
  label: string
  baseUrl: string
  model: string
}

export const CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: 'zai-general',
    label: 'Z.AI General',
    baseUrl: 'https://api.z.ai/api/paas/v4/',
    model: 'glm-5.2'
  },
  {
    id: 'zai-coding',
    label: 'Z.AI Coding Plan',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4/',
    model: 'glm-5.2'
  }
]

export const DEFAULT_CUSTOM_BASE_URL = CUSTOM_PRESETS[0].baseUrl

export interface ProviderInfo {
  id: AiProvider
  label: string
  keyUrl: string
}

export interface ModelInfo {
  id: string
  label: string
  supportsThinking?: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', label: 'Groq', keyUrl: 'https://console.groq.com/keys' },
  { id: 'grok', label: 'xAI Grok', keyUrl: 'https://console.x.ai' },
  { id: 'cerebras', label: 'Cerebras', keyUrl: 'https://cloud.cerebras.ai' },
  {
    id: 'other',
    label: 'Other',
    keyUrl: 'https://github.com/alistaitsacle/free-llm-api-keys'
  },
  { id: 'custom', label: 'OpenAI Compatible', keyUrl: 'https://docs.z.ai/' }
]

export const MODELS_BY_PROVIDER: Record<AiProvider, ModelInfo[]> = {
  gemini: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', supportsThinking: true },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', supportsThinking: true },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', supportsThinking: true },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', supportsThinking: true },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', supportsThinking: true },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
    { id: 'qwen/qwen3-32b', label: 'Qwen3 32B' }
  ],
  grok: [
    { id: 'grok-4.3', label: 'Grok 4.3', supportsThinking: true },
    { id: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast (Reasoning)', supportsThinking: true },
    { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast' },
    { id: 'grok-3-mini', label: 'Grok 3 Mini' },
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1' }
  ],
  cerebras: [
    { id: 'gpt-oss-120b', label: 'GPT OSS 120B' },
    { id: 'zai-glm-4.7', label: 'Z.ai GLM 4.7', supportsThinking: true }
  ],
  other: PEKPIK_MODELS,
  custom: []
}

export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  grok: 'grok-4.3',
  cerebras: 'gpt-oss-120b',
  other: 'deepseek-chat',
  custom: 'glm-5.2'
}

export const TEST_MODEL_BY_PROVIDER: Record<Exclude<AiProvider, 'custom'>, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.1-8b-instant',
  grok: 'grok-3-mini',
  cerebras: 'gpt-oss-120b',
  other: 'deepseek-chat'
}

export const BASE_URL_BY_PROVIDER: Partial<Record<AiProvider, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  grok: 'https://api.x.ai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  other: 'https://aiapiv2.pekpik.com/v1'
}

export function getDefaultModel(provider: AiProvider): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider]
}

export function getModelLabel(provider: AiProvider, modelId: string): string {
  const model = MODELS_BY_PROVIDER[provider].find((m) => m.id === modelId)
  return model?.label ?? modelId
}

export function getProviderInfo(provider: AiProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]
}

export function providerSupportsThinking(
  provider: AiProvider,
  modelId?: string,
  customSupportsThinking?: boolean
): boolean {
  if (provider === 'gemini') return true
  if (provider === 'groq') return false
  if (provider === 'custom') return customSupportsThinking ?? false
  if (modelId) {
    const model = MODELS_BY_PROVIDER[provider].find((m) => m.id === modelId)
    return model?.supportsThinking ?? false
  }
  if (provider === 'other') return false
  return false
}

export { isPekpikDeepSeekModel }

export function getApiKeyPlaceholder(provider: AiProvider): string {
  switch (provider) {
    case 'gemini':
      return 'AIza...'
    case 'groq':
      return 'gsk_...'
    case 'grok':
      return 'xai-...'
    case 'cerebras':
      return 'csk-...'
    case 'other':
      return 'sk-...'
    case 'custom':
      return 'Z.AI API key...'
    default:
      return 'API key...'
  }
}

export function getModelsForProvider(provider: AiProvider): ModelInfo[] {
  return MODELS_BY_PROVIDER[provider]
}
