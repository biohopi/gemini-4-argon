import { db } from "@/db";
import { matchHistory, roomPlayers, rooms } from "@/db/schema";
import {
  KillFeedEntry,
  NetPlayerState,
  NetShotEvent,
  PlayerStance,
  RoomLobbyState,
  TeamId,
  TimeOfDay,
  WeaponId,
} from "@/game/types";
import { WEAPONS } from "@/game/weapons";
import {
  COMPOUND_BUILDINGS,
  getTeamSpawnPoint,
  getTerrainHeight,
  WORLD_HALF_SIZE,
} from "@/game/worldData";
import { desc, eq } from "drizzle-orm";

interface ServerBotInternal extends NetPlayerState {
  targetX: number;
  targetZ: number;
  fireCooldown: number;
  respawnAt: number;
  strafePhase: number;
}

interface LiveRoom {
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
  players: Map<string, NetPlayerState & { respawnAt?: number }>;
  bots: Map<string, ServerBotInternal>;
  recentShots: NetShotEvent[];
  killFeed: KillFeedEntry[];
  pickedLootIds: Set<string>;
  winnerTeam: TeamId | null;
  startedAt: number;
  lastBotTick: number;
  lastDbSync: number;
  matchSaved: boolean;
}

const BOT_CALLSIGNS_A = [
  "Ghost_A1",
  "Falcon_A2",
  "Viper_A3",
  "Frost_A4",
  "Titan_A5",
  "Nomad_A6",
  "Spectre_A7",
  "Lynx_A8",
  "Cobalt_A9",
  "Aegis_A10",
  "Striker_A11",
  "Raptor_A12",
];

const BOT_CALLSIGNS_B = [
  "Reaper_B1",
  "Kobra_B2",
  "Havoc_B3",
  "Blaze_B4",
  "Shadow_B5",
  "Vandal_B6",
  "Onyx_B7",
  "Draco_B8",
  "Pyro_B9",
  "Wraith_B10",
  "executioner_B11",
  "Jackal_B12",
];

const BOT_WEAPONS: WeaponId[] = ["M416", "AKM", "SCAR_L", "UMP45", "KAR98K"];

const globalForRooms = globalThis as typeof globalThis & {
  __battlegroundsRooms?: Map<string, LiveRoom>;
};

const liveRooms: Map<string, LiveRoom> =
  globalForRooms.__battlegroundsRooms ?? new Map<string, LiveRoom>();

if (!globalForRooms.__battlegroundsRooms) {
  globalForRooms.__battlegroundsRooms = liveRooms;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function pickNewObjective(): { x: number; z: number } {
  const b = COMPOUND_BUILDINGS[Math.floor(Math.random() * COMPOUND_BUILDINGS.length)];
  return {
    x: b.x + (Math.random() - 0.5) * 26,
    z: b.z + (Math.random() - 0.5) * 26,
  };
}

function spawnRoomBots(room: LiveRoom) {
  room.bots.clear();

  const createTeamBots = (team: TeamId, count: number, names: string[]) => {
    for (let i = 0; i < count; i++) {
      const id = `bot_${team}_${i + 1}`;
      const sp = getTeamSpawnPoint(team, i + 3);
      const obj = pickNewObjective();
      const wep = BOT_WEAPONS[(i + (team === "A" ? 0 : 2)) % BOT_WEAPONS.length];
      room.bots.set(id, {
        id,
        name: names[i % names.length] || `Bot_${team}${i + 1}`,
        team,
        isHost: false,
        isReady: true,
        isBot: true,
        x: sp.x,
        y: sp.y,
        z: sp.z,
        rotY: sp.rotY,
        pitch: 0,
        stance: PlayerStance.Stand,
        hp: 100,
        maxHp: 100,
        weaponId: wep,
        kills: 0,
        deaths: 0,
        helmetLevel: 1 + (i % 2),
        vestLevel: 1 + (i % 2),
        lastUpdated: Date.now(),
        targetX: obj.x,
        targetZ: obj.z,
        fireCooldown: 0.6 + Math.random() * 1.2,
        respawnAt: 0,
        strafePhase: Math.random() * Math.PI * 2,
      });
    }
  };

  createTeamBots("A", room.teamABots, BOT_CALLSIGNS_A);
  createTeamBots("B", room.teamBBots, BOT_CALLSIGNS_B);
}

function serializeRoom(room: LiveRoom): RoomLobbyState {
  const now = Date.now();
  // Prune shots older than 1.6s
  room.recentShots = room.recentShots.filter((s) => now - s.timestamp < 1600);
  // Keep latest 8 killfeed entries
  if (room.killFeed.length > 8) {
    room.killFeed = room.killFeed.slice(-8);
  }

  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    teamAMaxPlayers: room.teamAMaxPlayers,
    teamBMaxPlayers: room.teamBMaxPlayers,
    teamABots: room.teamABots,
    teamBBots: room.teamBBots,
    timeOfDay: room.timeOfDay,
    scoreLimit: room.scoreLimit,
    teamAScore: room.teamAScore,
    teamBScore: room.teamBScore,
    seed: room.seed,
    players: Array.from(room.players.values()),
    bots: Array.from(room.bots.values()),
    recentShots: room.recentShots,
    killFeed: room.killFeed,
    pickedLootIds: Array.from(room.pickedLootIds),
    winnerTeam: room.winnerTeam,
  };
}

