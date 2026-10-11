import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentContextPayload,
  AgentSessionEvent,
  AgentSessionSnapshot,
  AgentStartPayload,
  AgentToolResultPayload
} from '../shared/agentSession'

export interface OpenFileResult {
  canceled: boolean
  filePath?: string
}

export interface OpenDocumentResult {
  canceled: boolean
  filePath?: string
  bytes?: ArrayBuffer
  content?: string
  contentType?: 'html' | 'text'
  format?: 'docx' | 'doc' | 'html' | 'txt'
  warnings?: string[]
  error?: string
}

export interface SaveDocumentPayload {
  filePath?: string
  defaultFileName?: string
  format?: 'docx' | 'doc' | 'html' | 'txt'
  bytes?: ArrayBuffer | Uint8Array
  content?: string
}

export interface SaveDocumentResult {
  canceled: boolean
  filePath?: string
  persisted: boolean
  format?: 'docx' | 'doc' | 'html' | 'txt'
  error?: string
}

export interface PrintDocumentResult {
  success: boolean
  canceled?: boolean
  error?: string
}

export interface SaveFilePayload {
  filePath?: string
  content: string
}

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
  persisted: boolean
  error?: string
}

export interface AiStreamPayload {
  requestId: string
  provider: AiProvider
  model: string
  contents: unknown[]
  tools?: unknown[]
  thinkingEnabled: boolean
  temperature: number
}

export type AiProvider = 'gemini' | 'groq' | 'grok' | 'cerebras' | 'other' | 'custom'

export interface AiChunk {
  type: 'thought' | 'text' | 'functionCall'
  text?: string
  functionCall?: { name: string; args: Record<string, unknown>; id?: string }
  /** Opaque signature from Gemini; must be echoed back with functionCall parts. */
  thoughtSignature?: string
}

export interface AiStreamDonePayload {
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error' | 'unknown'
  interrupted?: boolean
}

export interface AppConfigPublic {
  provider: AiProvider
  model: string
  temperature: number
  thinkingEnabled: boolean
  customBaseUrl?: string
  customSupportsThinking?: boolean
  customExtraBody?: string
}

const api = {
  platform: process.platform,

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },

  file: {
    openDocument: (filePath?: string): Promise<OpenDocumentResult> =>
      ipcRenderer.invoke('file:open-document', { filePath }),
    saveDocument: (payload: SaveDocumentPayload): Promise<SaveDocumentResult> =>
      ipcRenderer.invoke('file:save-document', payload),
    saveDocumentAs: (payload: SaveDocumentPayload): Promise<SaveDocumentResult> =>
      ipcRenderer.invoke('file:save-document-as', payload),
    printDocument: (): Promise<PrintDocumentResult> => ipcRenderer.invoke('file:print-document'),
    getRecentFiles: (): Promise<string[]> => ipcRenderer.invoke('file:get-recent-files'),
    clearRecentFiles: (): Promise<void> => ipcRenderer.invoke('file:clear-recent-files'),

    // Legacy wrappers kept for compatibility with older renderer calls.
    open: (): Promise<OpenFileResult> => ipcRenderer.invoke('file:open'),
    save: (payload: SaveFilePayload): Promise<SaveFileResult> =>
      ipcRenderer.invoke('file:save', payload)
  },

  settings: {
    hasApiKey: (provider?: AiProvider): Promise<boolean> =>
      ipcRenderer.invoke('settings:has-api-key', provider),
    setApiKey: (provider: AiProvider, key: string): Promise<boolean> =>
      ipcRenderer.invoke('settings:set-api-key', provider, key),
    clearApiKey: (provider: AiProvider): Promise<void> =>
      ipcRenderer.invoke('settings:clear-api-key', provider),
    getConfig: (): Promise<AppConfigPublic> => ipcRenderer.invoke('settings:get-config'),
    setConfig: (partial: Partial<AppConfigPublic>): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('settings:set-config', partial)
  },

  ai: {
    stream: (payload: AiStreamPayload): Promise<void> => ipcRenderer.invoke('ai:stream', payload),
    onChunk: (requestId: string, cb: (chunk: AiChunk) => void): (() => void) => {
      const listener = (_event: unknown, chunk: AiChunk): void => cb(chunk)
      ipcRenderer.on(`ai:chunk:${requestId}`, listener)
      return () => ipcRenderer.removeListener(`ai:chunk:${requestId}`, listener)
    },
    onDone: (requestId: string, cb: (meta?: AiStreamDonePayload) => void): (() => void) => {
      const listener = (_event: unknown, meta?: AiStreamDonePayload): void => cb(meta)
      ipcRenderer.on(`ai:done:${requestId}`, listener)
      return () => ipcRenderer.removeListener(`ai:done:${requestId}`, listener)
    },
    onError: (requestId: string, cb: (err: { error: string }) => void): (() => void) => {
      const listener = (_event: unknown, err: { error: string }): void => cb(err)
      ipcRenderer.on(`ai:error:${requestId}`, listener)
      return () => ipcRenderer.removeListener(`ai:error:${requestId}`, listener)
    },
    cancel: (requestId: string): void => ipcRenderer.send('ai:cancel', requestId),
    testKey: (provider?: AiProvider): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('ai:test-key', provider)
  },

  agent: {
    start: (
      payload: AgentStartPayload & { initialContents: unknown[] }
    ): Promise<{ sessionId: string }> => ipcRenderer.invoke('agent:start', payload),
    pause: (sessionId: string): Promise<void> => ipcRenderer.invoke('agent:pause', sessionId),
    resume: (sessionId: string): Promise<void> => ipcRenderer.invoke('agent:resume', sessionId),
    cancel: (sessionId: string): Promise<void> => ipcRenderer.invoke('agent:cancel', sessionId),
    listResumable: (): Promise<AgentSessionSnapshot[]> =>
      ipcRenderer.invoke('agent:list-resumable'),
    provideContext: (sessionId: string, messages: unknown[]): Promise<void> =>
      ipcRenderer.invoke('agent:provide-context', sessionId, messages),
    provideToolResults: (sessionId: string, results: AgentToolResultPayload[]): Promise<void> =>
      ipcRenderer.invoke('agent:provide-tool-results', sessionId, results),
    onRequestContext: (
      cb: (payload: AgentContextPayload & { sessionId: string }) => void
    ): (() => void) => {
      const listener = (_event: unknown, payload: AgentContextPayload & { sessionId: string }): void =>
        cb(payload)
      ipcRenderer.on('agent:request-context', listener)
      return () => ipcRenderer.removeListener('agent:request-context', listener)
    },
    onExecuteTools: (
      cb: (payload: { sessionId: string; calls: import('../shared/agentSession').AgentToolCallPayload[] }) => void
    ): (() => void) => {
      const listener = (
        _event: unknown,
        payload: { sessionId: string; calls: import('../shared/agentSession').AgentToolCallPayload[] }
      ): void => cb(payload)
      ipcRenderer.on('agent:execute-tools', listener)
      return () => ipcRenderer.removeListener('agent:execute-tools', listener)
    },
    onEvent: (cb: (event: AgentSessionEvent) => void): (() => void) => {
      const listener = (_event: unknown, agentEvent: AgentSessionEvent): void => cb(agentEvent)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    }
  }
}

export type WordCloneApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] failed to expose api', error)
  }
} else {
  ;(window as unknown as { api: WordCloneApi }).api = api
}
