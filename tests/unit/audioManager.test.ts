import { describe, expect, it } from 'vitest'
import { AUDIO_VOLUMES_KEY, DEFAULT_VOLUMES } from '../../client/src/types/AudioTypes'

describe('Audio defaults', () => {
  it('keeps normalized default volumes', () => {
    expect(DEFAULT_VOLUMES).toEqual({
      master: 0.8,
      music: 0.35,
      sfx: 1,
    })
  })

  it('uses a stable storage key and in-range values', () => {
    Object.values(DEFAULT_VOLUMES).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
    expect(AUDIO_VOLUMES_KEY).toBe('mistral_raid_audio_volumes')
  })
})
