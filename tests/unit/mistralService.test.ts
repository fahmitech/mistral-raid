import { describe, expect, it } from 'vitest'
import { buildUserPrompt } from '../../server/src/services/mistralService.js'
import type { TelemetrySummary, StoryContext } from '../../server/src/types.js'

describe('mistralService Prompt Construction', () => {
    it('should include all story telemetry fields in the user prompt', () => {
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

        const storyContext: StoryContext = {
            levelTag: 'unknown',
            loreDiscovered: [],
            bossHistory: [],
            playerClass: 'knight',
            runSummary: null as any,
            sanctumReached: false,
        }

        const prompt = buildUserPrompt('Hello', telemetry, storyContext)

        // Verify all story telemetry fields are present in the prompt
        expect(prompt).toContain('Lore interactions: 3')
        expect(prompt).toContain('Avg lore read time: 12.4s')
        expect(prompt).toContain('Avg lore linger time: 4.2s')
        expect(prompt).toContain('Skipped mandatory lore: 1')
        expect(prompt).toContain('Retreat distance: 451px') // rounded
        expect(prompt).toContain('Wall bias: 15.3%')
    })
})
