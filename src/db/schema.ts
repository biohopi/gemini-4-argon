import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  hostId: varchar("host_id", { length: 64 }).notNull(),
  hostName: varchar("host_name", { length: 48 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("waiting"), // waiting | playing | ended
  teamAMaxPlayers: integer("team_a_max_players").notNull().default(4),
  teamBMaxPlayers: integer("team_b_max_players").notNull().default(4),
  teamABots: integer("team_a_bots").notNull().default(4),
  teamBBots: integer("team_b_bots").notNull().default(5),
  timeOfDay: varchar("time_of_day", { length: 24 }).notNull().default("golden"), // golden | noon | dawn
  scoreLimit: integer("score_limit").notNull().default(30),
  teamAScore: integer("team_a_score").notNull().default(0),
  teamBScore: integer("team_b_score").notNull().default(0),
  seed: integer("seed").notNull().default(104729),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roomPlayers = pgTable("room_players", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 12 }).notNull(),
  playerId: varchar("player_id", { length: 64 }).notNull(),
  playerName: varchar("player_name", { length: 48 }).notNull(),
  team: varchar("team", { length: 4 }).notNull().default("A"), // A | B
  isHost: boolean("is_host").notNull().default(false),
  isReady: boolean("is_ready").notNull().default(true),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(2),
  posZ: real("pos_z").notNull().default(0),
  rotY: real("rot_y").notNull().default(0),
  pitch: real("pitch").notNull().default(0),
  stance: integer("stance").notNull().default(0),
  hp: integer("hp").notNull().default(100),
  weaponId: varchar("weapon_id", { length: 24 }).notNull().default("M416"),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

export const hudLayouts = pgTable("hud_layouts", {
  id: serial("id").primaryKey(),
  playerId: varchar("player_id", { length: 64 }).notNull().unique(),
  presetName: varchar("preset_name", { length: 48 }).notNull().default("Custom"),
  layoutJson: jsonb("layout_json").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const matchHistory = pgTable("match_history", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 16 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("offline"),
  winnerTeam: varchar("winner_team", { length: 16 }).notNull(),
  teamAScore: integer("team_a_score").notNull().default(0),
  teamBScore: integer("team_b_score").notNull().default(0),
  mvpName: varchar("mvp_name", { length: 48 }).notNull(),
  mvpKills: integer("mvp_kills").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
