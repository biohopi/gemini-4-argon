import * as THREE from "three";
import {
  AmmoType,
  BackpackItem,
  BotDifficulty,
  GraphicsQuality,
  HUDLiveSnapshot,
  KillFeedEntry,
  MatchConfig,
  MedId,
  MinimapEntity,
  PlayerStance,
  RoomLobbyState,
  ScopeId,
  TeamId,
  TimeOfDay,
  WeaponId,
  WeaponSlotState,
  WorldLootItem,
} from "../types";
import { INITIAL_AMMO_RESERVE, MED_SPECS, SCOPES, WEAPONS } from "../weapons";
import {
  AIRDROP_SPOTS,
  COMPOUND_BUILDINGS,
  generateWorldLoot,
  getTeamSpawnPoint,
} from "../worldData";
import { BuildingFactory } from "./BuildingFactory";
import { CharacterModel } from "./CharacterModel";
import { FoliageSystem } from "./FoliageSystem";
import { LootVisuals } from "./LootVisuals";
import { createProceduralTextures, TacticalTexturePack } from "./ProceduralTextures";
import { SoundEngine } from "./SoundEngine";
import { TerrainWorld } from "./TerrainWorld";
import { WorldCollision } from "./WorldCollision";

interface TracerFX {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxDist: number;
  traveled: number;
}

interface ImpactFX {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface OfflineBotState {
  id: string;
  name: string;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  vy: number;
  grounded: boolean;
  rotY: number;
  pitch: number;
  stance: PlayerStance;
  hp: number;
  weaponId: WeaponId;
  helmetLevel: number;
  vestLevel: number;
  kills: number;
  deaths: number;
  targetX: number;
  targetZ: number;
  fireTimer: number;
  respawnTimer: number;
  strafeSeed: number;
  recentlyFiredTimer: number;
  model: CharacterModel;
}

interface RemoteInterpolatedEntity {
  id: string;
  name: string;
  team: TeamId;
  isBot: boolean;
  currX: number;
  currY: number;
  currZ: number;
  currRotY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotY: number;
  pitch: number;
  stance: PlayerStance;
  hp: number;
  weaponId: WeaponId;
  helmetLevel: number;
  vestLevel: number;
  recentlyFiredTimer: number;
  model: CharacterModel;
}

export class BattlegroundsEngine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public sound = new SoundEngine();
  public collision = new WorldCollision();

  private textures: TacticalTexturePack;
  private terrainWorld!: TerrainWorld;
  private buildingFactory!: BuildingFactory;
  private foliageSystem!: FoliageSystem;
  private lootVisuals?: LootVisuals;

  private quality: GraphicsQuality = "hd";
  private timeOfDay: TimeOfDay = "golden";
  public lookSensitivity = 1.0;

  private animFrameId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private hudEmitTimer = 0;

  // Match vs Preview State
  private isMatchActive = false;
  private isPaused = false;
  private matchConfig: MatchConfig | null = null;
  private matchStartTime = 0;

  // Local Player State
  private playerModel?: CharacterModel;
  private px = 0;
  private py = 2;
  private pz = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private grounded = true;
  private yaw = 0;
  private pitch = 0;
  private stance: PlayerStance = PlayerStance.Stand;
  private currentFloorLabel = "ERANGEL VALLEY";
  private hp = 100;
  private maxHp = 100;
  private boost = 25;
  private helmetLevel = 1;
  private vestLevel = 1;
  private kills = 0;
  private deaths = 0;
  private respawnTimer = 0;
  private footstepTimer = 0;

  // Weapons & Inventory (Unlimited Backpack!)
  private activeSlot: 0 | 1 = 0;
  private slots: [WeaponSlotState, WeaponSlotState] = [
    { weaponId: "M416", ammoInMag: 30, scope: "reddot" },
    { weaponId: "KAR98K", ammoInMag: 5, scope: "scope4x" },
  ];
  private ammoReserve: Record<AmmoType, number> = { ...INITIAL_AMMO_RESERVE };
  private medCounts: Record<MedId, number> = {
    bandage: 5,
    firstaid: 2,
    medkit: 1,
    energydrink: 2,
  };
  private selectedMed: MedId = "firstaid";
  private backpackItems: BackpackItem[] = [];
  private worldLoot: WorldLootItem[] = [];

  // Combat Timers
  private isScoped = false;
  private fireCooldown = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadDuration = 2.0;
  private isHealing = false;
  private healTimer = 0;
  private healDuration = 3.0;

  // Inputs
  private keys = new Set<string>();
  private pointerLocked = false;
  private mouseShootHeld = false;
  private virtualShootHeld = false;
  private singleShotLatch = false;
  private stickMoveX = 0;
  private stickMoveY = 0;

  // Match Scores, FX, Bots & Multiplayer
  private teamAScore = 0;
  private teamBScore = 0;
  private matchEnded = false;
  private winnerTeam: TeamId | null = null;
  private killFeed: KillFeedEntry[] = [];
  private hitMarker = { active: false, headshot: false, ts: 0 };
  private damageFlashTs = 0;

  private tracers: TracerFX[] = [];
  private impacts: ImpactFX[] = [];
  private offlineBots: OfflineBotState[] = [];
  private remoteEntities = new Map<string, RemoteInterpolatedEntity>();
  private processedShotIds = new Set<string>();

