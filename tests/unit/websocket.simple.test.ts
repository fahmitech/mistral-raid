import { describe, expect, it, vi } from 'vitest'
import type { Session } from '../../server/src/types.js'
import { sendToClient } from '../../server/src/ws/WebSocketServer.js'

function makeSession(send = vi.fn(), readyState = 1): Session {
  return {
    id: 'test-session',
    turnState: 'LISTENING',
    aiState: 'listening',
    partialTranscript: '',
    stableTranscript: '',
    latestTelemetrySummary: null,
    rollingDebateNotes: '',
    activeLLMAbort: null,
    activeTTSAbort: null,
    lastSpeechEndTime: 0,
    lastBossSpeechTime: 0,
    ws: {
      OPEN: 1,
      readyState,
      send,
    } as Session['ws'],
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
  }
}

describe('sendToClient', () => {
  it('serializes messages when the socket is open', () => {
    const send = vi.fn()
    const session = makeSession(send)
    const message = { type: 'ai_state', payload: { state: 'listening' } } as const

    sendToClient(session, message)

    expect(send).toHaveBeenCalledWith(JSON.stringify(message))
  })

  it('skips sends when the socket is not open', () => {
    const send = vi.fn()
    const session = makeSession(send, 0)

    sendToClient(session, { type: 'ai_state', payload: { state: 'thinking' } })

    expect(send).not.toHaveBeenCalled()
  })
})
