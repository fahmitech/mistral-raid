import Phaser from "phaser";
import { GameState } from "../core/GameState";
import { ITEM_CONFIGS } from "../config/items";
import { ItemType, WeaponConfig } from "../config/types";
import { WEAPON_CONFIGS } from "../config/weapons";
import { FRAME_URLS } from "../utils/assetManifest";

// --- Types ---
export interface Weapon {
  type: ItemType;
  category: string;
  frameKey: string;
  id: string;
  name: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  special: string;
}

export const WEAPONS: Weapon[] = [
  {
    id: "sword",
    type: ItemType.WeaponSword,
    category: "Balanced",
    frameKey: ITEM_CONFIGS[ItemType.WeaponSword].sprite,
    name: "SWORD",
    description: "Reliable knight steel tuned for steady swings.",
    gradientFrom: "#38bdf8",
    gradientTo: "#0ea5e9",
    special: "Baseline: no gimmicks, best all-around.",
  },
  {
    id: "shuriken",
    type: ItemType.WeaponDagger,
    category: "Projectile",
    frameKey: ITEM_CONFIGS[ItemType.WeaponDagger].sprite,
    name: "NINJA THROWER",
    description:
      "Forged in the deep shadow forges, this multi-bladed star is perfectly balanced for throwing.",
    gradientFrom: "#34d399",
    gradientTo: "#059669",
    special: "Bleed: Deals 5% extra damage over 3 seconds.",
  },
  {
    id: "katana",
    type: ItemType.WeaponKatana,
    category: "Melee / Fire",
    frameKey: ITEM_CONFIGS[ItemType.WeaponKatana].sprite,
    name: "FIRE KATANA",
    description: "A legendary blade imbued with the essence of a volcanic dragon.",
    gradientFrom: "#fb923c",
    gradientTo: "#ef4444",
    special: "Burn: 30% chance to ignite enemies.",
  },
  {
    id: "hammer",
    type: ItemType.WeaponHammer,
    category: "Heavy Melee",
    frameKey: ITEM_CONFIGS[ItemType.WeaponHammer].sprite,
    name: "WAR HAMMER",
    description:
      "A massive block of enchanted granite. Its sheer weight is enough to squish foes.",
    gradientFrom: "#94a3b8",
    gradientTo: "#475569",
    special: "Stun: 20% chance to immobilize target.",
  },
  {
    id: "bomb",
    type: ItemType.WeaponBomb,
    category: "Explosive",
    frameKey: ITEM_CONFIGS[ItemType.WeaponBomb].sprite,
    name: "PIXEL BOMB",
    description: "A heavy iron casing filled with unstable powder. Thrown in a high arc.",
    gradientFrom: "#f97316",
    gradientTo: "#ef4444",
    special: "AOE: Damages all enemies in radius.",
  },
];

const ICON_FALLBACKS: Record<string, string[]> = {
  weapon_shuriken: ['weapon_throwing_axe', 'weapon_dagger_silver', 'floor_spikes_anim_f0'],
  weapon_sword_slash: ['weapon_regular_sword'],
};

const getIconSrc = (key: string): string | null => {
  if (FRAME_URLS[key]) return FRAME_URLS[key];
  const fallbacks = ICON_FALLBACKS[key] ?? [];
  for (const fallback of fallbacks) {
    if (FRAME_URLS[fallback]) return FRAME_URLS[fallback];
  }
  return null;
};

// --- UI (DOM overlay) ---
interface InventoryUIOptions {
  onEquip?: (type: ItemType) => void;
}

export class InventoryUI {
  private container: HTMLDivElement;
  private selectedId: ItemType = WEAPONS[0].type;
  private options?: InventoryUIOptions;

