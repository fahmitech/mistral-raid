import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@mistralai/mistralai')
vi.mock('../ws/WebSocketServer.js', () => ({
    sendToClient: vi.fn()
}))
vi.mock('./sessionManager.js', () => ({
    setTurnState: vi.fn()
}))
vi.mock('./bossVoiceService.js', () => ({
    synthesize: vi.fn()
}))

import { generateBossReply } from '../../server/src/services/mistralService.js'
import type { TelemetrySummary } from '../../server/src/types.js'

describe('mistralService Prompt Construction', () => {
    it('should include all story telemetry fields in the user prompt', async () => {
        // Mock the Mistral client and capture the prompt
        const mockComplete = vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ analysis: 'test', taunt: 'test', mechanics: [] }) } }]
        });

        // @ts-ignore - Mocking internal client
        vi.spyOn(Mistral.prototype, 'chat', 'get').mockReturnValue({
            complete: mockComplete
        } as any);

        const telemetry: TelemetrySummary = {
            avgAccuracy: 0.8,
            cornerPercentageLast10s: 10,
            totalDashCount: 5,
            recentHitsTaken: 2,
            dominantZone: 'center',
            bossHpPercent: 50,
            playerHpPercent: 80,
            sampleCount: 100,
            timestamp: Date.now(),
            bossActive: true,
            loreInteractionCount: 3,
            avgTimeReadingLore: 12.4,
            avgLoreLingerTime: 4.2,
            skippedMandatoryLore: 1,
            retreatDistance: 450.7,
            wallBias: 15.3,
            longTerm: {
                avgAccuracy: 0.75,
                cornerPercentage: 8,
                dashPerMin: 10,
                dominantZone: 'center',
                sampleCount: 500,
                windowSeconds: 600,
            }
        }

        await generateBossReply('Hello', telemetry);

        expect(mockComplete).toHaveBeenCalled();
        const call = mockComplete.mock.calls[0][0];
        const userMessage = call.messages.find((m: any) => m.role === 'user').content;

        // Verify all fields are present in the prompt string
        expect(userMessage).toContain('Lore interactions: 3')
        expect(userMessage).toContain('Avg lore read time: 12.4s')
        expect(userMessage).toContain('Avg lore linger time: 4.2s')
        expect(userMessage).toContain('Skipped mandatory lore: 1')
        expect(userMessage).toContain('Retreat distance: 451px') // rounded
        expect(userMessage).toContain('Wall bias: 15.3%')
    })
})
