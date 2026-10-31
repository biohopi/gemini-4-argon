"use client";

import {
  BotDifficulty,
  MatchConfig,
  RoomLobbyState,
  TeamId,
  TimeOfDay,
  WeaponId,
} from "@/game/types";
import { WEAPONS } from "@/game/weapons";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Crown,
  Gamepad2,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  Sliders,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface MatchHistoryRow {
  id: number;
  roomCode: string;
  mode: string;
  winnerTeam: string;
  teamAScore: number;
  teamBScore: number;
  mvpName: string;
  mvpKills: number;
  durationSec: number;
  createdAt: string;
}

interface LobbyScreenProps {
  playerId: string;
  playerName: string;
  initialTab: "offline" | "multiplayer";
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLaunch: () => void;
  onOpenLayoutEditor: () => void;
  onStartMatch: (config: MatchConfig) => void;
}

const WEAPON_CHOICES: WeaponId[] = [
  "M416",
  "AKM",
  "SCAR_L",
  "UMP45",
  "KAR98K",
  "AWM",
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerId,
  playerName,
  initialTab,
  isFullscreen,
  onToggleFullscreen,
  onBackToLaunch,
  onOpenLayoutEditor,
  onStartMatch,
}) => {
  const [tab, setTab] = useState<"offline" | "multiplayer" | "records">(
    initialTab
  );

  // Shared Loadout Selection (2 Main Weapons!)
  const [primaryWeapon, setPrimaryWeapon] = useState<WeaponId>("M416");
  const [secondaryWeapon, setSecondaryWeapon] = useState<WeaponId>("KAR98K");

  // Offline Mode Configuration
  const [offTeam, setOffTeam] = useState<TeamId>("A");
  const [offTeamABots, setOffTeamABots] = useState<number>(4);
  const [offTeamBBots, setOffTeamBBots] = useState<number>(5);
  const [offDifficulty, setOffDifficulty] = useState<BotDifficulty>("veteran");
  const [offTimeOfDay, setOffTimeOfDay] = useState<TimeOfDay>("golden");
  const [offScoreLimit, setOffScoreLimit] = useState<number>(25);

  // Multiplayer Room Creation & Connected Room State
  const [roomsList, setRoomsList] = useState<RoomLobbyState[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomLobbyState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [newRoomName, setNewRoomName] = useState(`${playerName}'s Squad Room`);
  const [mpTeamAMax, setMpTeamAMax] = useState(4);
  const [mpTeamBMax, setMpTeamBMax] = useState(4);
  const [mpTeamABots, setMpTeamABots] = useState(4);
  const [mpTeamBBots, setMpTeamBBots] = useState(5);
  const [mpTimeOfDay, setMpTimeOfDay] = useState<TimeOfDay>("golden");
  const [mpScoreLimit, setMpScoreLimit] = useState(30);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpBusy, setMpBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Match Records from PostgreSQL
  const [records, setRecords] = useState<MatchHistoryRow[]>([]);

  const fetchActiveRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (data?.ok && Array.isArray(data.rooms)) {
        setRoomsList(data.rooms);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  const fetchMatchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();
      if (data?.ok && Array.isArray(data.matches)) {
        setRecords(data.matches);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (tab === "multiplayer" && !activeRoom) {
      fetchActiveRooms();
      const id = setInterval(fetchActiveRooms, 2500);
      return () => clearInterval(id);
    }
    if (tab === "records") {
      fetchMatchRecords();
    }
  }, [tab, activeRoom, fetchActiveRooms, fetchMatchRecords]);

  const launchFromRoomState = useCallback(
    (room: RoomLobbyState) => {
      const me = room.players.find((p) => p.id === playerId);
      const myTeam: TeamId = me?.team ?? "A";
      onStartMatch({
        mode: "multiplayer",
        roomCode: room.code,
        playerId,
        playerName,
        playerTeam: myTeam,
        isHost: room.hostId === playerId,
        teamAMaxPlayers: room.teamAMaxPlayers,
        teamBMaxPlayers: room.teamBMaxPlayers,
        teamABots: room.teamABots,
        teamBBots: room.teamBBots,
        botDifficulty: "veteran",
        timeOfDay: room.timeOfDay,
        scoreLimit: room.scoreLimit,
        primaryWeapon,
        secondaryWeapon,
        seed: room.seed,
      });
    },
    [playerId, playerName, primaryWeapon, secondaryWeapon, onStartMatch]
  );

  // Poll Connected Room every 1.1s so connecting players & Start Match trigger sync live!
  useEffect(() => {
    if (!activeRoom) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${activeRoom.code}`);
        const data = await res.json();
        if (data?.ok && data.room) {
          const updated: RoomLobbyState = data.room;
          setActiveRoom(updated);
          if (updated.status === "playing") {
            launchFromRoomState(updated);
          }
        }
      } catch {
        // ignore
      }
    }, 1100);
    return () => clearInterval(interval);
  }, [activeRoom, launchFromRoomState]);

  const handleDeployOffline = () => {
    onStartMatch({
      mode: "offline",
      roomCode: "OFFLINE",
      playerId,
      playerName,
      playerTeam: offTeam,
      isHost: true,
      teamAMaxPlayers: 1,
      teamBMaxPlayers: 0,
      teamABots: offTeamABots,
      teamBBots: offTeamBBots,
      botDifficulty: offDifficulty,
      timeOfDay: offTimeOfDay,
      scoreLimit: offScoreLimit,
      primaryWeapon,
      secondaryWeapon,
      seed: 104729,
    });
  };

  const handleCreateRoom = async () => {
    setMpBusy(true);
    setMpError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: playerId,
          hostName: playerName,
          roomName: newRoomName,
          teamAMaxPlayers: mpTeamAMax,
          teamBMaxPlayers: mpTeamBMax,
          teamABots: mpTeamABots,
          teamBBots: mpTeamBBots,
          timeOfDay: mpTimeOfDay,
          scoreLimit: mpScoreLimit,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setMpError(data?.error || "Could not create room");
      } else {
        setActiveRoom(data.room);
      }
    } catch {
      setMpError("Network error while creating room");
    }
    setMpBusy(false);
  };

  const handleJoinRoomCode = async (codeToJoin: string) => {
    const clean = codeToJoin.trim().toUpperCase();
    if (!clean) return;
    setMpBusy(true);
    setMpError(null);
    try {
      const res = await fetch(`/api/rooms/${clean}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setMpError(data?.error || "Unable to connect to room");
      } else {
        setActiveRoom(data.room);
      }
    } catch {
      setMpError("Failed to connect to room");
    }
    setMpBusy(false);
  };

  const handleRoomPatch = async (payload: Record<string, unknown>) => {
    if (!activeRoom) return;
    setMpError(null);
    try {
      const res = await fetch(`/api/rooms/${activeRoom.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setMpError(data?.error || "Action rejected");
      } else if (data.room) {
        setActiveRoom(data.room);
        if (data.room.status === "playing") {
          launchFromRoomState(data.room);
        }
      }
    } catch {
      setMpError("Room update failed");
    }
  };

  const copyRoomCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/82 backdrop-blur-md text-slate-100 select-none overflow-hidden">
      {/* Top Navigation Tabs Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-slate-950/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToLaunch}
            className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-amber-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Launch Tab
          </button>

          <div className="hidden sm:block pl-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              OPERATOR: {playerName}
            </div>
            <div className="text-xs font-black text-white">
              TACTICAL DEPLOYMENT HUB
            </div>
          </div>
        </div>

        {/* Mode & Customization Tabs */}
        <nav className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setTab("offline")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === "offline"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            Offline Mode
          </button>

          <button
            onClick={() => setTab("multiplayer")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === "multiplayer"
                ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            Multiplayer Rooms
          </button>

          <button
            onClick={onOpenLayoutEditor}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-slate-900 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-amber-300 hover:bg-amber-500/15"
          >
            <Sliders className="h-4 w-4" />
            Custom HUD Layout
          </button>

          <button
            onClick={() => setTab("records")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase transition ${
              tab === "records"
                ? "bg-slate-200 text-slate-950"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            Records
          </button>
        </nav>

        <button
          onClick={onToggleFullscreen}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-slate-900 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline">
            {isFullscreen ? "Window" : "Full Screen"}
          </span>
        </button>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-5">
        {/* =========================================================
            TAB 1: OFFLINE TACTICAL MODE
        ========================================================= */}
        {tab === "offline" && (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Team & Bot Counts Configuration */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    INSTANT LOCAL SIMULATION
                  </div>
                  <h2 className="text-lg font-black uppercase text-white">
                    OFFLINE SQUAD BATTLEGROUNDS
                  </h2>
                </div>
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  ZERO LATENCY • 60 FPS
                </span>
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  CHOOSE YOUR FACTION
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOffTeam("A")}
                    className={`rounded-xl border p-3 text-left transition ${
                      offTeam === "A"
                        ? "border-cyan-400 bg-cyan-500/15"
                        : "border-slate-800 bg-slate-950/60"
                    }`}
                  >
                    <div className="text-xs font-black uppercase text-cyan-400">
                      TEAM ALPHA
                    </div>
                    <div className="text-[11px] text-slate-400">
                      North-West Forward Command
                    </div>
                  </button>
                  <button
                    onClick={() => setOffTeam("B")}
                    className={`rounded-xl border p-3 text-left transition ${
                      offTeam === "B"
                        ? "border-rose-400 bg-rose-500/15"
                        : "border-slate-800 bg-slate-950/60"
                    }`}
                  >
                    <div className="text-xs font-black uppercase text-rose-400">
                      TEAM BRAVO
                    </div>
                    <div className="text-[11px] text-slate-400">
                      South-East Citadel Stronghold
                    </div>
                  </button>
                </div>
              </div>

              {/* Two-Team Bot Count Sliders */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-cyan-400">TEAM ALPHA AI BOTS</span>
                    <span className="font-mono text-base text-white">
                      {offTeamABots}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={offTeamABots}
                    onChange={(e) => setOffTeamABots(Number(e.target.value))}
                    className="mt-2 w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="mt-1 text-[10px] text-slate-400">
                    Total Alpha Squad: {offTeamABots + (offTeam === "A" ? 1 : 0)}{" "}
                    Operators
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-slate-950/70 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-rose-400">TEAM BRAVO AI BOTS</span>
                    <span className="font-mono text-base text-white">
                      {offTeamBBots}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={offTeamBBots}
                    onChange={(e) => setOffTeamBBots(Number(e.target.value))}
                    className="mt-2 w-full accent-rose-400 cursor-pointer"
                  />
                  <div className="mt-1 text-[10px] text-slate-400">
                    Total Bravo Squad: {offTeamBBots + (offTeam === "B" ? 1 : 0)}{" "}
                    Operators
                  </div>
                </div>
              </div>

              {/* AI Skill, Time of Day & Score Limit */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    BOT AI SKILL
                  </label>
                  <select
                    value={offDifficulty}
                    onChange={(e) =>
                      setOffDifficulty(e.target.value as BotDifficulty)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value="recruit">Recruit</option>
                    <option value="veteran">Veteran</option>
                    <option value="specops">Spec-Ops Elite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    MAP WEATHER / SUN
                  </label>
                  <select
                    value={offTimeOfDay}
                    onChange={(e) => setOffTimeOfDay(e.target.value as TimeOfDay)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value="golden">Golden Hour Sunset</option>
                    <option value="noon">Erangel High Noon</option>
                    <option value="dawn">Misty Tactical Dawn</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    VICTORY KILL TARGET
                  </label>
                  <select
                    value={offScoreLimit}
                    onChange={(e) => setOffScoreLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value={15}>15 Eliminations</option>
                    <option value={25}>25 Eliminations</option>
                    <option value={40}>40 Eliminations</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Starting Dual-Weapon Loadout & Launch CTA */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-amber-500/40 bg-slate-900/90 p-5 shadow-xl">
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    STARTING ARMORY (2 MAIN WEAPONS)
                  </div>
                  <h3 className="text-base font-black uppercase text-white">
                    SELECT DEPLOYMENT LOADOUT
                  </h3>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    MAIN WEAPON SLOT 1 (PRIMARY)
                  </label>
                  <select
                    value={primaryWeapon}
                    onChange={(e) => setPrimaryWeapon(e.target.value as WeaponId)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-bold text-amber-300"
                  >
                    {WEAPON_CHOICES.map((w) => (
                      <option key={w} value={w}>
                        {WEAPONS[w].name} ({WEAPONS[w].ammoType} • DMG{" "}
                        {WEAPONS[w].damage})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    MAIN WEAPON SLOT 2 (SECONDARY)
                  </label>
                  <select
                    value={secondaryWeapon}
                    onChange={(e) =>
                      setSecondaryWeapon(e.target.value as WeaponId)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-bold text-cyan-300"
                  >
                    {WEAPON_CHOICES.map((w) => (
                      <option key={w} value={w}>
                        {WEAPONS[w].name} ({WEAPONS[w].ammoType} • DMG{" "}
                        {WEAPONS[w].damage})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                  Map Features: <strong className="text-white">9 Enterable 3-Stage Buildings</strong>,
                  95+ Ground/2nd-Floor/Rooftop Loot Spawns, 3 Mythic Red-Smoke
                  Airdrops, and <strong className="text-emerald-300">Unlimited Backpack Storage</strong>.
                </div>
              </div>

              <button
                onClick={handleDeployOffline}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                START OFFLINE MATCH
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: MULTIPLAYER ROOM CREATION & CONNECTED ROOM LOBBY
        ========================================================= */}
        {tab === "multiplayer" && !activeRoom && (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Create Room Panel */}
            <div className="lg:col-span-6 rounded-2xl border border-cyan-500/35 bg-slate-900/90 p-5 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                    HOST AUTHORITATIVE MATCH
                  </div>
                  <h2 className="text-lg font-black uppercase text-white">
                    CREATE MULTIPLAYER ROOM
                  </h2>
                </div>
                <Plus className="h-5 w-5 text-cyan-400" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  ROOM NAME
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>

              {/* Host Team Alpha & Team Bravo Player/Bot Sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-cyan-500/30 bg-slate-950/75 p-3 space-y-2">
                  <div className="text-[11px] font-black uppercase text-cyan-400">
                    TEAM ALPHA CONFIG
                  </div>
                  <label className="block text-[10px] text-slate-300">
                    Max Players: <strong>{mpTeamAMax}</strong>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={mpTeamAMax}
                      onChange={(e) => setMpTeamAMax(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </label>
                  <label className="block text-[10px] text-slate-300">
                    AI Bots: <strong>{mpTeamABots}</strong>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={mpTeamABots}
                      onChange={(e) => setMpTeamABots(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-slate-950/75 p-3 space-y-2">
                  <div className="text-[11px] font-black uppercase text-rose-400">
                    TEAM BRAVO CONFIG
                  </div>
                  <label className="block text-[10px] text-slate-300">
                    Max Players: <strong>{mpTeamBMax}</strong>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={mpTeamBMax}
                      onChange={(e) => setMpTeamBMax(Number(e.target.value))}
                      className="w-full accent-rose-400"
                    />
                  </label>
                  <label className="block text-[10px] text-slate-300">
                    AI Bots: <strong>{mpTeamBBots}</strong>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={mpTeamBBots}
                      onChange={(e) => setMpTeamBBots(Number(e.target.value))}
                      className="w-full accent-rose-400"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    MAP LIGHTING
                  </label>
                  <select
                    value={mpTimeOfDay}
                    onChange={(e) => setMpTimeOfDay(e.target.value as TimeOfDay)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value="golden">Golden Hour</option>
                    <option value="noon">High Noon</option>
                    <option value="dawn">Misty Dawn</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    SCORE LIMIT
                  </label>
                  <select
                    value={mpScoreLimit}
                    onChange={(e) => setMpScoreLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value={20}>20 Kills</option>
                    <option value={30}>30 Kills</option>
                    <option value={50}>50 Kills</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={mpBusy}
                className="w-full rounded-xl bg-cyan-400 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300 cursor-pointer"
              >
                {mpBusy ? "INITIALIZING ROOM..." : "CREATE ROOM & OPEN LOBBY"}
              </button>
            </div>

            {/* Join Room via Code or Live Server Browser */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      LOCALHOST &amp; ONLINE MULTIPLAYER
                    </div>
                    <h2 className="text-lg font-black uppercase text-white">
                      CONNECT TO EXISTING ROOM
                    </h2>
                  </div>
                  <button
                    onClick={fetchActiveRooms}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:text-white"
                    title="Refresh Rooms"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                {/* Join by 6-Character Room Code */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={joinCodeInput}
                    onChange={(e) =>
                      setJoinCodeInput(e.target.value.toUpperCase())
                    }
                    placeholder="ENTER 6-CHAR ROOM CODE..."
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-xs font-bold uppercase text-white outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => handleJoinRoomCode(joinCodeInput)}
                    disabled={mpBusy || !joinCodeInput.trim()}
                    className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    JOIN CODE
                  </button>
                </div>

                {mpError && (
                  <div className="mt-2.5 rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                    {mpError}
                  </div>
                )}

                {/* Live Rooms Directory */}
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ACTIVE MULTIPLAYER ROOMS ({roomsList.length})
                  </div>

                  {roomsList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                      No open rooms yet. Create a room on the left, then open a
                      second browser tab (or share your Render URL) to connect
                      multiple live players!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {roomsList.map((r) => (
                        <div
                          key={r.code}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-amber-400">
                                [{r.code}]
                              </span>
                              <span className="text-xs font-bold text-white">
                                {r.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                  r.status === "playing"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-cyan-500/20 text-cyan-300"
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              Host: {r.hostName} • Players: {r.players.length}/
                              {r.teamAMaxPlayers + r.teamBMaxPlayers} • Bots:{" "}
                              {r.teamABots + r.teamBBots}
                            </div>
                          </div>

                          <button
                            onClick={() => handleJoinRoomCode(r.code)}
                            className="rounded-lg bg-cyan-500/20 border border-cyan-400/50 px-3 py-1.5 text-[11px] font-bold uppercase text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 transition"
                          >
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            CONNECTED ROOM WAITING TAB (PLAYERS CONNECTING + START MATCH)
        ========================================================= */}
        {tab === "multiplayer" && activeRoom && (
          <div className="mx-auto max-w-6xl space-y-4">
            {/* Room Top Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/45 bg-slate-900/95 px-5 py-3.5 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    CONNECTED TO MULTIPLAYER ROOM LOBBY
                  </span>
                </div>
                <h2 className="mt-0.5 text-xl font-black uppercase text-white">
                  {activeRoom.name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/15 px-3.5 py-2 font-mono text-sm font-black text-amber-300 hover:bg-amber-500/25"
                >
                  <span>CODE: {activeRoom.code}</span>
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>

                <button
                  onClick={() => setActiveRoom(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Leave Room
                </button>
              </div>
            </div>

            {mpError && (
              <div className="rounded-xl border border-rose-500/50 bg-rose-950/70 px-4 py-2 text-xs text-rose-200">
                {mpError}
              </div>
            )}

            {/* Two-Team Connected Rosters + Host Controls */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* TEAM ALPHA ROSTER */}
              <div className="lg:col-span-4 rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <div className="text-sm font-black uppercase text-cyan-400">
                        TEAM ALPHA
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Players:{" "}
                        {
                          activeRoom.players.filter((p) => p.team === "A")
                            .length
                        }
                        /{activeRoom.teamAMaxPlayers} • AI Bots:{" "}
                        {activeRoom.teamABots}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleRoomPatch({
                          action: "switch_team",
                          targetTeam: "A",
                        })
                      }
                      className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
                    >
                      Join Alpha
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {activeRoom.players
                      .filter((p) => p.team === "A")
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            {p.isHost ? (
                              <Crown className="h-4 w-4 text-amber-400" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-cyan-400" />
                            )}
                            <span className="text-xs font-bold text-white">
                              {p.name} {p.id === playerId ? "(YOU)" : ""}
                            </span>
                          </div>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {p.isReady ? "READY" : "PREP"}
                          </span>
                        </div>
                      ))}

                    {/* Preview Configured Bots */}
                    {Array.from({ length: activeRoom.teamABots }).map((_, i) => (
                      <div
                        key={`ba_${i}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-1.5 text-slate-400"
                      >
                        <span className="flex items-center gap-2 text-[11px]">
                          <Bot className="h-3.5 w-3.5 text-cyan-500" />
                          Alpha_AI_Unit_{i + 1}
                        </span>
                        <span className="text-[10px] font-mono">BOT</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TEAM BRAVO ROSTER */}
              <div className="lg:col-span-4 rounded-2xl border border-rose-500/40 bg-slate-900/90 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <div className="text-sm font-black uppercase text-rose-400">
                        TEAM BRAVO
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Players:{" "}
                        {
                          activeRoom.players.filter((p) => p.team === "B")
                            .length
                        }
                        /{activeRoom.teamBMaxPlayers} • AI Bots:{" "}
                        {activeRoom.teamBBots}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleRoomPatch({
                          action: "switch_team",
                          targetTeam: "B",
                        })
                      }
                      className="rounded-lg border border-rose-400/50 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-400 hover:text-slate-950"
                    >
                      Join Bravo
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {activeRoom.players
                      .filter((p) => p.team === "B")
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-slate-950/80 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            {p.isHost ? (
                              <Crown className="h-4 w-4 text-amber-400" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-rose-400" />
                            )}
                            <span className="text-xs font-bold text-white">
                              {p.name} {p.id === playerId ? "(YOU)" : ""}
                            </span>
                          </div>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {p.isReady ? "READY" : "PREP"}
                          </span>
                        </div>
                      ))}

                    {Array.from({ length: activeRoom.teamBBots }).map((_, i) => (
                      <div
                        key={`bb_${i}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-1.5 text-slate-400"
                      >
                        <span className="flex items-center gap-2 text-[11px]">
                          <Bot className="h-3.5 w-3.5 text-rose-500" />
                          Bravo_AI_Unit_{i + 1}
                        </span>
                        <span className="text-[10px] font-mono">BOT</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* HOST SETTINGS, DUAL LOADOUT & START MATCH CTA */}
              <div className="lg:col-span-4 rounded-2xl border border-amber-500/45 bg-slate-900/95 p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                    {activeRoom.hostId === playerId
                      ? "HOST TEAM & BOT CONTROLS"
                      : "ROOM MATCH PARAMETERS"}
                  </div>

                  {activeRoom.hostId === playerId ? (
                    <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                      <label className="rounded-lg bg-slate-950 p-2">
                        <span className="text-cyan-400 block">
                          Alpha Max Players: {activeRoom.teamAMaxPlayers}
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={activeRoom.teamAMaxPlayers}
                          onChange={(e) =>
                            handleRoomPatch({
                              action: "config",
                              teamAMaxPlayers: Number(e.target.value),
                            })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </label>
                      <label className="rounded-lg bg-slate-950 p-2">
                        <span className="text-cyan-300 block">
                          Alpha Bots: {activeRoom.teamABots}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={activeRoom.teamABots}
                          onChange={(e) =>
                            handleRoomPatch({
                              action: "config",
                              teamABots: Number(e.target.value),
                            })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </label>
                      <label className="rounded-lg bg-slate-950 p-2">
                        <span className="text-rose-400 block">
                          Bravo Max Players: {activeRoom.teamBMaxPlayers}
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={activeRoom.teamBMaxPlayers}
                          onChange={(e) =>
                            handleRoomPatch({
                              action: "config",
                              teamBMaxPlayers: Number(e.target.value),
                            })
                          }
                          className="w-full accent-rose-400"
                        />
                      </label>
                      <label className="rounded-lg bg-slate-950 p-2">
                        <span className="text-rose-300 block">
                          Bravo Bots: {activeRoom.teamBBots}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={activeRoom.teamBBots}
                          onChange={(e) =>
                            handleRoomPatch({
                              action: "config",
                              teamBBots: Number(e.target.value),
                            })
                          }
                          className="w-full accent-rose-400"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 space-y-1">
                      <div>Host: {activeRoom.hostName}</div>
                      <div>
                        Kill Target: {activeRoom.scoreLimit} • Lighting:{" "}
                        {activeRoom.timeOfDay.toUpperCase()}
                      </div>
                      <div className="text-amber-300">
                        Waiting for host to press START MATCH...
                      </div>
                    </div>
                  )}

                  {/* Personal 2-Weapon Loadout inside Room */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        SLOT 1 WEAPON
                      </label>
                      <select
                        value={primaryWeapon}
                        onChange={(e) =>
                          setPrimaryWeapon(e.target.value as WeaponId)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-amber-300"
                      >
                        {WEAPON_CHOICES.map((w) => (
                          <option key={w} value={w}>
                            {WEAPONS[w].name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        SLOT 2 WEAPON
                      </label>
                      <select
                        value={secondaryWeapon}
                        onChange={(e) =>
                          setSecondaryWeapon(e.target.value as WeaponId)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-cyan-300"
                      >
                        {WEAPON_CHOICES.map((w) => (
                          <option key={w} value={w}>
                            {WEAPONS[w].name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* START MATCH BUTTON */}
                {activeRoom.status === "playing" ? (
                  <button
                    onClick={() => launchFromRoomState(activeRoom)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl hover:bg-emerald-300"
                  >
                    <Play className="h-4 w-4 fill-slate-950" />
                    DEPLOY INTO LIVE MATCH
                  </button>
                ) : activeRoom.hostId === playerId ? (
                  <button
                    onClick={() => handleRoomPatch({ action: "start_match" })}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-slate-950" />
                    START MATCH ({activeRoom.players.length} PLAYERS +{" "}
                    {activeRoom.teamABots + activeRoom.teamBBots} BOTS)
                  </button>
                ) : (
                  <button
                    onClick={() => handleRoomPatch({ action: "toggle_ready" })}
                    className="w-full rounded-xl border border-emerald-400/60 bg-emerald-500/20 py-3.5 text-xs font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/30"
                  >
                    TOGGLE READY STATUS
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: POSTGRESQL COMBAT RECORDS
        ========================================================= */}
        {tab === "records" && (
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  POSTGRESQL PERSISTENT TELEMETRY
                </div>
                <h2 className="text-lg font-black uppercase text-white">
                  RECENT BATTLEGROUNDS MATCHES
                </h2>
              </div>
              <button
                onClick={fetchMatchRecords}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Refresh
              </button>
            </div>

            {records.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Complete an Offline or Multiplayer match to log persistent team
                scores and MVP operators here!
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/75 px-4 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold uppercase text-amber-300">
                        {rec.mode}
                      </span>
                      <span className="font-black text-white">
                        {rec.winnerTeam} VICTORY
                      </span>
                    </div>
                    <div className="font-mono text-slate-300">
                      ALPHA <strong className="text-cyan-400">{rec.teamAScore}</strong>{" "}
                      - <strong className="text-rose-400">{rec.teamBScore}</strong>{" "}
                      BRAVO
                    </div>
                    <div className="text-slate-400">
                      MVP: <strong className="text-amber-300">{rec.mvpName}</strong> (
                      {rec.mvpKills} Kills)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