  constructor(parent: HTMLElement | string, options?: InventoryUIOptions) {
    const host =
      typeof parent === "string" ? document.getElementById(parent) : parent;

    if (!host) {
      throw new Error(`InventoryUI: parent not found (${String(parent)})`);
    }
    this.options = options;

    // Make host a positioning context so overlay doesn't break layout
    const computedPos = window.getComputedStyle(host).position;
    if (computedPos === "static") host.style.position = "relative";

    this.container = document.createElement("div");
    this.container.setAttribute("data-inventory-ui", "true");
    this.container.style.position = "absolute";
    this.container.style.inset = "0";
    this.container.style.zIndex = "50";
    this.container.style.display = "flex";
    this.container.style.alignItems = "center";
    this.container.style.justifyContent = "center";
    this.container.style.padding = "16px";
    this.container.style.color = "white";
    this.container.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    this.container.style.background = "rgba(10,10,26,0.65)";
    this.container.style.backdropFilter = "blur(2px)";

    host.appendChild(this.container);
    this.render();
  }

  destroy() {
    this.container.remove();
  }

  private selectWeapon(id: ItemType) {
    this.selectedId = id;
    this.render();
  }

  private renderStat(label: string, value: number, from: string, to: string) {
    return `
      <div style="margin-top: 12px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;opacity:0.8;text-transform:uppercase;">
          <span>${label}</span><span>${value}%</span>
        </div>
        <div style="height:10px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.10);padding:2px;margin-top:6px;">
          <div style="height:100%;width:${value}%;background:linear-gradient(90deg, ${from}, ${to});"></div>
        </div>
      </div>
    `;
  }

