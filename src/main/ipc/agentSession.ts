import { ipcMain, app } from 'electron'
import type { AgentStartPayload, AgentToolResultPayload } from '../../shared/agentSession'
import { getAgentSessionManager } from '../agent/sessionManager'
import { decryptApiKey, getActiveProvider, readConfig } from './settings'
import type { AiProvider } from '../../shared/models'

export function registerAgentSessionHandlers(): void {
  const mgr = () => getAgentSessionManager(app.getPath('userData'))

  ipcMain.handle(
    'agent:start',
    async (event, payload: AgentStartPayload & { initialContents: unknown[] }) => {
      const config = readConfig()
      const provider = (config.provider ?? 'gemini') as AiProvider
      const apiKey = decryptApiKey(provider)
      if (!apiKey) {
        throw new Error('No API key configured.')
      }

      const sessionId = await mgr().start(event.sender, {
        ...payload,
        provider,
        model: config.model ?? 'gemini-2.5-flash',
        temperature: config.temperature ?? 0.7,
        thinkingEnabled: config.thinkingEnabled ?? false
      })
      return { sessionId }
    }
  )

  ipcMain.handle('agent:pause', (_event, sessionId: string) => {
    mgr().pause(sessionId)
  })

  ipcMain.handle('agent:resume', (_event, sessionId: string) => {
    mgr().resume(sessionId)
  })

  ipcMain.handle('agent:cancel', (_event, sessionId: string) => {
    mgr().cancel(sessionId)
  })

  ipcMain.handle('agent:list-resumable', () => {
    return mgr().listResumable()
  })

  ipcMain.handle(
    'agent:provide-context',
    (_event, sessionId: string, messages: unknown[]) => {
      mgr().resolveContext(sessionId, messages)
    }
  )

  ipcMain.handle(
    'agent:provide-tool-results',
    (_event, sessionId: string, results: AgentToolResultPayload[]) => {
      mgr().resolveTools(sessionId, results)
    }
  )

  ipcMain.handle('agent:get-active-provider', () => {
    return getActiveProvider()
  })
}
