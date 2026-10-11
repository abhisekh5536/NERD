import { useEffect, useState } from 'react'
import { X, Eye, EyeOff, Check, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import type { AiProvider } from '../../../shared/models'
import {
  PROVIDERS,
  CUSTOM_PRESETS,
  DEFAULT_CUSTOM_BASE_URL,
  getDefaultModel,
  getModelsForProvider,
  getProviderInfo,
  getApiKeyPlaceholder,
  providerSupportsThinking
} from '../../../shared/models'

interface Props {
  open: boolean
  onClose: () => void
}

const EMPTY_HAS_KEY: Record<AiProvider, boolean> = {
  gemini: false,
  groq: false,
  grok: false,
  cerebras: false,
  other: false,
  custom: false
}

export default function SettingsModal({ open, onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasKeyByProvider, setHasKeyByProvider] = useState<Record<AiProvider, boolean>>(EMPTY_HAS_KEY)
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState<AiProvider>('gemini')
  const [model, setModel] = useState('gemini-2.5-flash')
  const [temperature, setTemperature] = useState(0.7)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [customBaseUrl, setCustomBaseUrl] = useState(DEFAULT_CUSTOM_BASE_URL)
  const [customSupportsThinking, setCustomSupportsThinking] = useState(false)
  const [customExtraBody, setCustomExtraBody] = useState('')
  const [customPreset, setCustomPreset] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const setHasApiKey = useAiStore((s) => s.setHasApiKey)
  const setModelName = useAiStore((s) => s.setModelName)
  const setStoreProvider = useAiStore((s) => s.setProvider)

  const providerInfo = getProviderInfo(provider)
  const models = getModelsForProvider(provider)
  const hasKeyForProvider = hasKeyByProvider[provider]
  const showThinking = providerSupportsThinking(provider, model, customSupportsThinking)
  const isCustom = provider === 'custom'

  useEffect(() => {
    if (!open) return
    Promise.all(
      PROVIDERS.map(async (p) => ({
        id: p.id,
        has: (await window.api?.settings?.hasApiKey(p.id)) ?? false
      }))
    ).then((results) => {
      const map = { ...EMPTY_HAS_KEY }
      for (const r of results) map[r.id] = r.has
      setHasKeyByProvider(map)
    })
    window.api?.settings?.getConfig().then((cfg) => {
      setProvider(cfg.provider)
      setModel(cfg.model)
      setTemperature(cfg.temperature)
      setThinkingEnabled(cfg.thinkingEnabled)
      setCustomBaseUrl(cfg.customBaseUrl ?? DEFAULT_CUSTOM_BASE_URL)
      setCustomSupportsThinking(cfg.customSupportsThinking ?? false)
      setCustomExtraBody(cfg.customExtraBody ?? '')
      setCustomPreset('')
    })
  }, [open])

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next)
    setModel(getDefaultModel(next))
    if (next === 'custom') {
      setCustomBaseUrl(DEFAULT_CUSTOM_BASE_URL)
    }
    setApiKey('')
    setStatus(null)
    setCustomPreset('')
  }

  const handlePresetChange = (presetId: string) => {
    setCustomPreset(presetId)
    if (!presetId) return
    const preset = CUSTOM_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setCustomBaseUrl(preset.baseUrl)
    setModel(preset.model)
    setStatus(null)
  }

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setStatus(null)
    const ok = await window.api?.settings?.setApiKey(provider, apiKey.trim())
    setSaving(false)
    if (ok) {
      setHasKeyByProvider((prev) => ({ ...prev, [provider]: true }))
      if (provider === useAiStore.getState().provider) {
        setHasApiKey(true)
      }
      setApiKey('')
      setStatus('Key saved and encrypted.')
    } else {
      setStatus('Failed to save key. Encryption unavailable.')
    }
  }

  const handleClearKey = async () => {
    await window.api?.settings?.clearApiKey(provider)
    setHasKeyByProvider((prev) => ({ ...prev, [provider]: false }))
    if (provider === useAiStore.getState().provider) {
      setHasApiKey(false)
    }
    setStatus('Key removed.')
  }

  const handleSaveConfig = async () => {
    if (!window.api?.settings?.setConfig) {
      setStatus('Settings API unavailable. Restart the app and try again.')
      return
    }

    if (isCustom && !customBaseUrl.trim()) {
      setStatus('Base URL is required for OpenAI Compatible provider.')
      return
    }
    if (isCustom && !model.trim()) {
      setStatus('Model ID is required for OpenAI Compatible provider.')
      return
    }

    if (isCustom && customExtraBody.trim()) {
      try {
        const parsed = JSON.parse(customExtraBody) as unknown
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setStatus('Extra request body must be a JSON object.')
          return
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        setStatus(`Extra request body is invalid JSON: ${message}`)
        return
      }
    }

    try {
      const result = await window.api.settings.setConfig({
        provider,
        model: model.trim(),
        temperature,
        thinkingEnabled,
        customBaseUrl: isCustom ? customBaseUrl.trim() : customBaseUrl,
        customSupportsThinking,
        customExtraBody
      })

      if (result?.ok === false) {
        setStatus(result.error ?? 'Failed to save settings.')
        return
      }

      setStoreProvider(provider)
      setModelName(model.trim())
      const hasKey = (await window.api.settings.hasApiKey(provider)) ?? false
      setHasApiKey(hasKey)
      setStatus('Settings saved.')
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : 'Failed to save settings.')
    }
  }

  const handleTestKey = async () => {
    if (!window.api?.settings?.setConfig || !window.api?.ai?.testKey) {
      setStatus('Settings API unavailable. Restart the app and try again.')
      return
    }

    if (isCustom) {
      if (!customBaseUrl.trim() || !model.trim()) {
        setStatus('Set Base URL and Model ID before testing.')
        return
      }
      const saveResult = await window.api.settings.setConfig({
        provider,
        model: model.trim(),
        customBaseUrl: customBaseUrl.trim(),
        customSupportsThinking,
        customExtraBody
      })
      if (saveResult?.ok === false) {
        setStatus(saveResult.error ?? 'Fix settings before testing.')
        return
      }
    }

    setTesting(true)
    setStatus(null)
    try {
      const result = await window.api.ai.testKey(provider)
      if (result?.ok) {
        setStatus('API key is valid.')
      } else {
        setStatus(result?.error ?? 'API key test failed.')
      }
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : 'API key test failed.')
    } finally {
      setTesting(false)
    }
  }

  if (!open) return null

  const inputCls =
    'w-full rounded border border-ribbon-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-word-accent'
  const btnPrimary =
    'flex items-center gap-1.5 rounded bg-word-accent px-3 py-1.5 text-[13px] text-white hover:bg-word-accent-hover disabled:opacity-50'
  const btnDanger =
    'flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50'
  const isErrorStatus =
    status &&
    (status.includes('failed') ||
      status.includes('Failed') ||
      status.includes('Invalid') ||
      status.includes('No API') ||
      status.includes('required') ||
      status.includes('JSON') ||
      status.includes('Fix settings'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="max-h-[90vh] w-[480px] overflow-y-auto rounded-lg border border-ribbon-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ribbon-border px-4 py-3">
          <h2 className="text-[14px] font-semibold">AI Copilot Settings</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-600">Provider</label>
            <select
              className={inputCls}
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-medium text-gray-600">
                {providerInfo.label} API Key
              </label>
              <a
                href={providerInfo.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-word-accent hover:underline"
              >
                {provider === 'other' ? 'Get free API keys' : provider === 'custom' ? 'Z.AI docs' : 'Get key'}{' '}
                <ExternalLink size={11} />
              </a>
            </div>
            {provider === 'other' && (
              <p className="mb-2 text-[11px] text-gray-500">
                Pekpik OpenAI-compatible API — 90+ models from the{' '}
                <a
                  href="https://github.com/alistaitsacle/free-llm-api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-word-accent hover:underline"
                >
                  free-llm-api-keys
                </a>{' '}
                repo. Base URL: https://aiapiv2.pekpik.com/v1
              </p>
            )}
            {isCustom && (
              <p className="mb-2 text-[11px] text-gray-500">
                Point at any OpenAI-compatible endpoint. Use a preset for Z.AI, or enter your own Base URL and model
                ID to test other gateways.
              </p>
            )}
            {hasKeyForProvider ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[13px] text-green-700">
                  <Check size={14} /> Key configured
                </span>
                <button className={btnDanger} onClick={handleClearKey}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className={inputCls}
                    type={showKey ? 'text' : 'password'}
                    placeholder={getApiKeyPlaceholder(provider)}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button className={btnPrimary} onClick={handleSaveKey} disabled={saving || !apiKey.trim()}>
                  Save
                </button>
              </div>
            )}
          </div>

          {isCustom ? (
            <>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-600">Quick preset</label>
                <select
                  className={inputCls}
                  value={customPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                >
                  <option value="">None (manual)</option>
                  {CUSTOM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-600">Base URL</label>
                <input
                  className={inputCls}
                  type="url"
                  placeholder="https://api.example.com/v1/"
                  value={customBaseUrl}
                  onChange={(e) => {
                    setCustomBaseUrl(e.target.value)
                    setCustomPreset('')
                    setStatus(null)
                  }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-600">Model ID</label>
                <input
                  className={inputCls}
                  type="text"
                  placeholder="glm-5.2"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value)
                    setCustomPreset('')
                    setStatus(null)
                  }}
                />
              </div>

              <div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[12px] font-medium text-gray-600 hover:text-gray-800"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Advanced
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 rounded border border-ribbon-border bg-chrome/30 p-3">
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={customSupportsThinking}
                        onChange={(e) => setCustomSupportsThinking(e.target.checked)}
                      />
                      Model supports reasoning / thinking streams
                    </label>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-gray-600">
                        Extra request body (JSON)
                      </label>
                      <textarea
                        className={`${inputCls} min-h-[72px] resize-y font-mono text-[12px]`}
                        placeholder={'{ "thinking": { "type": "enabled" } }'}
                        value={customExtraBody}
                        onChange={(e) => setCustomExtraBody(e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        Merged into the chat completion request. Leave empty if not needed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-600">Model</label>
              <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-600">
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-word-accent"
            />
          </div>

          {showThinking && (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => setThinkingEnabled(e.target.checked)}
              />
              Show thinking (thought summaries)
            </label>
          )}

          {status && (
            <p className={`text-[12px] ${isErrorStatus ? 'text-red-600' : 'text-green-700'}`}>{status}</p>
          )}

          <div className="flex justify-between">
            <button
              className="rounded border border-ribbon-border px-3 py-1.5 text-[13px] hover:bg-chrome disabled:opacity-50"
              onClick={handleTestKey}
              disabled={testing || !hasKeyForProvider}
            >
              {testing ? 'Testing...' : 'Test API Key'}
            </button>
            <button className={btnPrimary} onClick={handleSaveConfig}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
