import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../server/src/types.js'

const mocks = vi.hoisted(() => ({
  sendToClient: vi.fn(),
  startDirector: vi.fn(),
  stopDirector: vi.fn(),
}))

vi.mock('../../server/src/ws/WebSocketServer.js', () => ({
  sendToClient: mocks.sendToClient,
}))

vi.mock('../../server/src/services/aiDirector.js', () => ({
  startDirector: mocks.startDirector,
  stopDirector: mocks.stopDirector,
}))

let handleBargeIn: typeof import('../../server/src/services/sessionManager.js').handleBargeIn
let setTurnState: typeof import('../../server/src/services/sessionManager.js').setTurnState

function makeSession(): Session {
  return {
    id: 'session-1',
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
      readyState: 1,
      send: vi.fn(),
    } as Session['ws'],
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
  }
}

describe('sessionManager turn-state handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ handleBargeIn, setTurnState } = await import('../../server/src/services/sessionManager.js'))
  })

  it('maps turn states to ai_state messages', () => {
    const session = makeSession()

    setTurnState(session, 'THINKING')

    expect(session.turnState).toBe('THINKING')
    expect(session.aiState).toBe('thinking')
    expect(mocks.sendToClient).toHaveBeenCalledWith(session, {
      type: 'ai_state',
      payload: { state: 'thinking' },
    })
  })

  it('aborts active work and returns to listening on barge-in', () => {
    const llmAbort = { abort: vi.fn() }
    const ttsAbort = { abort: vi.fn() }
    const session = makeSession()
    session.turnState = 'AI_SPEAKING'
    session.aiState = 'speaking'
    session.activeLLMAbort = llmAbort as unknown as AbortController
    session.activeTTSAbort = ttsAbort as unknown as AbortController

    handleBargeIn(session)

    expect(llmAbort.abort).toHaveBeenCalledTimes(1)
    expect(ttsAbort.abort).toHaveBeenCalledTimes(1)
    expect(session.turnState).toBe('LISTENING')
    expect(session.aiState).toBe('listening')
    expect(session.activeLLMAbort).toBeNull()
    expect(session.activeTTSAbort).toBeNull()
    expect(mocks.sendToClient).toHaveBeenCalledWith(session, {
      type: 'ai_state',
      payload: { state: 'listening' },
    })
  })
})