export async function listActiveRooms(): Promise<RoomLobbyState[]> {
  const now = Date.now();
  // Clean stale waiting rooms older than 45 min with no recent players
  for (const [code, r] of liveRooms.entries()) {
    const anyRecent = Array.from(r.players.values()).some(
      (p) => now - p.lastUpdated < 15 * 60 * 1000
    );
    if (!anyRecent && now - r.lastDbSync > 30 * 60 * 1000) {
      liveRooms.delete(code);
    }
  }

  // Hydrate from DB if liveRooms is empty (e.g. cold boot)
  if (liveRooms.size === 0) {
    try {
      const dbRooms = await db
        .select()
        .from(rooms)
        .orderBy(desc(rooms.updatedAt))
        .limit(10);
      for (const r of dbRooms) {
        if (r.status === "ended") continue;
        const dbPlayers = await db
          .select()
          .from(roomPlayers)
          .where(eq(roomPlayers.roomCode, r.code));
        const pMap = new Map<string, NetPlayerState & { respawnAt?: number }>();
        for (const dp of dbPlayers) {
          pMap.set(dp.playerId, {
            id: dp.playerId,
            name: dp.playerName,
            team: (dp.team === "B" ? "B" : "A") as TeamId,
            isHost: dp.isHost,
            isReady: dp.isReady,
            x: dp.posX,
            y: dp.posY,
            z: dp.posZ,
            rotY: dp.rotY,
            pitch: dp.pitch,
            stance: dp.stance as PlayerStance,
            hp: dp.hp,
            maxHp: 100,
            weaponId: (dp.weaponId as WeaponId) || "M416",
            kills: dp.kills,
            deaths: dp.deaths,
            helmetLevel: 1,
            vestLevel: 1,
            lastUpdated: dp.lastSeenAt.getTime(),
          });
        }
        if (pMap.size > 0) {
          const hydrated: LiveRoom = {
            code: r.code,
            name: r.name,
            hostId: r.hostId,
            hostName: r.hostName,
            status: (r.status as "waiting" | "playing" | "ended") || "waiting",
            teamAMaxPlayers: r.teamAMaxPlayers,
            teamBMaxPlayers: r.teamBMaxPlayers,
            teamABots: r.teamABots,
            teamBBots: r.teamBBots,
            timeOfDay: (r.timeOfDay as TimeOfDay) || "golden",
            scoreLimit: r.scoreLimit,
            teamAScore: r.teamAScore,
            teamBScore: r.teamBScore,
            seed: r.seed,
            players: pMap,
            bots: new Map(),
            recentShots: [],
            killFeed: [],
            pickedLootIds: new Set(),
            winnerTeam: null,
            startedAt: Date.now(),
            lastBotTick: Date.now(),
            lastDbSync: Date.now(),
            matchSaved: false,
          };
          if (hydrated.status === "playing") {
            spawnRoomBots(hydrated);
          }
          liveRooms.set(r.code, hydrated);
        }
      }
    } catch {
      // Safe fallback if table isn't pushed yet during boot
    }
  }

  return Array.from(liveRooms.values())
    .filter((r) => r.status !== "ended")
    .map(serializeRoom);
}

