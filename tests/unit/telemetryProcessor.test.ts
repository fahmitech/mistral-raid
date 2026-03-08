import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { ingest, getSummary } from '../../server/src/services/telemetryProcessor.ts'
import type { Session, RawTelemetry } from '../../server/src/types.js'

describe('telemetryProcessor Story Telemetry', () => {
    let session: Session

    beforeEach(() => {
        vi.useFakeTimers()
        vi.advanceTimersByTime(5000)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should aggregate story telemetry from multiple samples (cumulative from client)', () => {
        const session: Session = {
            id: 'session-1',
            latestTelemetrySummary: null,
        } as any

        const raw1: RawTelemetry = {
            hp: 100, maxHp: 100, accuracy: 0.8, dashCount: 5, playerZone: 'center',
            recentMissStreak: 0, recentHitsTaken: 0, cornerPercentage: 10,
            loreInteractionCount: 1, timeSpentReadingLore: 10, wallBias: 20, retreatDistance: 100
        }
        const raw2: RawTelemetry = {
            hp: 90, maxHp: 100, accuracy: 0.9, dashCount: 6, playerZone: 'center',
            recentMissStreak: 0, recentHitsTaken: 1, cornerPercentage: 15,
            loreInteractionCount: 2, timeSpentReadingLore: 25, wallBias: 40, retreatDistance: 150
        }

        ingest(session, raw1)
        vi.advanceTimersByTime(2000)
        ingest(session, raw2)

        const summary = getSummary(session)
        expect(summary).not.toBeNull()
        if (summary) {
            // loreInteractionCount should be 2 total (latest cumulative)
            expect(summary.loreInteractionCount).toBe(2)
            // wallBias should be average of 20 and 40
            expect(summary.wallBias).toBe(30)
            // avgTimeReadingLore: first sample ignored delta (or captured as 10), second sample delta 15.
            // Actually first sample delta is raw1.val - 0 = 10. Second delta = 15.
            // Avg = (10 + 15) / 2 = 12.5
            expect(summary.avgTimeReadingLore).toBe(12.5)
            // retreatDistance should be 150 total (latest cumulative)
            expect(summary.retreatDistance).toBe(150)
        }
    })

    it('should handle missing story fields gracefully', () => {
        const session: Session = {
            id: 'session-2',
            latestTelemetrySummary: null,
        } as any

        const raw: RawTelemetry = {
            hp: 100, maxHp: 100, accuracy: 0.8, dashCount: 5, playerZone: 'center',
            recentMissStreak: 0, recentHitsTaken: 0, cornerPercentage: 0
        }

        ingest(session, raw)

        const summary = getSummary(session)
        expect(summary).not.toBeNull()
        if (summary) {
            expect(summary.loreInteractionCount).toBe(0)
            expect(summary.retreatDistance).toBe(0)
        }
    })

    it('should maintain session totals even when samples age out of the short window', () => {
        const session: Session = {
            id: 'session-3',
            latestTelemetrySummary: null,
        } as any

        // Step 1: Ingest old samples
        const rawOld: RawTelemetry = {
            hp: 100, maxHp: 100, accuracy: 0.8, dashCount: 10, playerZone: 'center',
            recentMissStreak: 0, recentHitsTaken: 0, cornerPercentage: 0,
            loreInteractionCount: 5, timeSpentReadingLore: 50, wallBias: 0, retreatDistance: 500
        }
        ingest(session, rawOld)

        // Step 2: Advance time past RECENT_WINDOW_MS (10s)
        vi.advanceTimersByTime(15000)

        // Step 3: Ingest new sample
        const rawNew: RawTelemetry = {
            hp: 90, maxHp: 100, accuracy: 0.9, dashCount: 12, playerZone: 'center',
            recentMissStreak: 0, recentHitsTaken: 0, cornerPercentage: 0,
            loreInteractionCount: 6, timeSpentReadingLore: 60, wallBias: 0, retreatDistance: 600
        }
        ingest(session, rawNew)

        const summary = getSummary(session)
        expect(summary).not.toBeNull()
        if (summary) {
            // Session totals should include old data (12 dashes total, 6 lore interactions total)
            expect(summary.loreInteractionCount).toBe(6)
            expect(summary.totalDashCount).toBe(12)
            expect(summary.retreatDistance).toBe(600)

            // Windowed stats should only count rawNew (sampleCount = 1)
            expect(summary.sampleCount).toBe(1)
            // avgAccuracy in window should be 0.9 (from rawNew)
            expect(summary.avgAccuracy).toBe(0.9)
        }
    })
})
