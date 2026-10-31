export type TeamId = "A" | "B";

export enum PlayerStance {
  Stand = 0,
  Crouch = 1,
  Prone = 2,
}

export type WeaponId = "M416" | "AKM" | "SCAR_L" | "UMP45" | "KAR98K" | "AWM";

export type AmmoType = "5.56mm" | "7.62mm" | "9mm" | ".300Mag";

export type ScopeId = "reddot" | "scope2x" | "scope4x" | "scope8x";

export type MedId = "bandage" | "firstaid" | "medkit" | "energydrink";

export type GraphicsQuality = "smooth" | "hd" | "ultra";

export type TimeOfDay = "golden" | "noon" | "dawn";

export type BotDifficulty = "recruit" | "veteran" | "specops";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: "AR" | "SMG" | "SR";
  ammoType: AmmoType;
  damage: number;
  headshotMult: number;
  rpm: number;
  magSize: number;
  reloadSec: number;
  bulletSpeed: number;
  recoilVert: number;
  recoilHoriz: number;
  hipSpread: number;
  adsSpread: number;
  auto: boolean;
  defaultScope: ScopeId;
  colorHex: number;
  accentHex: number;
  description: string;
}

export interface WeaponSlotState {
  weaponId: WeaponId;
  ammoInMag: number;
  scope: ScopeId;
}

export type BackpackItemKind = "weapon" | "ammo" | "med" | "scope" | "armor";

export interface BackpackItem {
  uid: string;
  kind: BackpackItemKind;
  itemId: string;
  name: string;
  quantity: number;
  rarity: "common" | "rare" | "epic" | "mythic";
  subtitle: string;
}

export interface WorldLootItem {
  id: string;
  kind: BackpackItemKind;
  itemId: string;
  name: string;
  quantity: number;
  rarity: "common" | "rare" | "epic" | "mythic";
  x: number;
  y: number;
  z: number;
  pickedUp: boolean;
}

export interface MatchConfig {
  mode: "offline" | "multiplayer";
  roomCode: string;
  playerId: string;
  playerName: string;
  playerTeam: TeamId;
  isHost: boolean;
  teamAMaxPlayers: number;
  teamBMaxPlayers: number;
  teamABots: number;
  teamBBots: number;
  botDifficulty: BotDifficulty;
  timeOfDay: TimeOfDay;
  scoreLimit: number;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  seed: number;
}

export interface NetPlayerState {
  id: string;
  name: string;
  team: TeamId;
  isHost: boolean;
  isReady: boolean;
  isBot?: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
  stance: PlayerStance;
  hp: number;
  maxHp: number;
  weaponId: WeaponId;
  kills: number;
  deaths: number;
  helmetLevel: number;
  vestLevel: number;
  lastUpdated: number;
}

export interface NetShotEvent {
  id: string;
  shooterId: string;
  team: TeamId;
  weaponId: WeaponId;
  ox: number;
  oy: number;
  oz: number;
  tx: number;
  ty: number;
  tz: number;
  hitEntityId?: string;
  damage?: number;
  headshot?: boolean;
  timestamp: number;
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: TeamId;
  victimName: string;
  victimTeam: TeamId;
  weaponName: string;
  headshot: boolean;
  timestamp: number;
}

export interface RoomLobbyState {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "ended";
  teamAMaxPlayers: number;
  teamBMaxPlayers: number;
  teamABots: number;
  teamBBots: number;
  timeOfDay: TimeOfDay;
  scoreLimit: number;
  teamAScore: number;
  teamBScore: number;
  seed: number;
  players: NetPlayerState[];
  bots: NetPlayerState[];
  recentShots: NetShotEvent[];
  killFeed: KillFeedEntry[];
  pickedLootIds: string[];
  winnerTeam?: TeamId | null;
}

export type HUDButtonId =
  | "joystick"
  | "shootRight"
  | "shootLeft"
  | "scope"
  | "jump"
  | "crouch"
  | "prone"
  | "reload"
  | "switchWeapon"
  | "heal"
  | "backpack"
  | "loot"
  | "minimap";

export interface HUDButtonConfig {
  id: HUDButtonId;
  label: string;
  xPct: number; // 0 - 100 percentage of viewport width
  yPct: number; // 0 - 100 percentage of viewport height
  scale: number; // 0.5 - 1.8
  opacity: number; // 0.2 - 1.0
  baseSize: number; // px diameter/width at scale 1.0
}

export type HUDLayoutMap = Record<HUDButtonId, HUDButtonConfig>;

export interface MinimapEntity {
  id: string;
  x: number;
  z: number;
  rotY?: number;
  team: TeamId | "loot" | "airdrop";
  isLocal?: boolean;
  firing?: boolean;
}

export interface BuildingFootprint {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotY: number;
  floors: number;
}

export interface HUDLiveSnapshot {
  hp: number;
  maxHp: number;
  boost: number;
  stance: PlayerStance;
  isSprinting: boolean;
  isScoped: boolean;
  isReloading: boolean;
  reloadProgress: number;
  isHealing: boolean;
  healProgress: number;
  selectedMed: MedId;
  activeSlot: 0 | 1;
  slots: [WeaponSlotState, WeaponSlotState];
  ammoReserve: Record<AmmoType, number>;
  medCounts: Record<MedId, number>;
  backpackItems: BackpackItem[];
  nearbyLoot: WorldLootItem[];
  helmetLevel: number;
  vestLevel: number;
  compassDeg: number;
  kills: number;
  deaths: number;
  teamAScore: number;
  teamBScore: number;
  scoreLimit: number;
  teamAAlive: number;
  teamBAlive: number;
  fps: number;
  killFeed: KillFeedEntry[];
  hitMarker: { active: boolean; headshot: boolean; ts: number };
  damageFlashTs: number;
  minimapEntities: MinimapEntity[];
  playerPos: { x: number; y: number; z: number; rotY: number };
  currentFloorLabel: string;
  matchEnded: boolean;
  winnerTeam: TeamId | null;
}
