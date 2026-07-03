import { app, ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AiProvider } from '../../shared/models'
import { DEFAULT_CUSTOM_BASE_URL, getDefaultModel } from '../../shared/models'

const CONFIG_FILE = join(app.getPath('userData'), 'wordclone-config.json')

export interface AppConfig {
  provider: AiProvider
  encryptedApiKeys?: Partial<Record<AiProvider, string>>
  /** @deprecated migrated to encryptedApiKeys.gemini on read */
  encryptedApiKey?: string
  model: string
  temperature: number
  thinkingEnabled: boolean
  customBaseUrl?: string
  customSupportsThinking?: boolean
  customExtraBody?: string
}

const DEFAULT_CONFIG: AppConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  thinkingEnabled: true,
  customBaseUrl: DEFAULT_CUSTOM_BASE_URL,
  customSupportsThinking: false,
  customExtraBody: ''
}

export function normalizeCustomBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

export function parseCustomExtraBody(extraBody?: string): Record<string, unknown> | undefined {
  const trimmed = extraBody?.trim()
  if (!trimmed) return undefined
  const parsed = JSON.parse(trimmed) as unknown
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Extra request body must be a JSON object.')
  }
  return parsed as Record<string, unknown>
}

export function validateCustomExtraBody(extraBody?: string): string | null {
  if (!extraBody?.trim()) return null
  try {
    parseCustomExtraBody(extraBody)
    return null
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Invalid JSON in extra request body.'
  }
}

export function getCustomOpenAIConfig(): {
  baseUrl: string
  model: string
  supportsThinking: boolean
  extraBody?: Record<string, unknown>
} {
  const config = readConfig()
  let extraBody: Record<string, unknown> | undefined
  try {
    extraBody = parseCustomExtraBody(config.customExtraBody)
  } catch {
    extraBody = undefined
  }
  return {
    baseUrl: normalizeCustomBaseUrl(config.customBaseUrl ?? ''),
    model: config.model,
    supportsThinking: config.customSupportsThinking ?? false,
    extraBody
  }
}

function migrateConfig(raw: Partial<AppConfig>): AppConfig {
  const config: AppConfig = { ...DEFAULT_CONFIG, ...raw }

  if (!config.encryptedApiKeys) {
    config.encryptedApiKeys = {}
  }

  if (raw.encryptedApiKey && !config.encryptedApiKeys.gemini) {
    config.encryptedApiKeys.gemini = raw.encryptedApiKey
  }

  delete config.encryptedApiKey

  if (!config.provider) {
    config.provider = 'gemini'
  }

  return config
}

export function readConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return migrateConfig(JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')))
    }
  } catch {
    /* corrupted file — fall back to defaults */
  }
  return { ...DEFAULT_CONFIG, encryptedApiKeys: {} }
}

function writeConfig(config: AppConfig): void {
  const toWrite = { ...config }
  delete toWrite.encryptedApiKey
  writeFileSync(CONFIG_FILE, JSON.stringify(toWrite, null, 2), 'utf-8')
}

export function decryptApiKey(provider?: AiProvider): string | null {
  const config = readConfig()
  const targetProvider = provider ?? config.provider
  const encrypted = config.encryptedApiKeys?.[targetProvider]
  if (!encrypted) return null
  try {
    const buf = Buffer.from(encrypted, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

export function hasApiKeyForProvider(provider: AiProvider): boolean {
  const config = readConfig()
  return !!config.encryptedApiKeys?.[provider]
}

export function getActiveProvider(): AiProvider {
  return readConfig().provider
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:has-api-key', (_event, provider?: AiProvider): boolean => {
    const config = readConfig()
    const targetProvider = provider ?? config.provider
    return !!config.encryptedApiKeys?.[targetProvider]
  })

  ipcMain.handle(
    'settings:set-api-key',
    (_event, provider: AiProvider, key: string): boolean => {
      if (!safeStorage.isEncryptionAvailable()) return false
      const encrypted = safeStorage.encryptString(key)
      const config = readConfig()
      if (!config.encryptedApiKeys) {
        config.encryptedApiKeys = {}
      }
      config.encryptedApiKeys[provider] = encrypted.toString('base64')
      writeConfig(config)
      return true
    }
  )

  ipcMain.handle('settings:clear-api-key', (_event, provider: AiProvider): void => {
    const config = readConfig()
    if (config.encryptedApiKeys?.[provider]) {
      delete config.encryptedApiKeys[provider]
      writeConfig(config)
    }
  })

  ipcMain.handle('settings:get-config', (): Omit<AppConfig, 'encryptedApiKeys' | 'encryptedApiKey'> => {
    const { encryptedApiKeys: _, encryptedApiKey: __, ...rest } = readConfig()
    return rest
  })

  ipcMain.handle(
    'settings:set-config',
    (
      _event,
      partial: Partial<Omit<AppConfig, 'encryptedApiKeys' | 'encryptedApiKey'>>
    ): { ok: boolean; error?: string } => {
      try {
        if (partial.customExtraBody !== undefined) {
          const validationError = validateCustomExtraBody(partial.customExtraBody)
          if (validationError) return { ok: false, error: validationError }
        }

        const config = readConfig()
        const prevProvider = config.provider
        Object.assign(config, partial)

        if (partial.provider && partial.provider !== prevProvider && !partial.model) {
          config.model = getDefaultModel(partial.provider)
        }

        if (partial.provider === 'custom' && !config.customBaseUrl) {
          config.customBaseUrl = DEFAULT_CUSTOM_BASE_URL
        }

        if (config.customBaseUrl) {
          config.customBaseUrl = normalizeCustomBaseUrl(config.customBaseUrl)
        }

        writeConfig(config)
        return { ok: true }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to write settings file.'
        return { ok: false, error: message }
      }
    }
  )
}