  private render() {
    const weapon = WEAPONS.find((w) => w.type === this.selectedId)!;
    const config = WEAPON_CONFIGS[weapon.type] ?? WEAPON_CONFIGS[weapon.type]!;
    const statsHtml = this.renderStats(config!);
    const specialKey = this.describeSpecial(config!, weapon.special);

    this.container.innerHTML = `
      <div style="
        width: min(720px, 94%);
        background:#0b0f1d;
        border:3px solid #060911;
        box-shadow:0 0 0 4px #020409, 0 18px 40px rgba(0,0,0,0.6);
        padding:10px;
        font-family:'Press Start 2P', monospace;
        color:#d5e0ff;
      ">
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
          <!-- Left -->
          <div style="flex:1 1 260px;min-width:240px;">
            <div style="margin-bottom:12px;">
              <div style="font-size:14px;color:#facc15;text-transform:uppercase;letter-spacing:1px;">
                Inventory
              </div>
              <div style="font-size:8px;color:rgba(148,163,184,0.95);text-transform:uppercase;letter-spacing:2px;">
                Select Your Arsenal
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
              ${WEAPONS.map((w) => {
                const frameUrl = getIconSrc(w.frameKey);
                const active = w.type === this.selectedId;
                return `
                <button data-weapon="${w.type}" style="
                  aspect-ratio:1/1;
                  position:relative;
                  display:flex;
                  flex-direction:column;
                  align-items:center;
                  justify-content:center;
                  gap:4px;
                  border:2px solid ${active ? "#66e7ff" : "#1a2338"};
                  background:${active ? "#111a30" : "#060b16"};
                  border-radius:4px;
                  padding:4px;
                  cursor:pointer;
                  box-shadow:${active ? "0 0 0 2px #0b1528 inset" : "none"};
                ">
                  ${
                    frameUrl
                      ? `<img src="${frameUrl}" alt="${w.name}" style="width:38px;height:38px;image-rendering:pixelated;" />`
                      : `<div style="font-size:9px;color:${active ? "#ffffff" : "#94a3b8"};">${w.name}</div>`
                  }
                  <span style="font-size:7px;color:${active ? "#f5faff" : "#7487b3"};text-transform:uppercase;">${w.name}</span>
                </button>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Right -->
          <div style="
            flex:1 1 260px;
            min-width:240px;
            background:#060a15;
            border:2px solid #1b2843;
            padding:12px;
          ">
            ${(() => {
              const previewSrc = getIconSrc(weapon.frameKey);
              return `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                  <div style="font-size:11px;text-transform:uppercase;margin-bottom:4px;">
                    ${weapon.name}
                  </div>
                  <div style="font-size:8px;color:#facc15;text-transform:uppercase;letter-spacing:2px;">
                    ${weapon.category}
                  </div>
                </div>
                <div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#030712;border:2px solid #111a2f;">
                  ${previewSrc ? `<img src="${previewSrc}" alt="${weapon.name}" style="width:36px;height:36px;image-rendering:pixelated;" />` : ""}
                </div>
              </div>
              `;
            })()}

            ${(() => {
              const largeSrc = getIconSrc(weapon.frameKey);
              return `
              <div style="
                height:80px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#02060f;
                border:2px solid #111a2f;
                margin-bottom:12px;
              ">
                ${largeSrc ? `<img src="${largeSrc}" alt="${weapon.name}" style="width:58px;height:58px;image-rendering:pixelated;" />` : ""}
              </div>
              `;
            })()}

            <div style="font-size:9px;line-height:1.6;margin-bottom:8px;">
              ${weapon.description}
            </div>

            <div style="font-size:8px;color:rgba(251,191,36,0.95);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">
              ${specialKey}
            </div>

            ${statsHtml}

            <button data-equip="true" style="
              width:100%;
              margin-top:14px;
              padding:10px;
              background:#facc15;
              border:none;
              text-transform:uppercase;
              letter-spacing:1px;
              cursor:pointer;
              box-shadow:0 3px 0 0 #b45309;
              font-size:10px;
            ">Equip Weapon</button>

            <button data-close="true" style="
              width:100%;
              margin-top:8px;
              padding:8px;
              background:#050a16;
              border:2px solid #111a2f;
              color:#d5e0ff;
              text-transform:uppercase;
              letter-spacing:1px;
              cursor:pointer;
              font-size:9px;
            ">Close</button>
          </div>
        </div>
      </div>
    `;

    // Scoped event wiring (only inside this UI)
    this.container.querySelectorAll<HTMLButtonElement>("button[data-weapon]").forEach((btn) => {
      btn.onclick = () => this.selectWeapon(btn.dataset.weapon as ItemType);
    });

    const closeBtn = this.container.querySelector<HTMLButtonElement>('button[data-close="true"]');
    if (closeBtn) closeBtn.onclick = () => this.destroy();

    const equipBtn = this.container.querySelector<HTMLButtonElement>('button[data-equip="true"]');
    if (equipBtn) equipBtn.onclick = () => {
      GameState.get().equipWeapon(this.selectedId);
      this.options?.onEquip?.(this.selectedId);
      this.destroy();
    };
  }

  private renderStats(config: WeaponConfig): string {
    const lines = [
      { label: "Damage", value: `x${config.damageMult.toFixed(1)}` },
      { label: "Fire Rate", value: `x${config.fireRateMult.toFixed(1)}` },
      { label: "Proj Speed", value: `${config.projectileSpeed}` },
      { label: "Count/Spread", value: `${config.projectileCount} / ${config.spreadDeg}°` },
    ];
    return `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px;">
        ${lines
          .map(
            (line) => `
              <div style="background:#030714;border:2px solid #0f1729;padding:6px;">
                <div style="text-transform:uppercase;color:#8da2c0;font-size:7px;letter-spacing:1px;">${line.label}</div>
                <div style="color:#f8fafc;font-size:11px;margin-top:4px;">${line.value}</div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  private describeSpecial(config: WeaponConfig, fallback: string): string {
    const specials: string[] = [];
    if (config.critChance) specials.push(`Crit ${(config.critChance * 100).toFixed(0)}%`);
    if (config.pierce) specials.push(`Pierce ${config.pierce}`);
    if (config.knockback) specials.push(`Knockback ${config.knockback}`);
    if (config.explosion) specials.push(`AoE ${config.explosion.radius}px`);
    if (!specials.length) return fallback;
    return specials.join(" • ");
  }
}

// --- Phaser Scene wrapper (so main.ts can import it) ---
export class InventoryScene extends Phaser.Scene {
  private ui?: InventoryUI;

  constructor() {
    super("InventoryScene");
  }

  create() {
    // ✅ This is the real DOM element Phaser mounted into (#app)
    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error("InventoryScene: canvas parentElement missing");

    this.ui = new InventoryUI(parent, {
      onEquip: () => {
        this.scene.stop();
      },
    });

    // Cleanup when the scene stops
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui?.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.ui?.destroy());
  }
}
