import { BuildingFootprint, TeamId, WorldLootItem } from "./types";

export const WORLD_HALF_SIZE = 210;

export interface BuildingPlacement extends BuildingFootprint {
  wallColor: number;
  trimColor: number;
  baseY: number;
}

export interface AirdropSpot {
  id: string;
  x: number;
  z: number;
}

export const RAW_BUILDINGS: Omit<BuildingPlacement, "baseY">[] = [
  {
    id: "bld_pochinki_hq",
    name: "Pochinki Central HQ",
    x: 0,
    z: -4,
    width: 16,
    depth: 14,
    rotY: 0,
    floors: 3,
    wallColor: 0xd6ccb8,
    trimColor: 0x475569,
  },
  {
    id: "bld_north_barracks",
    name: "North Ridge Barracks",
    x: -36,
    z: -46,
    width: 15,
    depth: 13,
    rotY: 0,
    floors: 3,
    wallColor: 0xc2b29b,
    trimColor: 0x5c4033,
  },
  {
    id: "bld_east_watch",
    name: "East Watch Compound",
    x: 46,
    z: -22,
    width: 14,
    depth: 14,
    rotY: 0,
    floors: 3,
    wallColor: 0xcbd5e1,
    trimColor: 0x334155,
  },
  {
    id: "bld_south_plaza",
    name: "South Plaza Tower",
    x: 26,
    z: 46,
    width: 15,
    depth: 13,
    rotY: 0,
    floors: 3,
    wallColor: 0xd9c3a9,
    trimColor: 0x7c2d12,
  },
  {
    id: "bld_west_outpost",
    name: "West Ridge Outpost",
    x: -48,
    z: 32,
    width: 14,
    depth: 14,
    rotY: 0,
    floors: 3,
    wallColor: 0xc7d2cb,
    trimColor: 0x3f4e4f,
  },
  {
    id: "bld_alpha_garrison",
    name: "Alpha Forward Command",
    x: -92,
    z: -78,
    width: 16,
    depth: 14,
    rotY: 0,
    floors: 3,
    wallColor: 0xcad6e2,
    trimColor: 0x1d4ed8,
  },
  {
    id: "bld_bravo_citadel",
    name: "Bravo Forward Citadel",
    x: 92,
    z: 78,
    width: 16,
    depth: 14,
    rotY: 0,
    floors: 3,
    wallColor: 0xe2cfc4,
    trimColor: 0xb91c1c,
  },
  {
    id: "bld_supply_north",
    name: "Supply Depot North",
    x: 72,
    z: -74,
    width: 15,
    depth: 13,
    rotY: 0,
    floors: 3,
    wallColor: 0xbec5ad,
    trimColor: 0x365314,
  },
  {
    id: "bld_radar_south",
    name: "Recon Station South",
    x: -74,
    z: 76,
    width: 15,
    depth: 13,
    rotY: 0,
    floors: 3,
    wallColor: 0xd1d5db,
    trimColor: 0x374151,
  },
];

export const AIRDROP_SPOTS: AirdropSpot[] = [
  { id: "drop_center", x: 20, z: 12 },
  { id: "drop_north", x: -12, z: -76 },
  { id: "drop_south", x: -16, z: 72 },
];

function rawNoiseHeight(x: number, z: number): number {
  const n1 = Math.sin(x * 0.018) * Math.cos(z * 0.018) * 5.2;
  const n2 = Math.sin(x * 0.043 + 1.3) * Math.sin(z * 0.039 - 0.7) * 2.1;
  const n3 = Math.cos((x + z) * 0.011) * 3.0;
  // Gentle bowl rise near map edges for scenic Erangel ridge backdrop
  const dist = Math.hypot(x, z);
  const rim = Math.max(0, (dist - 125) / 85);
  const rimBoost = rim * rim * 16.5;
  return n1 + n2 + n3 + rimBoost;
}

/**
 * Deterministic terrain height that smoothly flattens building compound pads
 * and main highway corridors so 3-stage buildings sit flush with zero gaps.
 */
