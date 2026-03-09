import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Phaser before importing the tracker
vi.mock('phaser', () => {
    return {
        default: {
            Math: {
                Distance: {
                    Between: (x1: number, y1: number, x2: number, y2: number) => {
                        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
                    }
                },
                Vector2: class {
                    x: number; y: number;
                    constructor(x: number, y: number) { this.x = x; this.y = y; }
                    set(x: number, y: number) { this.x = x; this.y = y; return this; }
                }
            },
            GameObjects: {
                Sprite: class {
                    x: number; y: number;
                    constructor(x: number, y: number) { this.x = x; this.y = y; }
                }
            }
        }
    }
})

import { TelemetryTracker } from '../../client/src/systems/TelemetryTracker'

describe('TelemetryTracker Story Telemetry', () => {
    let tracker: TelemetryTracker

    beforeEach(() => {
        tracker = new TelemetryTracker()
        tracker.startPhase(100)
        tracker.setWorldBounds(800, 600)
    })

    describe('Lore Interactions', () => {
        it('should track lore interactions and read times', () => {
            tracker.recordLoreInteraction()
            tracker.recordLoreInteraction()
            tracker.recordLoreRead(5000) // 5s
            tracker.recordLoreRead(15000) // 15s

            const tele = tracker.getRawTelemetry(10, 10, 50)
            expect(tele.loreInteractionCount).toBe(2)
            expect(tele.timeSpentReadingLore).toBe(20) // 5+15
        })

        it('should track lore linger times', () => {
            tracker.recordLoreLinger(2000) // 2s
            tracker.recordLoreLinger(4000) // 4s

            const tele = tracker.getRawTelemetry(10, 10, 50)
            expect(tele.loreLingerTime).toBe(3) // (2+4)/2
        })

        it('should track skipped mandatory lore', () => {
            tracker.recordMandatoryLoreSkipped()
            tracker.recordMandatoryLoreSkipped()
            tracker.recordMandatoryLoreSkipped()

            const tele = tracker.getRawTelemetry(10, 10, 50)
            expect(tele.skippedMandatoryLore).toBe(3)
        })
    })

    describe('Movement Patterns', () => {
        it('should track retreat distance correctly', () => {
            // Mock player and boss
            const player = { x: 100, y: 100 } as any
            const boss = { x: 200, y: 200 } as any

            // Update 1: Initial position
            tracker.update(player, boss, 16)

            // Update 2: Move CLOSER (should NOT increase retreat distance)
            player.x = 150; player.y = 150;
            tracker.update(player, boss, 16)
            expect(tracker.getRawTelemetry(10, 10, 50).retreatDistance).toBe(0)

            // Update 3: Move FURTHER (should increase retreat distance)
            player.x = 50; player.y = 50;
            // Distance was sqrt(50^2 + 50^2) = ~70.7
            // New distance is sqrt(150^2 + 150^2) = ~212.1
            // Delta should be ~141.4
            tracker.update(player, boss, 16)

            const tele = tracker.getRawTelemetry(10, 10, 50)
            expect(tele.retreatDistance).toBeGreaterThan(141)
        })

        it('should track wall bias based on sampling', () => {
            const boss = { x: 400, y: 300 } as any

            // Sample 1: Near wall (left edge)
            tracker.update({ x: 5, y: 300 } as any, boss, 16)
            // Sample 2: In center
            tracker.update({ x: 400, y: 300 } as any, boss, 16)
            // Sample 3: Near wall (bottom edge)
            tracker.update({ x: 400, y: 595 } as any, boss, 16)
            // Sample 4: In center
            tracker.update({ x: 400, y: 300 } as any, boss, 16)

            const tele = tracker.getRawTelemetry(10, 10, 50)
            // 2 out of 4 samples were near walls (within TILE_SIZE * 1.5 = 24px)
            expect(tele.wallBias).toBe(50)
        })
    })
})