export async function createMultiplayerRoom(input: {
  hostId: string;
  hostName: string;
  roomName?: string;
  teamAMaxPlayers?: number;
  teamBMaxPlayers?: number;
  teamABots?: number;
  teamBBots?: number;
  timeOfDay?: TimeOfDay;
  scoreLimit?: number;
}): Promise<RoomLobbyState> {
  let code = generateRoomCode();
  while (liveRooms.has(code)) {
    code = generateRoomCode();
  }

  const sp = getTeamSpawnPoint("A", 0);
  const hostPlayer: NetPlayerState = {
    id: input.hostId,
    name: input.hostName.trim().slice(0, 24) || "Operator_1",
    team: "A",
    isHost: true,
    isReady: true,
    x: sp.x,
    y: sp.y,
    z: sp.z,
    rotY: sp.rotY,
    pitch: 0,
    stance: PlayerStance.Stand,
    hp: 100,
    maxHp: 100,
    weaponId: "M416",
    kills: 0,
    deaths: 0,
    helmetLevel: 1,
    vestLevel: 1,
    lastUpdated: Date.now(),
  };

  const room: LiveRoom = {
    code,
    name: input.roomName?.trim() || `${hostPlayer.name}'s Tactical Squad`,
    hostId: input.hostId,
    hostName: hostPlayer.name,
    status: "waiting",
    teamAMaxPlayers: Math.max(1, Math.min(16, input.teamAMaxPlayers ?? 4)),
    teamBMaxPlayers: Math.max(1, Math.min(16, input.teamBMaxPlayers ?? 4)),
    teamABots: Math.max(0, Math.min(12, input.teamABots ?? 4)),
    teamBBots: Math.max(0, Math.min(12, input.teamBBots ?? 5)),
    timeOfDay: input.timeOfDay ?? "golden",
    scoreLimit: Math.max(10, Math.min(100, input.scoreLimit ?? 30)),
    teamAScore: 0,
    teamBScore: 0,
    seed: Math.floor(100000 + Math.random() * 899999),
    players: new Map([[hostPlayer.id, hostPlayer]]),
    bots: new Map(),
    recentShots: [],
    killFeed: [],
    pickedLootIds: new Set(),
    winnerTeam: null,
    startedAt: Date.now(),
    lastBotTick: Date.now(),
    lastDbSync: Date.now(),
    matchSaved: false,
  };

  liveRooms.set(code, room);

  try {
    await db.insert(rooms).values({
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      hostName: room.hostName,
      status: room.status,
      teamAMaxPlayers: room.teamAMaxPlayers,
      teamBMaxPlayers: room.teamBMaxPlayers,
      teamABots: room.teamABots,
      teamBBots: room.teamBBots,
      timeOfDay: room.timeOfDay,
      scoreLimit: room.scoreLimit,
      seed: room.seed,
    });
    await db.insert(roomPlayers).values({
      roomCode: room.code,
      playerId: hostPlayer.id,
      playerName: hostPlayer.name,
      team: "A",
      isHost: true,
      isReady: true,
      posX: hostPlayer.x,
      posY: hostPlayer.y,
      posZ: hostPlayer.z,
      rotY: hostPlayer.rotY,
    });
  } catch {
    // Non-fatal if DB sync lags
  }

  return serializeRoom(room);
}

export async function getRoomByCode(rawCode: string): Promise<RoomLobbyState | null> {
  const code = rawCode.trim().toUpperCase();
  if (!liveRooms.has(code)) {
    await listActiveRooms();
  }
  const room = liveRooms.get(code);
  return room ? serializeRoom(room) : null;
}

