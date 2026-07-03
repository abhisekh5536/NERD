export interface PekpikModelInfo {
  id: string
  label: string
  supportsThinking?: boolean
}

/** Models listed in https://github.com/alistaitsacle/free-llm-api-keys (Pekpik gateway). */
export const PEKPIK_MODELS: PekpikModelInfo[] = [
  // OpenAI
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.5-mini', label: 'GPT-5.5 Mini' },
  { id: 'gpt-5.5-nano', label: 'GPT-5.5 Nano' },
  { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
  { id: 'gpt-4', label: 'GPT-4' },
  { id: 'openai/gpt-5.5', label: 'OpenAI GPT-5.5' },
  { id: 'openai/gpt-5.5-pro', label: 'OpenAI GPT-5.5 Pro' },
  { id: 'openai/gpt-chat-latest', label: 'OpenAI GPT Chat Latest' },

  // Anthropic
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', supportsThinking: true },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', supportsThinking: true },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },

  // DeepSeek
  { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)', supportsThinking: true },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', supportsThinking: true },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', supportsThinking: true },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (alt)', supportsThinking: true },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro (alt)', supportsThinking: true },

  // Google Gemini
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
  { id: 'google/gemini-3.1-flash-lite', label: 'Google Gemini 3.1 Flash-Lite' },
  { id: 'google/gemini-3.5-flash', label: 'Google Gemini 3.5 Flash' },

  // xAI Grok
  { id: 'grok-4.20-beta', label: 'Grok 4.20 Beta', supportsThinking: true },
  { id: 'grok-4.20-multi-agent-beta', label: 'Grok 4.20 Multi-Agent Beta', supportsThinking: true },
  { id: 'x-ai/grok-4.3', label: 'xAI Grok 4.3', supportsThinking: true },

  // Mistral
  { id: 'mistral-medium', label: 'Mistral Medium' },
  { id: 'codestral', label: 'Codestral' },
  { id: 'devstral', label: 'Devstral' },
  { id: 'mistral-small', label: 'Mistral Small' },
  { id: 'mistralai/mistral-medium-3-5', label: 'Mistral Medium 3.5' },

  // Cohere
  { id: 'command-a-vision', label: 'Command A Vision' },
  { id: 'command-a-reasoning', label: 'Command A Reasoning', supportsThinking: true },
  { id: 'embed', label: 'Cohere Embed' },
  { id: 'rerank', label: 'Cohere Rerank' },

  // Qwen
  { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B' },
  { id: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash' },
  { id: 'qwen/qwen3.5-plus-20260420', label: 'Qwen 3.5 Plus' },
  { id: 'qwen/qwen3.6-max-preview', label: 'Qwen 3.6 Max Preview' },
  { id: 'qwen/qwen3.6-35b-a3b', label: 'Qwen 3.6 35B A3B' },

  // Kimi / Moonshot
  { id: 'kimi-k2.5', label: 'Kimi K2.5' },
  { id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code' },

  // OpenRouter & community models
  { id: 'smart-chat', label: 'Smart Chat' },
  { id: 'openrouter/owl-alpha', label: 'OpenRouter Owl Alpha' },

  // NVIDIA
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'NVIDIA Nemotron 3 Nano (Reasoning)',
    supportsThinking: true
  },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'NVIDIA Nemotron 3 Ultra 550B' },
  { id: 'nvidia/nemotron-3.5-content-safety:free', label: 'NVIDIA Nemotron 3.5 Content Safety' },

  // Poolside
  { id: 'poolside/laguna-m.1:free', label: 'Poolside Laguna M.1' },
  { id: 'poolside/laguna-xs.2:free', label: 'Poolside Laguna XS.2' },

  // Inclusion AI
  { id: 'inclusionai/ring-2.6-1t:free', label: 'InclusionAI Ring 2.6 1T' },
  { id: 'inclusionai/ring-2.6-1t', label: 'InclusionAI Ring 2.6 1T (paid)' },
  { id: 'inclusionai/ling-2.6-1t:free', label: 'InclusionAI Ling 2.6 1T' },

  // IBM / Baidu / Perceptron / MiniMax / Nex
  { id: 'ibm-granite/granite-4.1-8b', label: 'IBM Granite 4.1 8B' },
  { id: 'baidu/cobuddy:free', label: 'Baidu Cobuddy' },
  { id: 'perceptron/perceptron-mk1', label: 'Perceptron MK1' },
  { id: 'minimax/minimax-m3', label: 'MiniMax M3' },
  { id: 'nex-agi/nex-n2-pro:free', label: 'Nex AGI N2 Pro' },

  // Image / audio / embeddings (OpenAI-compatible endpoints)
  { id: 'dall-e-3', label: 'DALL-E 3 (Image)' },
  { id: 'tts-1-hd', label: 'TTS-1 HD (Audio)' },
  { id: 'text-embedding-3-small', label: 'Text Embedding 3 Small' }
]

export function isPekpikDeepSeekModel(modelId: string): boolean {
  return modelId.startsWith('deepseek') || modelId.startsWith('deepseek/')
}