  // Multiplayer Sync Queues
  private mpSyncTimer = 0;
  private mpSyncInFlight = false;
  private pendingNetShots: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    tx: number;
    ty: number;
    tz: number;
    hitEntityId?: string;
    headshot?: boolean;
  }[] = [];
  private pendingPickedLootIds: string[] = [];
  private pendingHealSync = 0;
  private broadcastChannel?: BroadcastChannel;

  private onHudUpdate?: (snap: HUDLiveSnapshot) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    options: {
      quality: GraphicsQuality;
      onHudUpdate?: (snap: HUDLiveSnapshot) => void;
    }
  ) {
    this.quality = options.quality;
    this.onHudUpdate = options.onHudUpdate;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality !== "smooth",
      powerPreference: "high-performance",
      alpha: false,
    });
    const maxDpr = this.quality === "ultra" ? 2 : this.quality === "hd" ? 1.65 : 1.15;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.quality !== "smooth";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.12,
      1100
    );

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = createProceduralTextures(maxAniso);

    this.rebuildWorld("golden");
    this.bindInputListeners();
    this.startLoop();
  }

  public setHudCallback(cb: (snap: HUDLiveSnapshot) => void) {
    this.onHudUpdate = cb;
  }

  public applyGraphicsQuality(quality: GraphicsQuality) {
    if (this.quality === quality) return;
    this.quality = quality;
    const maxDpr = quality === "ultra" ? 2 : quality === "hd" ? 1.65 : 1.15;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.shadowMap.enabled = quality !== "smooth";
    this.rebuildWorld(this.timeOfDay);
  }

  private rebuildWorld(timeOfDay: TimeOfDay) {
    this.timeOfDay = timeOfDay;

    if (this.terrainWorld) this.scene.remove(this.terrainWorld.group);
    if (this.buildingFactory) this.scene.remove(this.buildingFactory.group);
    if (this.foliageSystem) this.scene.remove(this.foliageSystem.group);

    this.collision.clear();
    this.terrainWorld = new TerrainWorld(
      this.scene,
      this.textures,
      this.quality,
      timeOfDay
    );
    this.buildingFactory = new BuildingFactory(
      this.scene,
      this.textures,
      this.collision
    );
    this.foliageSystem = new FoliageSystem(
      this.scene,
      this.collision,
      this.quality
    );
  }

  public startMatch(config: MatchConfig) {
    this.stopMatchEntities();
    this.matchConfig = config;
    this.isMatchActive = true;
    this.isPaused = false;
    this.matchEnded = false;
    this.winnerTeam = null;
    this.teamAScore = 0;
    this.teamBScore = 0;
    this.kills = 0;
    this.deaths = 0;
    this.killFeed = [];
    this.matchStartTime = Date.now();

    if (config.timeOfDay !== this.timeOfDay) {
      this.rebuildWorld(config.timeOfDay);
    }

    // Spawn World Loot using deterministic seed
    this.worldLoot = generateWorldLoot(config.seed);
    this.lootVisuals = new LootVisuals(this.scene, this.worldLoot);

    // Spawn Local Player
    const sp = getTeamSpawnPoint(config.playerTeam, 0);
    this.px = sp.x;
    this.py = sp.y;
    this.pz = sp.z;
    this.vx = this.vy = this.vz = 0;
    this.yaw = sp.rotY;
    this.pitch = 0;
    this.stance = PlayerStance.Stand;
    this.hp = 100;
    this.boost = 30;
    this.helmetLevel = 1;
    this.vestLevel = 1;
    this.isScoped = false;
    this.isReloading = false;
    this.isHealing = false;

    const pSpec = WEAPONS[config.primaryWeapon] || WEAPONS.M416;
    const sSpec = WEAPONS[config.secondaryWeapon] || WEAPONS.KAR98K;
    this.activeSlot = 0;
    this.slots = [
      {
        weaponId: pSpec.id,
        ammoInMag: pSpec.magSize,
        scope: pSpec.defaultScope,
      },
      {
        weaponId: sSpec.id,
        ammoInMag: sSpec.magSize,
        scope: sSpec.defaultScope,
      },
    ];
    this.ammoReserve = { ...INITIAL_AMMO_RESERVE };
    this.medCounts = {
      bandage: 5,
      firstaid: 2,
      medkit: 1,
      energydrink: 2,
    };
    this.selectedMed = "firstaid";
    this.rebuildBackpackSync([
      {
        uid: "bp_scope_2x",
        kind: "scope",
        itemId: "scope2x",
        name: "2x Holo Optic",
        quantity: 1,
        rarity: "common",
        subtitle: "Mountable tactical sight",
      },
      {
        uid: "bp_scope_4x",
        kind: "scope",
        itemId: "scope4x",
        name: "4x ACOG Scope",
        quantity: 1,
        rarity: "epic",
        subtitle: "Mid-to-long range ACOG optic",
      },
    ]);

    this.playerModel = new CharacterModel(
      config.playerId,
      config.playerName,
      config.playerTeam,
      true
    );
    this.playerModel.setWeapon(this.slots[0].weaponId);
    this.scene.add(this.playerModel.root);

    if (config.mode === "offline") {
      this.spawnOfflineBots(config);
    } else if (typeof BroadcastChannel !== "undefined") {
      this.broadcastChannel = new BroadcastChannel(`erangel_room_${config.roomCode}`);
      this.broadcastChannel.onmessage = (ev) => {
        if (ev.data?.type === "fast_pos" && ev.data.id !== config.playerId) {
          const ent = this.remoteEntities.get(ev.data.id);
          if (ent) {
            ent.targetX = ev.data.x;
            ent.targetY = ev.data.y;
            ent.targetZ = ev.data.z;
            ent.targetRotY = ev.data.rotY;
            ent.pitch = ev.data.pitch;
            ent.stance = ev.data.stance;
            ent.weaponId = ev.data.weaponId;
          }
        }
      };
    }

    this.emitHudSnapshot();
  }

  public returnToLobbyPreview() {
    this.isMatchActive = false;
    this.isPaused = false;
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.stopMatchEntities();
  }

  private stopMatchEntities() {
    if (this.playerModel) {
      this.scene.remove(this.playerModel.root);
      this.playerModel = undefined;
    }
    if (this.lootVisuals) {
      this.scene.remove(this.lootVisuals.group);
      this.lootVisuals = undefined;
    }
    for (const b of this.offlineBots) {
      this.scene.remove(b.model.root);
    }
    this.offlineBots = [];

    for (const r of this.remoteEntities.values()) {
      this.scene.remove(r.model.root);
    }
    this.remoteEntities.clear();

    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers = [];
    for (const imp of this.impacts) this.scene.remove(imp.mesh);
    this.impacts = [];

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = undefined;
    }
  }

  private rebuildBackpackSync(extraItems?: BackpackItem[]) {
    const preserved = extraItems ?? this.backpackItems.filter(
      (i) => i.kind === "weapon" || i.kind === "scope" || i.kind === "armor"
    );

    const dynamicList: BackpackItem[] = [...preserved];

    (Object.keys(this.medCounts) as MedId[]).forEach((medId) => {
      const qty = this.medCounts[medId];
      if (qty > 0) {
        const spec = MED_SPECS[medId];
        dynamicList.push({
          uid: `bp_med_${medId}`,
          kind: "med",
          itemId: medId,
          name: spec.name,
          quantity: qty,
          rarity: medId === "medkit" ? "epic" : medId === "bandage" ? "common" : "rare",
          subtitle: `+${spec.healAmount} HP • ${spec.castSec}s cast`,
        });
      }
    });

    (Object.keys(this.ammoReserve) as AmmoType[]).forEach((ammoId) => {
      const qty = this.ammoReserve[ammoId];
      if (qty > 0) {
        dynamicList.push({
          uid: `bp_ammo_${ammoId}`,
          kind: "ammo",
          itemId: ammoId,
          name: `${ammoId} Rounds`,
          quantity: qty,
          rarity: ammoId === ".300Mag" ? "mythic" : "common",
          subtitle: "Reserve ammunition stack",
        });
      }
    });

    this.backpackItems = dynamicList;
  }

  // =========================================================
  // INPUT & VIRTUAL HUD CONTROLS API
  // =========================================================
  private bindInputListeners() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  public requestCanvasPointerLock() {
    this.sound.unlock();
    if (this.isMatchActive && !this.isPaused && !this.matchEnded) {
      this.canvas.requestPointerLock?.();
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || !this.isMatchActive || this.isPaused) return;
    this.addLookDelta(e.movementX, e.movementY);
  };

  private onMouseDown = (e: MouseEvent) => {
    this.sound.unlock();
    if (!this.isMatchActive || this.isPaused || this.matchEnded) return;
    if (!this.pointerLocked) {
      this.canvas.requestPointerLock?.();
    }
    if (e.button === 0) {
      this.mouseShootHeld = true;
      this.singleShotLatch = false;
    } else if (e.button === 2) {
      this.toggleScope();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseShootHeld = false;
      this.singleShotLatch = false;
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isMatchActive) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    this.keys.add(e.code);

    if (e.code === "Space") {
      e.preventDefault();
      this.triggerJump();
    } else if (e.code === "KeyC" || e.code === "ControlLeft") {
      this.toggleCrouch();
    } else if (e.code === "KeyZ" || e.code === "KeyX") {
      this.toggleProne();
    } else if (e.code === "KeyR") {
      this.triggerReload();
    } else if (e.code === "KeyQ") {
      this.switchWeapon();
    } else if (e.code === "Digit1") {
      this.selectWeaponSlot(0);
    } else if (e.code === "Digit2") {
      this.selectWeaponSlot(1);
    } else if (e.code === "KeyV") {
      this.toggleScope();
    } else if (e.code === "KeyH") {
      this.triggerHeal();
    } else if (e.code === "KeyF") {
      this.pickupNearestLoot();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  public setMoveStick(nx: number, ny: number) {
    this.stickMoveX = THREE.MathUtils.clamp(nx, -1, 1);
    this.stickMoveY = THREE.MathUtils.clamp(ny, -1, 1);
  }

  public addLookDelta(dx: number, dy: number) {
    if (!this.isMatchActive || this.isPaused) return;
    const activeScope = this.slots[this.activeSlot].scope;
    const scopeMult = this.isScoped ? SCOPES[activeScope].sensMult : 1.0;
    const sens = 0.0023 * this.lookSensitivity * scopeMult;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sens,
      -Math.PI * 0.44,
      Math.PI * 0.44
    );
  }

  public setVirtualShoot(held: boolean) {
    this.sound.unlock();
    this.virtualShootHeld = held;
    if (!held) this.singleShotLatch = false;
  }

  public toggleScope() {
    if (!this.isMatchActive || this.hp <= 0) return;
    this.isScoped = !this.isScoped;
    this.sound.playScope(this.isScoped);
    this.emitHudSnapshot();
  }

  public triggerJump() {
    if (!this.isMatchActive || this.hp <= 0) return;
    if (this.stance !== PlayerStance.Stand) {
      this.stance = PlayerStance.Stand;
      this.emitHudSnapshot();
      return;
    }
    if (this.grounded) {
      this.vy = 9.4;
      this.grounded = false;
      this.sound.playFootstep();
    }
  }

  public toggleCrouch() {
    if (!this.isMatchActive || this.hp <= 0) return;
    this.stance =
      this.stance === PlayerStance.Crouch ? PlayerStance.Stand : PlayerStance.Crouch;
    this.emitHudSnapshot();
  }

  public toggleProne() {
    if (!this.isMatchActive || this.hp <= 0) return;
    this.stance =
      this.stance === PlayerStance.Prone ? PlayerStance.Stand : PlayerStance.Prone;
    this.emitHudSnapshot();
  }

  public switchWeapon() {
    this.selectWeaponSlot(this.activeSlot === 0 ? 1 : 0);
  }

  public selectWeaponSlot(slot: 0 | 1) {
    if (!this.isMatchActive || this.activeSlot === slot) return;
    this.activeSlot = slot;
    this.isReloading = false;
    this.isScoped = false;
    this.playerModel?.setWeapon(this.slots[slot].weaponId);
    this.sound.playScope(false);
    this.emitHudSnapshot();
  }

  public triggerReload() {
    if (!this.isMatchActive || this.isReloading || this.hp <= 0) return;
    const slot = this.slots[this.activeSlot];
    const spec = WEAPONS[slot.weaponId];
    const reserve = this.ammoReserve[spec.ammoType] || 0;
    if (slot.ammoInMag >= spec.magSize || reserve <= 0) return;

    this.isReloading = true;
    this.isScoped = false;
    this.reloadDuration = spec.reloadSec;
    this.reloadTimer = 0;
    this.sound.playReload();
    this.emitHudSnapshot();
  }

  public selectMedType(medId: MedId) {
    this.selectedMed = medId;
    this.emitHudSnapshot();
  }

  public triggerHeal(medOverride?: MedId) {
    if (!this.isMatchActive || this.isHealing || this.hp <= 0) return;
    let med = medOverride ?? this.selectedMed;
    if (this.medCounts[med] <= 0) {
      const fallback = (Object.keys(this.medCounts) as MedId[]).find(
        (m) => this.medCounts[m] > 0
      );
      if (!fallback) return;
      med = fallback;
      this.selectedMed = fallback;
    }
    if (this.hp >= 100 && med !== "energydrink") return;

    this.isHealing = true;
    this.healDuration = MED_SPECS[med].castSec;
    this.healTimer = 0;
    this.emitHudSnapshot();
  }

  public equipScopeToActiveWeapon(scopeId: ScopeId) {
    this.slots[this.activeSlot].scope = scopeId;
    this.sound.playPickup();
    this.emitHudSnapshot();
  }

  public equipWeaponFromBackpack(uid: string, targetSlot: 0 | 1) {
    const idx = this.backpackItems.findIndex((i) => i.uid === uid && i.kind === "weapon");
    if (idx === -1) return;
    const bpItem = this.backpackItems[idx];
    const newWepId = bpItem.itemId as WeaponId;
    const newSpec = WEAPONS[newWepId];
    if (!newSpec) return;

    // Move previous slot weapon into Unlimited Backpack!
    const prevSlot = this.slots[targetSlot];
    const prevSpec = WEAPONS[prevSlot.weaponId];

    this.backpackItems.splice(idx, 1, {
      uid: `bp_wep_${Date.now()}`,
      kind: "weapon",
      itemId: prevSpec.id,
      name: prevSpec.name,
      quantity: 1,
      rarity: prevSpec.id === "AWM" ? "mythic" : prevSpec.category === "SR" ? "epic" : "rare",
      subtitle: `${prevSpec.ammoType} • Stored rifle`,
    });

    this.slots[targetSlot] = {
      weaponId: newSpec.id,
      ammoInMag: newSpec.magSize,
      scope: prevSlot.scope || newSpec.defaultScope,
    };

    if (this.activeSlot === targetSlot) {
      this.playerModel?.setWeapon(newSpec.id);
    }
    this.sound.playPickup();
    this.rebuildBackpackSync();
    this.emitHudSnapshot();
  }

  public pickupLootById(lootId: string) {
    const item = this.worldLoot.find((l) => l.id === lootId && !l.pickedUp);
    if (!item) return;

    item.pickedUp = true;
    this.lootVisuals?.markPickedUp(item.id);
    this.pendingPickedLootIds.push(item.id);
    this.sound.playPickup();

    if (item.kind === "ammo") {
      const ammoKey = item.itemId as AmmoType;
      this.ammoReserve[ammoKey] = (this.ammoReserve[ammoKey] || 0) + item.quantity;
    } else if (item.kind === "med") {
      const medKey = item.itemId as MedId;
      this.medCounts[medKey] = (this.medCounts[medKey] || 0) + item.quantity;
    } else if (item.kind === "armor") {
      if (item.itemId === "helmet3") this.helmetLevel = 3;
      if (item.itemId === "vest3") this.vestLevel = 3;
      this.playerModel?.setArmorVisuals(this.helmetLevel, this.vestLevel);
      this.backpackItems.push({
        uid: `bp_arm_${item.id}`,
        kind: "armor",
        itemId: item.itemId,
        name: item.name,
        quantity: 1,
        rarity: item.rarity,
        subtitle: "Equipped Lv.3 Protection",
      });
    } else if (item.kind === "scope") {
      const sc = item.itemId as ScopeId;
      // Auto-mount if higher magnification than active reddot, AND store in unlimited backpack
      if (this.slots[this.activeSlot].scope === "reddot") {
        this.slots[this.activeSlot].scope = sc;
      }
      if (!this.backpackItems.some((b) => b.kind === "scope" && b.itemId === sc)) {
        this.backpackItems.push({
          uid: `bp_sc_${item.id}`,
          kind: "scope",
          itemId: sc,
          name: item.name,
          quantity: 1,
          rarity: item.rarity,
          subtitle: "Tap to mount on active weapon",
        });
      }
    } else if (item.kind === "weapon") {
      const wepId = item.itemId as WeaponId;
      const spec = WEAPONS[wepId];
      if (spec) {
        // Grant bonus matching ammo box automatically
        this.ammoReserve[spec.ammoType] =
          (this.ammoReserve[spec.ammoType] || 0) + spec.magSize * 2;
        this.backpackItems.push({
          uid: `bp_wep_${item.id}`,
          kind: "weapon",
          itemId: wepId,
          name: spec.name,
          quantity: 1,
          rarity: item.rarity,
          subtitle: `${spec.ammoType} • Equip to Slot 1 or 2`,
        });
      }
    }

    this.rebuildBackpackSync();
    this.emitHudSnapshot();
  }

  public pickupNearestLoot() {
    const nearby = this.getNearbyLoot();
    if (nearby.length > 0) {
      this.pickupLootById(nearby[0].id);
    }
  }

  private getNearbyLoot(): WorldLootItem[] {
    const out: { item: WorldLootItem; distSq: number }[] = [];
    for (let i = 0; i < this.worldLoot.length; i++) {
      const l = this.worldLoot[i];
      if (l.pickedUp) continue;
      const dy = Math.abs(l.y - this.py);
      if (dy > 1.8) continue;
      const dx = l.x - this.px;
      const dz = l.z - this.pz;
      const dSq = dx * dx + dz * dz;
      if (dSq <= 12.5) {
        out.push({ item: l, distSq: dSq });
      }
    }
    out.sort((a, b) => a.distSq - b.distSq);
    return out.slice(0, 5).map((o) => o.item);
  }

  // =========================================================
  // OFFLINE SMART SQUAD AI BOTS
  // =========================================================
  private spawnOfflineBots(config: MatchConfig) {
    const namesA = [
      "Ghost_Alpha",
      "Falcon_02",
      "Frost_03",
      "Cobalt_04",
      "Viper_05",
      "Aegis_06",
      "Lynx_07",
      "Nomad_08",
      "Titan_09",
      "Striker_10",
    ];
    const namesB = [
      "Reaper_Bravo",
      "Kobra_B2",
      "Havoc_B3",
      "Blaze_B4",
      "Shadow_B5",
      "Vandal_B6",
      "Onyx_B7",
      "Draco_B8",
      "Wraith_B9",
      "Jackal_B10",
    ];
    const wepPool: WeaponId[] = ["M416", "AKM", "SCAR_L", "UMP45", "KAR98K"];

    const spawnForTeam = (team: TeamId, count: number, names: string[]) => {
      for (let i = 0; i < count; i++) {
        const id = `offbot_${team}_${i + 1}`;
        const name = names[i % names.length] || `Unit_${team}${i + 1}`;
        const sp = getTeamSpawnPoint(team, i + 2);
        const wep = wepPool[(i + (team === "B" ? 1 : 0)) % wepPool.length];
        const bldg =
          COMPOUND_BUILDINGS[(i * 2 + (team === "B" ? 1 : 0)) % COMPOUND_BUILDINGS.length];

        const model = new CharacterModel(id, name, team, false);
        model.setWeapon(wep);
        this.scene.add(model.root);

        this.offlineBots.push({
          id,
          name,
          team,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          vy: 0,
          grounded: true,
          rotY: sp.rotY,
          pitch: 0,
          stance: PlayerStance.Stand,
          hp: 100,
          weaponId: wep,
          helmetLevel: 1 + (i % 2),
          vestLevel: 1 + (i % 2),
          kills: 0,
          deaths: 0,
          targetX: bldg.x + (Math.random() - 0.5) * 18,
          targetZ: bldg.z + (Math.random() - 0.5) * 18,
          fireTimer: 0.7 + Math.random() * 1.2,
          respawnTimer: 0,
          strafeSeed: Math.random() * 10,
          recentlyFiredTimer: 0,
          model,
        });
      }
    };

    spawnForTeam("A", config.teamABots, namesA);
    spawnForTeam("B", config.teamBBots, namesB);
  }

  private updateOfflineBots(dt: number) {
    if (!this.matchConfig || this.matchEnded) return;
    const diff: BotDifficulty = this.matchConfig.botDifficulty;
    const accuracyBase = diff === "specops" ? 0.52 : diff === "veteran" ? 0.36 : 0.22;

    for (let i = 0; i < this.offlineBots.length; i++) {
      const bot = this.offlineBots[i];
      if (bot.recentlyFiredTimer > 0) bot.recentlyFiredTimer -= dt;

      if (bot.hp <= 0) {
        bot.model.root.visible = false;
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          const sp = getTeamSpawnPoint(bot.team, i + 2);
          bot.x = sp.x;
          bot.y = sp.y;
          bot.z = sp.z;
          bot.hp = 100;
          bot.model.root.visible = true;
        }
        continue;
      }

      // Acquire nearest visible enemy (either Local Player or opposing OfflineBot)
      let bestTarget: {
        id: string;
        name: string;
        team: TeamId;
        x: number;
        y: number;
        z: number;
        isPlayer: boolean;
        botRef?: OfflineBotState;
      } | null = null;
      let bestDist = 110;

      if (this.hp > 0 && this.matchConfig.playerTeam !== bot.team) {
        const d = Math.hypot(this.px - bot.x, this.pz - bot.z);
        if (d < bestDist) {
          // Check line of sight
          const eye = new THREE.Vector3(bot.x, bot.y + 1.45, bot.z);
          const tgt = new THREE.Vector3(this.px, this.py + 1.0, this.pz);
          const dir = tgt.clone().sub(eye).normalize();
          const wallHit = this.collision.raycastSolid(eye, dir, d);
          if (!wallHit || wallHit.distance >= d - 0.5) {
            bestDist = d;
            bestTarget = {
              id: this.matchConfig.playerId,
              name: this.matchConfig.playerName,
              team: this.matchConfig.playerTeam,
              x: this.px,
              y: this.py,
              z: this.pz,
              isPlayer: true,
            };
          }
        }
      }

      for (let j = 0; j < this.offlineBots.length; j++) {
        const other = this.offlineBots[j];
        if (other.team === bot.team || other.hp <= 0) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (d < bestDist) {
          const eye = new THREE.Vector3(bot.x, bot.y + 1.45, bot.z);
          const tgt = new THREE.Vector3(other.x, other.y + 1.1, other.z);
          const dir = tgt.clone().sub(eye).normalize();
          const wallHit = this.collision.raycastSolid(eye, dir, d);
          if (!wallHit || wallHit.distance >= d - 0.5) {
            bestDist = d;
            bestTarget = {
              id: other.id,
              name: other.name,
              team: other.team,
              x: other.x,
              y: other.y,
              z: other.z,
              isPlayer: false,
              botRef: other,
            };
          }
        }
      }

      let bvx = 0;
      let bvz = 0;

      if (bestTarget) {
        const dx = bestTarget.x - bot.x;
        const dz = bestTarget.z - bot.z;
        bot.rotY = Math.atan2(-dx, -dz);
        bot.pitch = Math.atan2(bestTarget.y - bot.y, Math.max(1, bestDist)) * 0.5;

        if (bestDist > 26) {
          bvx = (dx / bestDist) * 4.8;
          bvz = (dz / bestDist) * 4.8;
          bot.stance = PlayerStance.Stand;
        } else {
          const strafeDir = Math.sin(this.elapsed * 2.1 + bot.strafeSeed) > 0 ? 1 : -1;
          bvx = (-dz / bestDist) * 3.3 * strafeDir;
          bvz = (dx / bestDist) * 3.3 * strafeDir;
          bot.stance =
            Math.cos(this.elapsed * 1.3 + bot.strafeSeed) > 0.35
              ? PlayerStance.Crouch
              : PlayerStance.Stand;
        }

        bot.fireTimer -= dt;
        if (bot.fireTimer <= 0) {
          const wep = WEAPONS[bot.weaponId];
          bot.fireTimer =
            wep.category === "SR" ? 1.85 + Math.random() * 0.8 : 0.24 + Math.random() * 0.32;
          bot.recentlyFiredTimer = 1.4;
          bot.model.triggerMuzzleFlash();

          const distToLocal = Math.hypot(bot.x - this.px, bot.z - this.pz);
          if (distToLocal < 135) {
            this.sound.playGunshot(bot.weaponId, distToLocal);
          }

          const hitProb = Math.max(0.1, accuracyBase - bestDist / 195);
          const hit = Math.random() < hitProb;
          const headshot = hit && Math.random() < 0.12;

          const startPos = new THREE.Vector3(bot.x, bot.y + 1.35, bot.z);
          const aimPos = new THREE.Vector3(
            bestTarget.x + (hit ? 0 : (Math.random() - 0.5) * 2.1),
            bestTarget.y + (headshot ? 1.52 : 1.0) + (hit ? 0 : (Math.random() - 0.5) * 0.8),
            bestTarget.z + (hit ? 0 : (Math.random() - 0.5) * 2.1)
          );
          this.spawnTracer(
            startPos,
            aimPos,
            bot.team === "A" ? 0x38bdf8 : 0xfb7185
          );

          if (hit) {
            const dmg = Math.max(
              6,
              Math.round(wep.damage * 0.34 * (headshot ? 1.65 : 1.0))
            );
            this.spawnImpact(aimPos, 0xef4444);

            if (bestTarget.isPlayer && this.hp > 0) {
              const mitigation = 1 - (headshot ? this.helmetLevel : this.vestLevel) * 0.12;
              this.hp = Math.max(0, this.hp - Math.round(dmg * mitigation));
              this.damageFlashTs = Date.now();
              if (this.hp <= 0) {
                this.onLocalEliminated(bot.name, bot.team, wep.name, headshot);
                bot.kills += 1;
              }
            } else if (bestTarget.botRef && bestTarget.botRef.hp > 0) {
              bestTarget.botRef.hp = Math.max(0, bestTarget.botRef.hp - dmg);
              if (bestTarget.botRef.hp <= 0) {
                bot.kills += 1;
                bestTarget.botRef.deaths += 1;
                bestTarget.botRef.respawnTimer = 3.5;
                this.recordOfflineKill(
                  bot.name,
                  bot.team,
                  bestTarget.botRef.name,
                  bestTarget.botRef.team,
                  wep.name,
                  headshot
                );
              }
            }
          }
        }
      } else {
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.5) {
          const nextB =
            COMPOUND_BUILDINGS[Math.floor(Math.random() * COMPOUND_BUILDINGS.length)];
          bot.targetX = nextB.x + (Math.random() - 0.5) * 16;
          bot.targetZ = nextB.z + (Math.random() - 0.5) * 16;
        } else {
          bot.rotY = Math.atan2(-dx, -dz);
          bvx = (dx / dist) * 5.6;
          bvz = (dz / dist) * 5.6;
          bot.stance = PlayerStance.Stand;
        }
      }

      const resolved = this.collision.resolveCharacter({
        x: bot.x,
        y: bot.y,
        z: bot.z,
        vx: bvx,
        vy: bot.vy,
        vz: bvz,
        dt,
        radius: 0.36,
        height: 1.7,
        grounded: bot.grounded,
      });
      bot.x = resolved.x;
      bot.y = resolved.y;
      bot.z = resolved.z;
      bot.vy = resolved.vy;
      bot.grounded = resolved.grounded;

      const isAlly = this.matchConfig.playerTeam === bot.team;
      const distPlayer = Math.hypot(bot.x - this.px, bot.z - this.pz);

      bot.model.updateTransformAndAnim({
        x: bot.x,
        y: bot.y,
        z: bot.z,
        rotY: bot.rotY,
        pitch: bot.pitch,
        stance: bot.stance,
        moveSpeed: Math.hypot(bvx, bvz),
        hp: bot.hp,
        dt,
        showNameplate: isAlly || distPlayer < 26,
      });
    }
  }

  private onLocalEliminated(
    killerName: string,
    killerTeam: TeamId,
    weaponName: string,
    headshot: boolean
  ) {
    if (!this.matchConfig) return;
    this.deaths += 1;
    this.isScoped = false;
    this.isReloading = false;
    this.isHealing = false;
    this.respawnTimer = 3.2;

    if (this.matchConfig.mode === "offline") {
      this.recordOfflineKill(
        killerName,
        killerTeam,
        this.matchConfig.playerName,
        this.matchConfig.playerTeam,
        weaponName,
        headshot
      );
    }
  }

  private recordOfflineKill(
    killerName: string,
    killerTeam: TeamId,
    victimName: string,
    victimTeam: TeamId,
    weaponName: string,
    headshot: boolean
  ) {
    if (!this.matchConfig || this.matchEnded) return;
    if (killerTeam === "A") this.teamAScore += 1;
    else this.teamBScore += 1;

    this.killFeed = [
      ...this.killFeed.slice(-6),
      {
        id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        killerName,
        killerTeam,
        victimName,
        victimTeam,
        weaponName,
        headshot,
        timestamp: Date.now(),
      },
    ];

    if (
      this.teamAScore >= this.matchConfig.scoreLimit ||
      this.teamBScore >= this.matchConfig.scoreLimit
    ) {
      this.matchEnded = true;
      this.winnerTeam = this.teamAScore >= this.matchConfig.scoreLimit ? "A" : "B";
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
      // Persist Offline Match Summary to PostgreSQL
      fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: "OFFLINE",
          mode: "offline",
          winnerTeam: this.winnerTeam === "A" ? "TEAM ALPHA" : "TEAM BRAVO",
          teamAScore: this.teamAScore,
          teamBScore: this.teamBScore,
          mvpName: this.matchConfig.playerName,
          mvpKills: this.kills,
          durationSec: Math.max(10, Math.round((Date.now() - this.matchStartTime) / 1000)),
        }),
      }).catch(() => {});
    }
  }

  // =========================================================
  // SHOOTING, RAYCAST BALLISTICS & FX
  // =========================================================
  private tryFireWeapon() {
    if (!this.matchConfig || this.hp <= 0 || this.isReloading || this.matchEnded) return;
    const slot = this.slots[this.activeSlot];
    const spec = WEAPONS[slot.weaponId];

    if (!spec.auto && this.singleShotLatch) return;

    if (slot.ammoInMag <= 0) {
      this.triggerReload();
      return;
    }

    if (this.fireCooldown > 0) return;

    // Cancel healing if player shoots
    this.isHealing = false;

    slot.ammoInMag -= 1;
    this.fireCooldown = 60 / spec.rpm;
    if (!spec.auto) this.singleShotLatch = true;

    this.sound.playGunshot(spec.id, 0);
    this.playerModel?.triggerMuzzleFlash();

    // Calculate stance-adjusted spread & recoil
    const stanceMult =
      this.stance === PlayerStance.Prone
        ? 0.48
        : this.stance === PlayerStance.Crouch
        ? 0.72
        : 1.0;
    const spread = (this.isScoped ? spec.adsSpread : spec.hipSpread) * stanceMult;

    const rayOrigin = this.camera.getWorldPosition(new THREE.Vector3());
    const rayDir = this.camera.getWorldDirection(new THREE.Vector3());
    rayDir.x += (Math.random() - 0.5) * spread;
    rayDir.y += (Math.random() - 0.5) * spread;
    rayDir.z += (Math.random() - 0.5) * spread;
    rayDir.normalize();

    // Apply Camera Recoil Kick
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + spec.recoilVert * stanceMult,
      -Math.PI * 0.44,
      Math.PI * 0.44
    );
    this.yaw += (Math.random() - 0.5) * spec.recoilHoriz * 2 * stanceMult;

    // 1. Check solid world wall distance
    const maxRange = 360;
    const wallHit = this.collision.raycastSolid(rayOrigin, rayDir, maxRange);
    let maxHitDist = wallHit ? wallHit.distance : maxRange;
    let endPoint = wallHit
      ? wallHit.point
      : rayOrigin.clone().addScaledVector(rayDir, maxRange);

    // 2. Test enemy hitboxes (Head sphere + Torso cylinder/box) before wall distance
    let hitEntityId: string | undefined;
    let isHeadshot = false;
    let hitOfflineBot: OfflineBotState | undefined;

    const testCandidate = (
      id: string,
      team: TeamId,
      cx: number,
      cy: number,
      cz: number,
      st: PlayerStance,
      hpVal: number
    ): { dist: number; head: boolean; point: THREE.Vector3 } | null => {
      if (hpVal <= 0 || team === this.matchConfig!.playerTeam) return null;
      const bodyTop =
        st === PlayerStance.Prone ? 0.62 : st === PlayerStance.Crouch ? 1.24 : 1.74;
      const headY =
        st === PlayerStance.Prone ? cy + 0.38 : st === PlayerStance.Crouch ? cy + 1.08 : cy + 1.56;

      // Closest point along ray to target axis
      const toCenter = new THREE.Vector3(cx - rayOrigin.x, 0, cz - rayOrigin.z);
      const tProj =
        (toCenter.x * rayDir.x + (cy + bodyTop * 0.5 - rayOrigin.y) * rayDir.y + toCenter.z * rayDir.z);
      if (tProj < 0.4 || tProj >= maxHitDist) return null;

      // Check Head Sphere first (radius 0.25m)
      const headCenter = new THREE.Vector3(cx, headY, cz);
      const tHead = headCenter.clone().sub(rayOrigin).dot(rayDir);
      if (tHead > 0.3 && tHead < maxHitDist) {
        const ptH = rayOrigin.clone().addScaledVector(rayDir, tHead);
        if (ptH.distanceTo(headCenter) <= 0.27) {
          return { dist: tHead, head: true, point: ptH };
        }
      }

      // Check Body Volume (radius 0.42m, height [cy, cy + bodyTop])
      const horizDirLenSq = rayDir.x * rayDir.x + rayDir.z * rayDir.z;
      let tBody = tProj;
      if (horizDirLenSq > 1e-4) {
        tBody = ((cx - rayOrigin.x) * rayDir.x + (cz - rayOrigin.z) * rayDir.z) / horizDirLenSq;
      }
      if (tBody > 0.3 && tBody < maxHitDist) {
        const ptB = rayOrigin.clone().addScaledVector(rayDir, tBody);
        const hDist = Math.hypot(ptB.x - cx, ptB.z - cz);
        const bodyRadius = st === PlayerStance.Prone ? 0.55 : 0.42;
        if (hDist <= bodyRadius && ptB.y >= cy - 0.05 && ptB.y <= cy + bodyTop) {
          return { dist: tBody, head: false, point: ptB };
        }
      }
      return null;
    };

    if (this.matchConfig.mode === "offline") {
      for (const bot of this.offlineBots) {
        const res = testCandidate(
          bot.id,
          bot.team,
          bot.x,
          bot.y,
          bot.z,
          bot.stance,
          bot.hp
        );
        if (res && res.dist < maxHitDist) {
          maxHitDist = res.dist;
          endPoint = res.point;
          hitEntityId = bot.id;
          isHeadshot = res.head;
          hitOfflineBot = bot;
        }
      }
    } else {
      for (const rem of this.remoteEntities.values()) {
        const res = testCandidate(
          rem.id,
          rem.team,
          rem.currX,
          rem.currY,
          rem.currZ,
          rem.stance,
          rem.hp
        );
        if (res && res.dist < maxHitDist) {
          maxHitDist = res.dist;
          endPoint = res.point;
          hitEntityId = rem.id;
          isHeadshot = res.head;
        }
      }
    }

    // Muzzle world origin for visual tracer
    const muzzleOrigin = new THREE.Vector3(this.px, this.py + this.getEyeHeight() - 0.16, this.pz);
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    muzzleOrigin.addScaledVector(rightVec, 0.24);
    muzzleOrigin.addScaledVector(rayDir, 0.65);

    this.spawnTracer(muzzleOrigin, endPoint, 0xfef08a);

    if (hitEntityId) {
      this.sound.playHitmarker(isHeadshot);
      this.hitMarker = { active: true, headshot: isHeadshot, ts: Date.now() };
      this.spawnImpact(endPoint, isHeadshot ? 0xfacc15 : 0xef4444);

      if (this.matchConfig.mode === "offline" && hitOfflineBot) {
        const armorMit = isHeadshot
          ? 1 - hitOfflineBot.helmetLevel * 0.12
          : 1 - hitOfflineBot.vestLevel * 0.12;
        const dmg = Math.max(
          10,
          Math.round(
            spec.damage * (isHeadshot ? spec.headshotMult : 1.0) * armorMit
          )
        );
        hitOfflineBot.hp = Math.max(0, hitOfflineBot.hp - dmg);
        if (hitOfflineBot.hp <= 0) {
          this.kills += 1;
          hitOfflineBot.deaths += 1;
          hitOfflineBot.respawnTimer = 3.5;
          this.recordOfflineKill(
            this.matchConfig.playerName,
            this.matchConfig.playerTeam,
            hitOfflineBot.name,
            hitOfflineBot.team,
            spec.name,
            isHeadshot
          );
        }
      }
    } else if (wallHit) {
      this.spawnImpact(endPoint, 0xfde047);
    }

    if (this.matchConfig.mode === "multiplayer") {
      this.pendingNetShots.push({
        weaponId: spec.id,
        ox: muzzleOrigin.x,
        oy: muzzleOrigin.y,
        oz: muzzleOrigin.z,
        tx: endPoint.x,
        ty: endPoint.y,
        tz: endPoint.z,
        hitEntityId,
        headshot: isHeadshot,
      });
    }

    if (slot.ammoInMag === 0 && (this.ammoReserve[spec.ammoType] || 0) > 0) {
      this.triggerReload();
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number) {
    const dir = end.clone().sub(start);
    const totalDist = Math.max(0.5, dir.length());
    dir.normalize();

    const geo = new THREE.CylinderGeometry(0.022, 0.022, 2.2, 5);
    geo.rotateX(Math.PI * 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.tracers.push({
      mesh,
      vel: dir.multiplyScalar(320),
      life: 0.45,
      maxDist: totalDist,
      traveled: 0,
    });
  }

  private spawnImpact(point: THREE.Vector3, colorHex: number) {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(point);
      this.scene.add(m);
      this.impacts.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          1.5 + Math.random() * 4,
          (Math.random() - 0.5) * 5
        ),
        life: 0.28,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      const step = t.vel.length() * dt;
      t.mesh.position.addScaledVector(t.vel, dt);
      t.traveled += step;
      t.life -= dt;
      if (t.life <= 0 || t.traveled >= t.maxDist) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const imp = this.impacts[i];
      imp.vel.y -= 15 * dt;
      imp.mesh.position.addScaledVector(imp.vel, dt);
      imp.life -= dt;
      if (imp.life <= 0) {
        this.scene.remove(imp.mesh);
        this.impacts.splice(i, 1);
      }
    }
  }

  // =========================================================
  // MULTIPLAYER NETWORK SYNCHRONIZATION
  // =========================================================
  private updateMultiplayerSync(dt: number) {
    if (!this.matchConfig || this.matchConfig.mode !== "multiplayer") return;

    // Fast BroadcastChannel local multi-tab acceleration
    if (this.broadcastChannel && this.hp > 0) {
      this.broadcastChannel.postMessage({
        type: "fast_pos",
        id: this.matchConfig.playerId,
        x: this.px,
        y: this.py,
        z: this.pz,
        rotY: this.yaw,
        pitch: this.pitch,
        stance: this.stance,
        weaponId: this.slots[this.activeSlot].weaponId,
      });
    }

    // Interpolate all remote players & server bots smoothly at 60 FPS
    for (const rem of this.remoteEntities.values()) {
      if (rem.recentlyFiredTimer > 0) rem.recentlyFiredTimer -= dt;
      const prevX = rem.currX;
      const prevZ = rem.currZ;
      rem.currX = THREE.MathUtils.lerp(rem.currX, rem.targetX, 14 * dt);
      rem.currY = THREE.MathUtils.lerp(rem.currY, rem.targetY, 14 * dt);
      rem.currZ = THREE.MathUtils.lerp(rem.currZ, rem.targetZ, 14 * dt);

      // Shortest angle lerp
      let diff = rem.targetRotY - rem.currRotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rem.currRotY += diff * Math.min(1, 14 * dt);

      const moveSpd = Math.hypot(rem.currX - prevX, rem.currZ - prevZ) / Math.max(0.001, dt);
      const isAlly = rem.team === this.matchConfig.playerTeam;
      const dist = Math.hypot(rem.currX - this.px, rem.currZ - this.pz);

      rem.model.setWeapon(rem.weaponId);
      rem.model.setArmorVisuals(rem.helmetLevel, rem.vestLevel);
      rem.model.updateTransformAndAnim({
        x: rem.currX,
        y: rem.currY,
        z: rem.currZ,
        rotY: rem.currRotY,
        pitch: rem.pitch,
        stance: rem.stance,
        moveSpeed: moveSpd,
        hp: rem.hp,
        dt,
        showNameplate: isAlly || dist < 26,
      });
    }

    this.mpSyncTimer += dt;
    if (this.mpSyncTimer < 0.075 || this.mpSyncInFlight) return;
    this.mpSyncTimer = 0;
    this.mpSyncInFlight = true;

    const shotsBatch = this.pendingNetShots.splice(0, this.pendingNetShots.length);
    const lootBatch = this.pendingPickedLootIds.splice(0, this.pendingPickedLootIds.length);
    const healAmt = this.pendingHealSync;
    this.pendingHealSync = 0;

    fetch(`/api/rooms/${this.matchConfig.roomCode}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: this.matchConfig.playerId,
        x: this.px,
        y: this.py,
        z: this.pz,
        rotY: this.yaw,
        pitch: this.pitch,
        stance: this.stance,
        weaponId: this.slots[this.activeSlot].weaponId,
        helmetLevel: this.helmetLevel,
        vestLevel: this.vestLevel,
        healAmount: healAmt,
        pickedLootIds: lootBatch,
        shots: shotsBatch,
      }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; room?: RoomLobbyState }) => {
        if (data?.ok && data.room) {
          this.applyAuthoritativeRoomSnapshot(data.room);
        }
      })
      .catch(() => {})
      .finally(() => {
        this.mpSyncInFlight = false;
      });
  }

  private applyAuthoritativeRoomSnapshot(room: RoomLobbyState) {
    if (!this.matchConfig) return;

    this.teamAScore = room.teamAScore;
    this.teamBScore = room.teamBScore;
    this.killFeed = room.killFeed;

    if (room.status === "ended") {
      this.matchEnded = true;
      this.winnerTeam = room.winnerTeam ?? null;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    }

    // Sync picked loot across clients
    for (const lid of room.pickedLootIds) {
      const item = this.worldLoot.find((w) => w.id === lid);
      if (item && !item.pickedUp) {
        item.pickedUp = true;
        this.lootVisuals?.markPickedUp(lid);
      }
    }

    // Sync local player authoritative HP, kills, deaths & respawn
    const me = room.players.find((p) => p.id === this.matchConfig!.playerId);
    if (me) {
      if (me.hp < this.hp) {
        this.damageFlashTs = Date.now();
      }
      if (this.hp <= 0 && me.hp > 0) {
        // Authoritative respawn!
        this.px = me.x;
        this.py = me.y;
        this.pz = me.z;
      }
      this.hp = me.hp;
      this.kills = me.kills;
      this.deaths = me.deaths;
    }

    // Reconcile remote players & server bots
    const seenIds = new Set<string>();
    const allUnits = [
      ...room.players.filter((p) => p.id !== this.matchConfig!.playerId),
      ...room.bots,
    ];

    for (const u of allUnits) {
      seenIds.add(u.id);
      let ent = this.remoteEntities.get(u.id);
      if (!ent) {
        const model = new CharacterModel(u.id, u.name, u.team, false);
        model.setWeapon(u.weaponId);
        this.scene.add(model.root);
        ent = {
          id: u.id,
          name: u.name,
          team: u.team,
          isBot: Boolean(u.isBot),
          currX: u.x,
          currY: u.y,
          currZ: u.z,
          currRotY: u.rotY,
          targetX: u.x,
          targetY: u.y,
          targetZ: u.z,
          targetRotY: u.rotY,
          pitch: u.pitch,
          stance: u.stance,
          hp: u.hp,
          weaponId: u.weaponId,
          helmetLevel: u.helmetLevel || 1,
          vestLevel: u.vestLevel || 1,
          recentlyFiredTimer: 0,
          model,
        };
        this.remoteEntities.set(u.id, ent);
      } else {
        // Snap immediately if respawn teleported > 25m
        if (Math.hypot(u.x - ent.currX, u.z - ent.currZ) > 25) {
          ent.currX = u.x;
          ent.currY = u.y;
          ent.currZ = u.z;
        }
        ent.targetX = u.x;
        ent.targetY = u.y;
        ent.targetZ = u.z;
        ent.targetRotY = u.rotY;
        ent.pitch = u.pitch;
        ent.stance = u.stance;
        ent.hp = u.hp;
        ent.weaponId = u.weaponId;
        ent.helmetLevel = u.helmetLevel || 1;
        ent.vestLevel = u.vestLevel || 1;
      }
    }

    for (const [id, ent] of this.remoteEntities.entries()) {
      if (!seenIds.has(id)) {
        this.scene.remove(ent.model.root);
        this.remoteEntities.delete(id);
      }
    }

    // Play remote shot tracers & spatial audio
    for (const s of room.recentShots) {
      if (this.processedShotIds.has(s.id)) continue;
      this.processedShotIds.add(s.id);
      if (s.shooterId === this.matchConfig.playerId) continue;

      const rem = this.remoteEntities.get(s.shooterId);
      if (rem) {
        rem.recentlyFiredTimer = 1.4;
        rem.model.triggerMuzzleFlash();
      }

      const start = new THREE.Vector3(s.ox, s.oy, s.oz);
      const end = new THREE.Vector3(s.tx, s.ty, s.tz);
      this.spawnTracer(start, end, s.team === "A" ? 0x38bdf8 : 0xfb7185);
      const dist = Math.hypot(s.ox - this.px, s.oz - this.pz);
      if (dist < 145) {
        this.sound.playGunshot(s.weaponId, dist);
      }
    }

    if (this.processedShotIds.size > 250) {
      const arr = Array.from(this.processedShotIds).slice(-120);
      this.processedShotIds = new Set(arr);
    }
  }

  // =========================================================
  // MAIN GAME LOOP & CAMERA CONTROLLER
  // =========================================================
  private getStanceBodyHeight(): number {
    return this.stance === PlayerStance.Prone
      ? 0.52
      : this.stance === PlayerStance.Crouch
      ? 1.16
      : 1.72;
  }

  private getEyeHeight(): number {
    return this.stance === PlayerStance.Prone
      ? 0.44
      : this.stance === PlayerStance.Crouch
      ? 1.06
      : 1.56;
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      this.animFrameId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.elapsed += dt;

      this.fpsAccum += dt;
      this.fpsFrames += 1;
      if (this.fpsAccum >= 0.5) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      this.terrainWorld.update(this.elapsed);
      this.buildingFactory.update(this.elapsed);
      this.foliageSystem.update(this.elapsed);

      if (!this.isMatchActive) {
        this.updateLobbyPreviewCamera();
      } else {
        this.updateActiveMatch(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private updateLobbyPreviewCamera() {
    // Cinematic Golden Hour orbit around Pochinki Central 3-Stage HQ & Red-Smoke Airdrop
    const radius = 38;
    const angle = this.elapsed * 0.14;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(cx, 15.5 + Math.sin(this.elapsed * 0.35) * 2.5, cz);
    this.camera.lookAt(2, 5.2, -1);
  }

  private updateActiveMatch(dt: number) {
    if (!this.matchConfig) return;

    this.lootVisuals?.update(this.elapsed, this.px, this.pz);
    this.updateParticles(dt);

    // Passive Energy Boost regen
    if (this.boost > 0 && this.hp > 0 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + dt * 1.4);
      this.boost = Math.max(0, this.boost - dt * 1.8);
    }

    // Local Player Respawn in Offline Mode
    if (this.hp <= 0 && this.matchConfig.mode === "offline") {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        const sp = getTeamSpawnPoint(this.matchConfig.playerTeam, 0);
        this.px = sp.x;
        this.py = sp.y;
        this.pz = sp.z;
        this.hp = 100;
        this.slots[0].ammoInMag = WEAPONS[this.slots[0].weaponId].magSize;
        this.slots[1].ammoInMag = WEAPONS[this.slots[1].weaponId].magSize;
      }
    }

    if (!this.isPaused && this.hp > 0 && !this.matchEnded) {
      this.updateLocalPlayerMovementAndActions(dt);
    }

    this.updateMatchCamera(dt);

    if (this.matchConfig.mode === "offline") {
      this.updateOfflineBots(dt);
    } else {
      this.updateMultiplayerSync(dt);
    }

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private updateLocalPlayerMovementAndActions(dt: number) {
    // 1. Movement Input (Keyboard WASD merged with Virtual Joystick)
    let inputX =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    let inputForward =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);

    if (Math.abs(this.stickMoveX) > 0.04 || Math.abs(this.stickMoveY) > 0.04) {
      inputX = this.stickMoveX;
      inputForward = -this.stickMoveY;
    }

    const inputLen = Math.hypot(inputX, inputForward);
    if (inputLen > 1) {
      inputX /= inputLen;
      inputForward /= inputLen;
    }

    const sprinting =
      (this.keys.has("ShiftLeft") || this.stickMoveY < -0.86) &&
      inputForward > 0.5 &&
      !this.isScoped &&
      !this.isHealing &&
      this.stance === PlayerStance.Stand;

    const boostMult = this.boost > 40 ? 1.07 : 1.0;
    let maxSpeed = 5.4 * boostMult;
    if (sprinting) maxSpeed = 8.4 * boostMult;
    else if (this.stance === PlayerStance.Crouch) maxSpeed = 3.2;
    else if (this.stance === PlayerStance.Prone) maxSpeed = 1.65;
    if (this.isScoped) maxSpeed *= 0.65;
    if (this.isHealing) maxSpeed *= 0.45;

    const forwardVecX = -Math.sin(this.yaw);
    const forwardVecZ = -Math.cos(this.yaw);
    const rightVecX = Math.cos(this.yaw);
    const rightVecZ = -Math.sin(this.yaw);

    const targetVx = (forwardVecX * inputForward + rightVecX * inputX) * maxSpeed;
    const targetVz = (forwardVecZ * inputForward + rightVecZ * inputX) * maxSpeed;

    this.vx = THREE.MathUtils.lerp(this.vx, targetVx, 16 * dt);
    this.vz = THREE.MathUtils.lerp(this.vz, targetVz, 16 * dt);

    const resolved = this.collision.resolveCharacter({
      x: this.px,
      y: this.py,
      z: this.pz,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      dt,
      radius: 0.36,
      height: this.getStanceBodyHeight(),
      grounded: this.grounded,
    });

    this.px = resolved.x;
    this.py = resolved.y;
    this.pz = resolved.z;
    this.vy = resolved.vy;
    this.grounded = resolved.grounded;
    this.currentFloorLabel = resolved.floorLabel;

    const horizSpeed = Math.hypot(this.vx, this.vz);
    if (this.grounded && horizSpeed > 1.2) {
      this.footstepTimer -= dt * (horizSpeed * 0.42);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 1.0;
        this.sound.playFootstep();
      }
    }

    this.playerModel?.updateTransformAndAnim({
      x: this.px,
      y: this.py,
      z: this.pz,
      rotY: this.yaw,
      pitch: this.pitch,
      stance: this.stance,
      moveSpeed: horizSpeed,
      hp: this.hp,
      dt,
    });

    // 2. Weapon Fire, Reload & Heal Cast Timers
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.isReloading) {
      this.reloadTimer += dt;
      if (this.reloadTimer >= this.reloadDuration) {
        this.isReloading = false;
        const slot = this.slots[this.activeSlot];
        const spec = WEAPONS[slot.weaponId];
        const needed = spec.magSize - slot.ammoInMag;
        const avail = this.ammoReserve[spec.ammoType] || 0;
        const loaded = Math.min(needed, avail);
        slot.ammoInMag += loaded;
        this.ammoReserve[spec.ammoType] = avail - loaded;
        this.rebuildBackpackSync();
      }
    }

    if (this.isHealing) {
      this.healTimer += dt;
      if (this.healTimer >= this.healDuration) {
        this.isHealing = false;
        const med = this.selectedMed;
        if (this.medCounts[med] > 0) {
          this.medCounts[med] -= 1;
          const mSpec = MED_SPECS[med];
          const prevHp = this.hp;
          this.hp = Math.min(mSpec.maxCapHp, Math.max(this.hp, this.hp + mSpec.healAmount));
          this.boost = Math.min(100, this.boost + mSpec.boostAdd);
          this.pendingHealSync += Math.max(0, this.hp - prevHp);
          this.sound.playHealComplete();
          this.rebuildBackpackSync();
        }
      }
    }

    if (this.mouseShootHeld || this.virtualShootHeld) {
      this.tryFireWeapon();
    }
  }

  private updateMatchCamera(dt: number) {
    const eyeY = this.py + this.getEyeHeight();
    const activeScope = this.slots[this.activeSlot].scope;
    const targetFov = this.isScoped ? SCOPES[activeScope].fov : 72;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 18 * dt);
    this.camera.updateProjectionMatrix();

    const lookQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")
    );
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(lookQuat);

    if (this.isScoped) {
      // Crisp First-Person Optical Scope Camera!
      if (this.playerModel) this.playerModel.root.visible = false;
      const scopePos = new THREE.Vector3(this.px, eyeY, this.pz).addScaledVector(
        forward,
        0.22
      );
      this.camera.position.copy(scopePos);
      this.camera.quaternion.copy(lookQuat);
    } else {
      if (this.playerModel) this.playerModel.root.visible = this.hp > 0;
      // PUBG Mobile Over-The-Shoulder Third-Person Camera with Wall Pullback!
      const anchor = new THREE.Vector3(this.px, eyeY + 0.16, this.pz).addScaledVector(
        right,
        0.52
      );
      const desiredBackDist = this.stance === PlayerStance.Prone ? 2.1 : 2.55;
      const backDir = forward.clone().negate();

      const camHit = this.collision.raycastSolid(anchor, backDir, desiredBackDist);
      const safeDist = camHit ? Math.max(0.45, camHit.distance - 0.25) : desiredBackDist;

      const camPos = anchor.clone().addScaledVector(backDir, safeDist);
      this.camera.position.copy(camPos);
      this.camera.quaternion.copy(lookQuat);
    }
  }

  private emitHudSnapshot() {
    if (!this.onHudUpdate || !this.matchConfig) return;

    const minimapEntities: MinimapEntity[] = [
      {
        id: this.matchConfig.playerId,
        x: this.px,
        z: this.pz,
        rotY: this.yaw,
        team: this.matchConfig.playerTeam,
        isLocal: true,
      },
    ];

    for (const drop of AIRDROP_SPOTS) {
      minimapEntities.push({
        id: drop.id,
        x: drop.x,
        z: drop.z,
        team: "airdrop",
      });
    }

    let teamAAlive = this.hp > 0 && this.matchConfig.playerTeam === "A" ? 1 : 0;
    let teamBAlive = this.hp > 0 && this.matchConfig.playerTeam === "B" ? 1 : 0;

    if (this.matchConfig.mode === "offline") {
      for (const b of this.offlineBots) {
        if (b.hp <= 0) continue;
        if (b.team === "A") teamAAlive++;
        else teamBAlive++;

        const isAlly = b.team === this.matchConfig.playerTeam;
        if (isAlly || b.recentlyFiredTimer > 0) {
          minimapEntities.push({
            id: b.id,
            x: b.x,
            z: b.z,
            team: b.team,
            firing: b.recentlyFiredTimer > 0,
          });
        }
      }
    } else {
      for (const r of this.remoteEntities.values()) {
        if (r.hp <= 0) continue;
        if (r.team === "A") teamAAlive++;
        else teamBAlive++;

        const isAlly = r.team === this.matchConfig.playerTeam;
        if (isAlly || r.recentlyFiredTimer > 0) {
          minimapEntities.push({
            id: r.id,
            x: r.currX,
            z: r.currZ,
            team: r.team,
            firing: r.recentlyFiredTimer > 0,
          });
        }
      }
    }

    // Compass bearing (0 = North -Z, 90 = East +X, 180 = South +Z, 270 = West -X)
    const rawDeg = ((-this.yaw * 180) / Math.PI) % 360;
    const compassDeg = Math.round((rawDeg + 360) % 360);

    const hitActive = Date.now() - this.hitMarker.ts < 170;

    this.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      boost: Math.round(this.boost),
      stance: this.stance,
      isSprinting:
        this.keys.has("ShiftLeft") &&
        this.stance === PlayerStance.Stand &&
        !this.isScoped,
      isScoped: this.isScoped,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading
        ? Math.min(1, this.reloadTimer / this.reloadDuration)
        : 0,
      isHealing: this.isHealing,
      healProgress: this.isHealing
        ? Math.min(1, this.healTimer / this.healDuration)
        : 0,
      selectedMed: this.selectedMed,
      activeSlot: this.activeSlot,
      slots: [
        { ...this.slots[0] },
        { ...this.slots[1] },
      ],
      ammoReserve: { ...this.ammoReserve },
      medCounts: { ...this.medCounts },
      backpackItems: [...this.backpackItems],
      nearbyLoot: this.getNearbyLoot(),
      helmetLevel: this.helmetLevel,
      vestLevel: this.vestLevel,
      compassDeg,
      kills: this.kills,
      deaths: this.deaths,
      teamAScore: this.teamAScore,
      teamBScore: this.teamBScore,
      scoreLimit: this.matchConfig.scoreLimit,
      teamAAlive,
      teamBAlive,
      fps: this.currentFps,
      killFeed: this.killFeed,
      hitMarker: { ...this.hitMarker, active: hitActive },
      damageFlashTs: this.damageFlashTs,
      minimapEntities,
      playerPos: { x: this.px, y: this.py, z: this.pz, rotY: this.yaw },
      currentFloorLabel: this.currentFloorLabel,
      matchEnded: this.matchEnded,
      winnerTeam: this.winnerTeam,
    });
  }

  public dispose() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.stopMatchEntities();
    this.renderer.dispose();
  }
}