export async function joinMultiplayerRoom(input: {
  code: string;
  playerId: string;
  playerName: string;
  preferredTeam?: TeamId;
}): Promise<{ ok: boolean; error?: string; room?: RoomLobbyState }> {
  const code = input.code.trim().toUpperCase();
  if (!liveRooms.has(code)) {
    await listActiveRooms();
  }
  const room = liveRooms.get(code);
  if (!room) {
    return { ok: false, error: "Room code not found." };
  }

  const existing = room.players.get(input.playerId);
  if (existing) {
    existing.name = input.playerName.trim().slice(0, 24) || existing.name;
    existing.lastUpdated = Date.now();
    return { ok: true, room: serializeRoom(room) };
  }

  const countA = Array.from(room.players.values()).filter((p) => p.team === "A").length;
  const countB = Array.from(room.players.values()).filter((p) => p.team === "B").length;

  let assignedTeam: TeamId | null = null;
  if (input.preferredTeam === "A" && countA < room.teamAMaxPlayers) {
    assignedTeam = "A";
  } else if (input.preferredTeam === "B" && countB < room.teamBMaxPlayers) {
    assignedTeam = "B";
  } else if (countA <= countB && countA < room.teamAMaxPlayers) {
    assignedTeam = "A";
  } else if (countB < room.teamBMaxPlayers) {
    assignedTeam = "B";
  } else if (countA < room.teamAMaxPlayers) {
    assignedTeam = "A";
  }

  if (!assignedTeam) {
    return { ok: false, error: "Both teams are at maximum player capacity." };
  }

  const sp = getTeamSpawnPoint(assignedTeam, room.players.size);
  const newPlayer: NetPlayerState = {
    id: input.playerId,
    name: input.playerName.trim().slice(0, 24) || `Operator_${room.players.size + 1}`,
    team: assignedTeam,
    isHost: room.hostId === input.playerId,
    isReady: true,
    x: sp.x,
    y: sp.y,
    z: sp.z,
    rotY: sp.rotY,
    pitch: 0,
    stance: PlayerStance.Stand,
    hp: 100,
    maxHp: 100,
    weaponId: "M416",
    kills: 0,
    deaths: 0,
    helmetLevel: 1,
    vestLevel: 1,
    lastUpdated: Date.now(),
  };

  room.players.set(newPlayer.id, newPlayer);

  try {
    await db.insert(roomPlayers).values({
      roomCode: room.code,
      playerId: newPlayer.id,
      playerName: newPlayer.name,
      team: newPlayer.team,
      isHost: newPlayer.isHost,
      isReady: true,
      posX: newPlayer.x,
      posY: newPlayer.y,
      posZ: newPlayer.z,
      rotY: newPlayer.rotY,
    });
  } catch {
    // ignore duplicate
  }

  return { ok: true, room: serializeRoom(room) };
}

export async function updateRoomLobby(
  rawCode: string,
  payload: {
    playerId: string;
    action: "config" | "switch_team" | "toggle_ready" | "start_match";
    teamAMaxPlayers?: number;
    teamBMaxPlayers?: number;
    teamABots?: number;
    teamBBots?: number;
    timeOfDay?: TimeOfDay;
    scoreLimit?: number;
    targetTeam?: TeamId;
  }
): Promise<{ ok: boolean; error?: string; room?: RoomLobbyState }> {
  const code = rawCode.trim().toUpperCase();
  const room = liveRooms.get(code);
  if (!room) return { ok: false, error: "Room not found." };

  const player = room.players.get(payload.playerId);
  if (!player) return { ok: false, error: "Player not in room." };
  player.lastUpdated = Date.now();

  if (payload.action === "config") {
    if (room.hostId !== payload.playerId) {
      return { ok: false, error: "Only the room host can edit team and bot counts." };
    }
    if (typeof payload.teamAMaxPlayers === "number") {
      room.teamAMaxPlayers = Math.max(1, Math.min(16, payload.teamAMaxPlayers));
    }
    if (typeof payload.teamBMaxPlayers === "number") {
      room.teamBMaxPlayers = Math.max(1, Math.min(16, payload.teamBMaxPlayers));
    }
    if (typeof payload.teamABots === "number") {
      room.teamABots = Math.max(0, Math.min(12, payload.teamABots));
    }
    if (typeof payload.teamBBots === "number") {
      room.teamBBots = Math.max(0, Math.min(12, payload.teamBBots));
    }
    if (payload.timeOfDay) {
      room.timeOfDay = payload.timeOfDay;
    }
    if (typeof payload.scoreLimit === "number") {
      room.scoreLimit = Math.max(10, Math.min(100, payload.scoreLimit));
    }

    try {
      await db
        .update(rooms)
        .set({
          teamAMaxPlayers: room.teamAMaxPlayers,
          teamBMaxPlayers: room.teamBMaxPlayers,
          teamABots: room.teamABots,
          teamBBots: room.teamBBots,
          timeOfDay: room.timeOfDay,
          scoreLimit: room.scoreLimit,
          updatedAt: new Date(),
        })
        .where(eq(rooms.code, room.code));
    } catch {
      // non-fatal
    }
  } else if (payload.action === "switch_team") {
    const desired: TeamId = payload.targetTeam ?? (player.team === "A" ? "B" : "A");
    const countTarget = Array.from(room.players.values()).filter(
      (p) => p.team === desired && p.id !== player.id
    ).length;
    const cap = desired === "A" ? room.teamAMaxPlayers : room.teamBMaxPlayers;
    if (countTarget >= cap) {
      return { ok: false, error: `Team ${desired === "A" ? "Alpha" : "Bravo"} is full.` };
    }
    player.team = desired;
    const sp = getTeamSpawnPoint(desired, countTarget);
    player.x = sp.x;
    player.y = sp.y;
    player.z = sp.z;
    player.rotY = sp.rotY;
  } else if (payload.action === "toggle_ready") {
    player.isReady = !player.isReady;
  } else if (payload.action === "start_match") {
    if (room.hostId !== payload.playerId) {
      return { ok: false, error: "Only host can start the match." };
    }
    room.status = "playing";
    room.teamAScore = 0;
    room.teamBScore = 0;
    room.winnerTeam = null;
    room.startedAt = Date.now();
    room.lastBotTick = Date.now();
    room.matchSaved = false;

    // Reset player spawns
    let idxA = 0;
    let idxB = 0;
    for (const p of room.players.values()) {
      const sp = getTeamSpawnPoint(p.team, p.team === "A" ? idxA++ : idxB++);
      p.x = sp.x;
      p.y = sp.y;
      p.z = sp.z;
      p.rotY = sp.rotY;
      p.hp = 100;
      p.kills = 0;
      p.deaths = 0;
    }

    spawnRoomBots(room);

    try {
      await db
        .update(rooms)
        .set({ status: "playing", updatedAt: new Date() })
        .where(eq(rooms.code, room.code));
    } catch {
      // non-fatal
    }
  }

  return { ok: true, room: serializeRoom(room) };
}