export function getTerrainHeight(x: number, z: number): number {
  let h = rawNoiseHeight(x, z);

  // Flatten main diagonal & cross road slightly for clean driving/running paths
  const roadDist = Math.min(Math.abs(z - x * 0.35), Math.abs(x + z * 0.28));
  if (roadDist < 10) {
    const t = roadDist / 10;
    const smooth = t * t * (3 - 2 * t);
    const roadBase = rawNoiseHeight(x, z) * 0.45;
    h = roadBase * (1 - smooth) + h * smooth;
  }

  // Flatten pads around each 3-stage building
  for (let i = 0; i < RAW_BUILDINGS.length; i++) {
    const b = RAW_BUILDINGS[i];
    const dx = Math.abs(x - b.x);
    const dz = Math.abs(z - b.z);
    const padHalfW = b.width * 0.5 + 4.5;
    const padHalfD = b.depth * 0.5 + 4.5;
    const blendMargin = 10.0;

    if (dx < padHalfW + blendMargin && dz < padHalfD + blendMargin) {
      const padCenterH = rawNoiseHeight(b.x, b.z) * 0.5;
      const ox = Math.max(0, dx - padHalfW) / blendMargin;
      const oz = Math.max(0, dz - padHalfD) / blendMargin;
      const d = Math.min(1, Math.hypot(ox, oz));
      const s = d * d * (3 - 2 * d);
      h = padCenterH * (1 - s) + h * s;
    }
  }

  return h;
}

export function isRoadSurface(x: number, z: number): number {
  const d1 = Math.abs(z - Math.sin(x * 0.015) * 18);
  const d2 = Math.abs(x - Math.cos(z * 0.015) * 16);
  const minD = Math.min(d1, d2);
  if (minD > 5.8) return 0;
  if (minD < 3.8) return 1;
  return 1 - (minD - 3.8) / 2.0;
}

export const FLOOR_HEIGHT = 3.6;

export const COMPOUND_BUILDINGS: BuildingPlacement[] = RAW_BUILDINGS.map((b) => ({
  ...b,
  baseY: getTerrainHeight(b.x, b.z),
}));

