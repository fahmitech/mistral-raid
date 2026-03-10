import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameState } from '../../client/src/core/GameState'
import { ITEM_CONFIGS } from '../../client/src/config/items'
import { CharacterType, ItemType } from '../../client/src/config/types'

describe('GameState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    GameState.get().reset()
  })

  afterEach(() => {
    GameState.get().reset()
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const state = GameState.get().getData()
      expect(state.level).toBe(1)
      expect(state.score).toBe(0)
      expect(state.coins).toBe(0)
      expect(state.playerHP).toBe(6)
      expect(state.playerMaxHP).toBe(6)
      expect(state.equippedWeapon).toBe(ItemType.WeaponSword)
      expect(state.inventory).toHaveLength(0)
    })
  })

  describe('Character Management', () => {
    it('should set character and update stats', () => {
      GameState.get().setCharacter(CharacterType.Mage)
      const state = GameState.get().getData()
      expect(state.character).toBe(CharacterType.Mage)
      expect(state.playerHP).toBe(state.playerMaxHP)
      expect(state.equippedWeapon).toBe(ItemType.WeaponSword)
    })
  })

  describe('Health Management', () => {
    it('should heal player within max HP bounds', () => {
      GameState.get().setHP(3)
      GameState.get().heal(2)
      expect(GameState.get().getData().playerHP).toBe(5)

      // Test healing beyond max
      GameState.get().heal(10)
      expect(GameState.get().getData().playerHP).toBe(6)
    })

    it('should take damage and respect shield', () => {
      // Without shield
      GameState.get().setHP(6)
      GameState.get().takeDamage(2)
      expect(GameState.get().getData().playerHP).toBe(4)

      // With shield
      GameState.get().applyShield(1000)
      GameState.get().setHP(6)
      GameState.get().takeDamage(2)
      expect(GameState.get().getData().playerHP).toBe(6) // Shield blocks damage
      expect(GameState.get().getData().hasShield).toBe(false) // Shield breaks
    })

    it('should detect death state', () => {
      GameState.get().setHP(1)
      expect(GameState.get().isDead()).toBe(false)
      GameState.get().takeDamage(1)
      expect(GameState.get().isDead()).toBe(true)
    })
  })

  describe('Score and Coins', () => {
    it('should add coins and score', () => {
      GameState.get().addCoins(5)
      const state = GameState.get().getData()
      expect(state.coins).toBe(5)
      expect(state.score).toBe(25) // 5 coins * 5 points each
    })

    it('should add score directly', () => {
      GameState.get().addScore(100)
      expect(GameState.get().getData().score).toBe(100)
    })
  })

  describe('Inventory Management', () => {
    it('should add items to inventory', () => {
      const healthPotion = ITEM_CONFIGS[ItemType.FlaskRed]
      GameState.get().addItem(healthPotion, 2)

      const inventory = GameState.get().inventory
      expect(inventory).toHaveLength(1)
      expect(inventory[0].config.type).toBe(ItemType.FlaskRed)
      expect(inventory[0].qty).toBe(2)
    })

    it('should stack same items', () => {
      const healthPotion = ITEM_CONFIGS[ItemType.FlaskRed]
      GameState.get().addItem(healthPotion, 1)
      GameState.get().addItem(healthPotion, 1)

      const inventory = GameState.get().inventory
      expect(inventory).toHaveLength(1)
      expect(inventory[0].qty).toBe(2)
    })

    it('should remove items from inventory', () => {
      const healthPotion = ITEM_CONFIGS[ItemType.FlaskRed]
      GameState.get().addItem(healthPotion, 3)
      GameState.get().removeItem(healthPotion, 2)

      const inventory = GameState.get().inventory
      expect(inventory[0].qty).toBe(1)

      // Remove remaining item
      GameState.get().removeItem(healthPotion, 1)
      expect(GameState.get().inventory).toHaveLength(0)
    })
  })

  describe('Weapon Management', () => {
    it('should equip weapons', () => {
      GameState.get().equipWeapon(ItemType.WeaponDagger)
      expect(GameState.get().getEquippedWeaponType()).toBe(ItemType.WeaponDagger)
    })

    it('should calculate effective weapon damage', () => {
      GameState.get().equipWeapon(ItemType.WeaponHammer)
      expect(GameState.get().getEffectiveWeaponDamage(10)).toBeGreaterThan(10)
    })

    it('should calculate effective fire rate', () => {
      GameState.get().equipWeapon(ItemType.WeaponDagger)
      expect(GameState.get().getEffectiveFireRate(1)).toBeGreaterThan(1)
    })
  })

  describe('Dash System', () => {
    it('should manage dash charges', () => {
      const before = GameState.get().getDashCharges()
      expect(GameState.get().spendDashCharge()).toBe(true)
      expect(GameState.get().getDashCharges()).toBe(before - 1)
    })

    it('should restore dash charges', () => {
      GameState.get().spendDashCharge()
      GameState.get().spendDashCharge()
      const restored = GameState.get().restoreDashCharges(1)
      expect(restored).toBe(GameState.get().getDashCharges())
      expect(restored).toBeGreaterThan(0)
    })
  })

  describe('Buff System', () => {
    it('should apply and clear speed boost', () => {
      const baseSpeed = GameState.get().getData().playerSpeed
      GameState.get().applySpeedBoost(1.5, 100)

      const boostedSpeed = GameState.get().getData().playerSpeed
      expect(boostedSpeed).toBeGreaterThan(baseSpeed)

      vi.advanceTimersByTime(100)
      expect(GameState.get().getData().playerSpeed).toBe(baseSpeed)
    })

    it('should apply and clear damage boost', () => {
      const baseDamage = GameState.get().getData().playerDamage
      GameState.get().applyDamageBoost(2.0, 100)

      const boostedDamage = GameState.get().getData().playerDamage
      expect(boostedDamage).toBeGreaterThan(baseDamage)
      vi.advanceTimersByTime(100)
      expect(GameState.get().getData().playerDamage).toBe(baseDamage)
    })

    it('should apply and clear shield', () => {
      GameState.get().applyShield(100)
      expect(GameState.get().getData().hasShield).toBe(true)

      vi.advanceTimersByTime(100)
      expect(GameState.get().getData().hasShield).toBe(false)
    })

    it('should apply and clear multishot', () => {
      GameState.get().applyMultiShot(100)
      expect(GameState.get().getData().isMultiShot).toBe(true)

      vi.advanceTimersByTime(100)
      expect(GameState.get().getData().isMultiShot).toBe(false)
    })
  })

  describe('Level Progression', () => {
    it('should progress through levels', () => {
      expect(GameState.get().getData().level).toBe(1)

      GameState.get().nextLevel()
      expect(GameState.get().getData().level).toBe(2)

      // Should cap at level 5
      for (let i = 0; i < 10; i++) {
        GameState.get().nextLevel()
      }
      expect(GameState.get().getData().level).toBe(5)
    })

    it('should set specific level', () => {
      GameState.get().setLevel(3)
      expect(GameState.get().getData().level).toBe(3)

      // Should clamp to valid range
      GameState.get().setLevel(0)
      expect(GameState.get().getData().level).toBe(1)

      GameState.get().setLevel(10)
      expect(GameState.get().getData().level).toBe(5)
    })
  })

  describe('Save/Load', () => {
    it('should load saved game state', () => {
      const originalState = {
        character: CharacterType.Knight,
        state: {
          level: 3,
          score: 1000,
          coins: 50,
          playerHP: 4,
          playerMaxHP: 6,
          playerDamage: 2,
          playerSpeed: 120,
          playerFireRate: 300,
          character: CharacterType.Knight,
          equippedWeapon: ItemType.WeaponDagger,
          inventory: [
            { config: ITEM_CONFIGS[ItemType.FlaskRed], qty: 2 },
            { config: ITEM_CONFIGS[ItemType.Coin], qty: 10 }
          ],
          hasShield: false,
          isMultiShot: false,
          dashCharges: 2,
          activeBuffs: []
        }
      }

      GameState.get().loadSave(originalState)
      const loadedState = GameState.get().getData()

      expect(loadedState.level).toBe(3)
      expect(loadedState.score).toBe(1000)
      expect(loadedState.coins).toBe(50)
      expect(loadedState.playerHP).toBe(4)
      expect(loadedState.equippedWeapon).toBe(ItemType.WeaponDagger)
      expect(loadedState.inventory).toHaveLength(2)
    })
  })
})