function registerElimination(
  room: LiveRoom,
  killer: { id: string; name: string; team: TeamId; kills: number },
  victim: NetPlayerState & { respawnAt?: number },
  weaponName: string,
  headshot: boolean
) {
  killer.kills += 1;
  victim.deaths += 1;
  victim.hp = 0;
  victim.respawnAt = Date.now() + 3500;

  if (killer.team === "A") room.teamAScore += 1;
  else room.teamBScore += 1;

  room.killFeed.push({
    id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    killerName: killer.name,
    killerTeam: killer.team,
    victimName: victim.name,
    victimTeam: victim.team,
    weaponName,
    headshot,
    timestamp: Date.now(),
  });

  if (room.status === "playing") {
    if (room.teamAScore >= room.scoreLimit) {
      room.status = "ended";
      room.winnerTeam = "A";
    } else if (room.teamBScore >= room.scoreLimit) {
      room.status = "ended";
      room.winnerTeam = "B";
    }

    if (room.status === "ended" && !room.matchSaved) {
      room.matchSaved = true;
      const allCombatants = [
        ...Array.from(room.players.values()),
        ...Array.from(room.bots.values()),
      ];
      allCombatants.sort((a, b) => b.kills - a.kills);
      const mvp = allCombatants[0];
      db.insert(matchHistory)
        .values({
          roomCode: room.code,
          mode: "multiplayer",
          winnerTeam: room.winnerTeam === "A" ? "TEAM ALPHA" : "TEAM BRAVO",
          teamAScore: room.teamAScore,
          teamBScore: room.teamBScore,
          mvpName: mvp?.name ?? "Operator",
          mvpKills: mvp?.kills ?? 0,
          durationSec: Math.max(10, Math.round((Date.now() - room.startedAt) / 1000)),
        })
        .catch(() => {});
    }
  }
}