export function getTeamSpawnPoint(team: TeamId, index: number): { x: number; y: number; z: number; rotY: number } {
  const angle = (index * 1.37) % (Math.PI * 2);
  const radius = 5 + (index % 4) * 2.5;
  if (team === "A") {
    const cx = -106 + Math.cos(angle) * radius;
    const cz = -92 + Math.sin(angle) * radius;
    return {
      x: cx,
      y: getTerrainHeight(cx, cz) + 0.1,
      z: cz,
      rotY: -Math.PI * 0.75,
    };
  } else {
    const cx = 106 + Math.cos(angle) * radius;
    const cz = 92 + Math.sin(angle) * radius;
    return {
      x: cx,
      y: getTerrainHeight(cx, cz) + 0.1,
      z: cz,
      rotY: Math.PI * 0.25,
    };
  }
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const LOOT_POOL: Omit<WorldLootItem, "id" | "x" | "y" | "z" | "pickedUp">[] = [
  { kind: "weapon", itemId: "M416", name: "M416 Tactical", quantity: 1, rarity: "rare" },
  { kind: "weapon", itemId: "AKM", name: "AKM 7.62", quantity: 1, rarity: "rare" },
  { kind: "weapon", itemId: "SCAR_L", name: "SCAR-L Desert", quantity: 1, rarity: "rare" },
  { kind: "weapon", itemId: "UMP45", name: "UMP45 Spec-Ops", quantity: 1, rarity: "common" },
  { kind: "weapon", itemId: "KAR98K", name: "Kar98k Sniper", quantity: 1, rarity: "epic" },
  { kind: "ammo", itemId: "5.56mm", name: "5.56mm NATO Box", quantity: 60, rarity: "common" },
  { kind: "ammo", itemId: "7.62mm", name: "7.62mm Soviet Box", quantity: 60, rarity: "common" },
  { kind: "ammo", itemId: "9mm", name: "9mm Parabellum", quantity: 70, rarity: "common" },
  { kind: "med", itemId: "firstaid", name: "First Aid Kit", quantity: 2, rarity: "rare" },
  { kind: "med", itemId: "medkit", name: "Tactical Med Kit", quantity: 1, rarity: "epic" },
  { kind: "med", itemId: "bandage", name: "Field Bandages", quantity: 5, rarity: "common" },
  { kind: "med", itemId: "energydrink", name: "Energy Drink", quantity: 2, rarity: "rare" },
  { kind: "scope", itemId: "scope2x", name: "2x Holo Optic", quantity: 1, rarity: "common" },
  { kind: "scope", itemId: "scope4x", name: "4x ACOG Scope", quantity: 1, rarity: "epic" },
  { kind: "scope", itemId: "scope8x", name: "8x Marksman Scope", quantity: 1, rarity: "mythic" },
  { kind: "armor", itemId: "helmet3", name: "Lv.3 Spetsnaz Helmet", quantity: 1, rarity: "mythic" },
  { kind: "armor", itemId: "vest3", name: "Lv.3 Tactical Vest", quantity: 1, rarity: "epic" },
];

export function generateWorldLoot(seed = 104729): WorldLootItem[] {
  const rand = seededRand(seed);
  const items: WorldLootItem[] = [];
  let idx = 0;

  // Spawn rich loot across ALL 3 STAGES (Ground Floor, 2nd Floor, 3rd Floor Rooftop) of every building
  for (const b of COMPOUND_BUILDINGS) {
    for (let floor = 0; floor < 3; floor++) {
      const floorY = b.baseY + 0.22 + floor * FLOOR_HEIGHT;
      const countOnFloor = floor === 2 ? 4 : 3; // Extra high-tier loot on 3rd stage rooftop!
      for (let k = 0; k < countOnFloor; k++) {
        const ox = (rand() - 0.5) * (b.width - 5.2);
        const oz = (rand() - 0.5) * (b.depth - 5.2);
        // Avoid stairwell lane on right side (+x)
        const safeOx = ox > b.width * 0.22 ? ox - 2.6 : ox;

        let template = LOOT_POOL[Math.floor(rand() * LOOT_POOL.length)];
        // Guarantee high-tier sniper / scope / medkit chances on 3rd floor
        if (floor === 2 && k === 0) {
          template =
            rand() > 0.45
              ? { kind: "weapon", itemId: "KAR98K", name: "Kar98k Sniper", quantity: 1, rarity: "epic" }
              : { kind: "scope", itemId: "scope8x", name: "8x Marksman Scope", quantity: 1, rarity: "mythic" };
        }

        items.push({
          ...template,
          id: `loot_${idx++}`,
          x: b.x + safeOx,
          y: floorY,
          z: b.z + oz,
          pickedUp: false,
        });
      }
    }
  }

  // Mythic Supply Airdrop Loot surrounding the 3 Red-Smoke Airdrops
  for (const drop of AIRDROP_SPOTS) {
    const baseH = getTerrainHeight(drop.x, drop.z) + 0.25;
    const dropLoot: Omit<WorldLootItem, "id" | "x" | "y" | "z" | "pickedUp">[] = [
      { kind: "weapon", itemId: "AWM", name: "AWM .300 Magnum", quantity: 1, rarity: "mythic" },
      { kind: "ammo", itemId: ".300Mag", name: ".300 Magnum Ammo", quantity: 25, rarity: "mythic" },
      { kind: "scope", itemId: "scope8x", name: "8x Marksman Scope", quantity: 1, rarity: "mythic" },
      { kind: "armor", itemId: "helmet3", name: "Lv.3 Spetsnaz Helmet", quantity: 1, rarity: "mythic" },
      { kind: "med", itemId: "medkit", name: "Tactical Med Kit", quantity: 2, rarity: "epic" },
    ];
    dropLoot.forEach((tpl, i) => {
      const ang = (i / dropLoot.length) * Math.PI * 2;
      const lx = drop.x + Math.cos(ang) * 2.3;
      const lz = drop.z + Math.sin(ang) * 2.3;
      items.push({
        ...tpl,
        id: `loot_${idx++}`,
        x: lx,
        y: getTerrainHeight(lx, lz) + 0.2,
        z: lz,
        pickedUp: false,
      });
    });
  }

  return items;
}
