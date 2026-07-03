import { ipcMain, BrowserWindow } from 'electron'
import { decryptApiKey, getActiveProvider } from './settings'
import { streamGemini, testGeminiKey } from './providers/gemini'
import { streamOpenAICompatible, testOpenAICompatibleKey } from './providers/openaiCompatible'
import type { StreamTurnMeta } from '../../shared/agentSession'
import {
  type AiStreamPayload,
  formatProviderError,
  sendDone,
  sendError
} from './providers/types'
import type { AiProvider } from '../../shared/models'
import { getProviderInfo } from '../../shared/models'

const activeControllers = new Map<string, AbortController>()

export function registerAiHandlers(): void {
  ipcMain.handle('ai:stream', async (event, payload: AiStreamPayload): Promise<void> => {
    const provider = payload.provider ?? 'gemini'
    const apiKey = decryptApiKey(provider)
    if (!apiKey) {
      const label = getProviderInfo(provider).label
      sendError(
        event.sender,
        payload.requestId,
        `No API key configured. Open Settings to add your ${label} API key.`
      )
      return
    }

    const controller = new AbortController()
    activeControllers.set(payload.requestId, controller)

    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || win.isDestroyed()) {
        sendError(event.sender, payload.requestId, 'Window unavailable.')
        return
      }

      const ctx = {
        webContents: win.webContents,
        requestId: payload.requestId,
        abortSignal: controller.signal
      }

      let streamMeta: StreamTurnMeta = { finishReason: 'unknown', interrupted: false }

      if (provider === 'gemini') {
        const result = await streamGemini(ctx, apiKey, payload)
        streamMeta = result.meta
      } else {
        const result = await streamOpenAICompatible(ctx, apiKey, provider, payload)
        streamMeta = result.meta
      }

      sendDone(event.sender, payload.requestId, streamMeta)
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        sendError(event.sender, payload.requestId, formatProviderError(provider, err))
      } else {
        sendDone(event.sender, payload.requestId, { interrupted: true })
      }
    } finally {
      activeControllers.delete(payload.requestId)
    }
  })

  ipcMain.handle(
    'ai:test-key',
    async (_event, provider?: AiProvider): Promise<{ ok: boolean; error?: string }> => {
      const activeProvider = provider ?? getActiveProvider()
      const apiKey = decryptApiKey(activeProvider)
      if (!apiKey) return { ok: false, error: 'No API key configured.' }

      try {
        if (activeProvider === 'gemini') {
          await testGeminiKey(apiKey)
        } else {
          await testOpenAICompatibleKey(apiKey, activeProvider)
        }
        return { ok: true }
      } catch (err: unknown) {
        return { ok: false, error: formatProviderError(activeProvider, err) }
      }
    }
  )

  ipcMain.on('ai:cancel', (_event, requestId: string) => {
    activeControllers.get(requestId)?.abort()
    activeControllers.delete(requestId)
  })
}