function stepServerBots(room: LiveRoom, dt: number) {
  if (room.status !== "playing") return;
  const now = Date.now();

  // Respawn any dead players or bots
  let spawnCounter = 2;
  for (const p of room.players.values()) {
    if (p.hp <= 0 && p.respawnAt && now >= p.respawnAt) {
      const sp = getTeamSpawnPoint(p.team, spawnCounter++);
      p.x = sp.x;
      p.y = sp.y;
      p.z = sp.z;
      p.hp = 100;
      p.respawnAt = 0;
    }
  }

  for (const bot of room.bots.values()) {
    if (bot.hp <= 0) {
      if (bot.respawnAt && now >= bot.respawnAt) {
        const sp = getTeamSpawnPoint(bot.team, spawnCounter++);
        bot.x = sp.x;
        bot.y = sp.y;
        bot.z = sp.z;
        bot.hp = 100;
        bot.respawnAt = 0;
        const obj = pickNewObjective();
        bot.targetX = obj.x;
        bot.targetZ = obj.z;
      }
      continue;
    }

    // Find closest enemy (player or bot)
    let closestEnemy: (NetPlayerState & { respawnAt?: number }) | null = null;
    let closestDist = 115;

    for (const p of room.players.values()) {
      if (p.team === bot.team || p.hp <= 0 || now - p.lastUpdated > 12000) continue;
      const d = Math.hypot(p.x - bot.x, p.z - bot.z);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = p;
      }
    }
    for (const otherBot of room.bots.values()) {
      if (otherBot.team === bot.team || otherBot.hp <= 0) continue;
      const d = Math.hypot(otherBot.x - bot.x, otherBot.z - bot.z);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = otherBot;
      }
    }

    bot.strafePhase += dt * 2.5;

    if (closestEnemy) {
      const dx = closestEnemy.x - bot.x;
      const dz = closestEnemy.z - bot.z;
      bot.rotY = Math.atan2(-dx, -dz);

      // Combat movement: advance if far, strafe if within 32m
      const speed = closestDist > 34 ? 5.4 : 3.2;
      if (closestDist > 26) {
        const len = Math.max(0.1, Math.hypot(dx, dz));
        bot.x += (dx / len) * speed * dt;
        bot.z += (dz / len) * speed * dt;
        bot.stance = PlayerStance.Stand;
      } else {
        const perpX = -dz / Math.max(0.1, Math.hypot(dx, dz));
        const perpZ = dx / Math.max(0.1, Math.hypot(dx, dz));
        const dir = Math.sin(bot.strafePhase) > 0 ? 1 : -1;
        bot.x += perpX * dir * speed * dt;
        bot.z += perpZ * dir * speed * dt;
        bot.stance = Math.cos(bot.strafePhase * 0.7) > 0.35 ? PlayerStance.Crouch : PlayerStance.Stand;
      }

      bot.fireCooldown -= dt;
      if (bot.fireCooldown <= 0) {
        const wep = WEAPONS[bot.weaponId];
        bot.fireCooldown = wep.category === "SR" ? 1.8 + Math.random() * 0.8 : 0.26 + Math.random() * 0.35;

        const hitChance = Math.max(0.14, 0.55 - closestDist / 160);
        const didHit = Math.random() < hitChance;
        const headshot = didHit && Math.random() < 0.14;
        const spread = didHit ? 0.15 : 1.6;
        const tx = closestEnemy.x + (Math.random() - 0.5) * spread;
        const ty = closestEnemy.y + (headshot ? 1.55 : 1.0) + (Math.random() - 0.5) * 0.3;
        const tz = closestEnemy.z + (Math.random() - 0.5) * spread;

        let dealt = 0;
        if (didHit && closestEnemy.hp > 0) {
          const rawDmg = wep.damage * 0.38 * (headshot ? 1.7 : 1.0);
          dealt = Math.max(6, Math.round(rawDmg));
          closestEnemy.hp = Math.max(0, closestEnemy.hp - dealt);
          if (closestEnemy.hp <= 0) {
            registerElimination(room, bot, closestEnemy, wep.name, headshot);
          }
        }

        room.recentShots.push({
          id: `bs_${now}_${Math.random().toString(36).slice(2, 6)}`,
          shooterId: bot.id,
          team: bot.team,
          weaponId: bot.weaponId,
          ox: bot.x,
          oy: bot.y + 1.35,
          oz: bot.z,
          tx,
          ty,
          tz,
          hitEntityId: didHit ? closestEnemy.id : undefined,
          damage: didHit ? dealt : undefined,
          headshot,
          timestamp: now,
        });
      }
    } else {
      // Patrol towards compound objective
      const dx = bot.targetX - bot.x;
      const dz = bot.targetZ - bot.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4.0) {
        const nextObj = pickNewObjective();
        bot.targetX = nextObj.x;
        bot.targetZ = nextObj.z;
      } else {
        bot.rotY = Math.atan2(-dx, -dz);
        bot.x += (dx / dist) * 5.8 * dt;
        bot.z += (dz / dist) * 5.8 * dt;
        bot.stance = PlayerStance.Stand;
      }
    }

    bot.x = Math.max(-WORLD_HALF_SIZE + 8, Math.min(WORLD_HALF_SIZE - 8, bot.x));
    bot.z = Math.max(-WORLD_HALF_SIZE + 8, Math.min(WORLD_HALF_SIZE - 8, bot.z));
    bot.y = getTerrainHeight(bot.x, bot.z);
    bot.lastUpdated = now;
  }
}

export async function syncPlayerTick(
  rawCode: string,
  payload: {
    playerId: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    pitch: number;
    stance: PlayerStance;
    weaponId: WeaponId;
    helmetLevel?: number;
    vestLevel?: number;
    healAmount?: number;
    pickedLootIds?: string[];
    shots?: {
      weaponId: WeaponId;
      ox: number;
      oy: number;
      oz: number;
      tx: number;
      ty: number;
      tz: number;
      hitEntityId?: string;
      headshot?: boolean;
    }[];
  }
): Promise<RoomLobbyState | null> {
  const code = rawCode.trim().toUpperCase();
  const room = liveRooms.get(code);
  if (!room) return null;

  const now = Date.now();
  const player = room.players.get(payload.playerId);

  if (player) {
    // Only accept position updates while alive; if server respawned player, client adopts new HP
    if (player.hp > 0) {
      player.x = payload.x;
      player.y = payload.y;
      player.z = payload.z;
      player.rotY = payload.rotY;
      player.pitch = payload.pitch;
      player.stance = payload.stance;
      player.weaponId = payload.weaponId;
      if (payload.helmetLevel) player.helmetLevel = payload.helmetLevel;
      if (payload.vestLevel) player.vestLevel = payload.vestLevel;
      if (payload.healAmount && payload.healAmount > 0) {
        player.hp = Math.min(100, player.hp + payload.healAmount);
      }
    }
    player.lastUpdated = now;

    if (payload.pickedLootIds?.length) {
      for (const lid of payload.pickedLootIds) {
        room.pickedLootIds.add(lid);
      }
    }

    if (payload.shots?.length && player.hp > 0 && room.status === "playing") {
      for (const s of payload.shots) {
        const wep = WEAPONS[s.weaponId] || WEAPONS.M416;
        let dealt = 0;

        if (s.hitEntityId) {
          const targetPlayer = room.players.get(s.hitEntityId);
          const targetBot = room.bots.get(s.hitEntityId);
          const target = targetPlayer ?? targetBot;

          if (target && target.team !== player.team && target.hp > 0) {
            const armorMitigation = s.headshot
              ? 1 - (target.helmetLevel || 1) * 0.12
              : 1 - (target.vestLevel || 1) * 0.12;
            const raw =
              wep.damage * (s.headshot ? wep.headshotMult : 1.0) * armorMitigation;
            dealt = Math.max(10, Math.round(raw));
            target.hp = Math.max(0, target.hp - dealt);

            if (target.hp <= 0) {
              registerElimination(room, player, target, wep.name, Boolean(s.headshot));
            }
          }
        }

        room.recentShots.push({
          id: `ps_${now}_${Math.random().toString(36).slice(2, 6)}`,
          shooterId: player.id,
          team: player.team,
          weaponId: s.weaponId,
          ox: s.ox,
          oy: s.oy,
          oz: s.oz,
          tx: s.tx,
          ty: s.ty,
          tz: s.tz,
          hitEntityId: s.hitEntityId,
          damage: dealt || undefined,
          headshot: s.headshot,
          timestamp: now,
        });
      }
    }
  }

  // Step server bots at ~12.5 Hz max across all incoming requests
  const elapsedSec = (now - room.lastBotTick) / 1000;
  if (elapsedSec >= 0.075) {
    const clampedDt = Math.min(0.25, elapsedSec);
    room.lastBotTick = now;
    stepServerBots(room, clampedDt);
  }

  // Periodic DB score checkpoint every 6 seconds
  if (now - room.lastDbSync > 6000) {
    room.lastDbSync = now;
    db.update(rooms)
      .set({
        teamAScore: room.teamAScore,
        teamBScore: room.teamBScore,
        status: room.status,
        updatedAt: new Date(),
      })
      .where(eq(rooms.code, room.code))
      .catch(() => {});
  }

  return serializeRoom(room);
}
