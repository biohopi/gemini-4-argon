"use client";

import { BattlegroundsEngine } from "@/game/engine/BattlegroundsEngine";
import {
  HUDLayoutMap,
  HUDLiveSnapshot,
  MedId,
  PlayerStance,
  TeamId,
} from "@/game/types";
import { MED_SPECS, SCOPES, WEAPONS } from "@/game/weapons";
import {
  ArrowUpFromLine,
  Backpack,
  Crosshair,
  Flame,
  HeartPulse,
  Maximize2,
  Minimize2,
  PackageOpen,
  Pause,
  RefreshCw,
  Repeat,
  Sliders,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { BackpackDrawer } from "./BackpackDrawer";
import { MinimapCanvas } from "./MinimapCanvas";

interface GameHUDProps {
  engine: BattlegroundsEngine;
  snap: HUDLiveSnapshot;
  layout: HUDLayoutMap;
  playerTeam: TeamId;
  roomCode: string;
  mode: "offline" | "multiplayer";
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenLayoutEditor: () => void;
  onOpenPauseMenu: () => void;
  onReturnToLobby: () => void;
}

const COMPASS_POINTS: { deg: number; label: string }[] = [
  { deg: 0, label: "N" },
  { deg: 45, label: "NE" },
  { deg: 90, label: "E" },
  { deg: 135, label: "SE" },
  { deg: 180, label: "S" },
  { deg: 225, label: "SW" },
  { deg: 270, label: "W" },
  { deg: 315, label: "NW" },
];

const MED_ORDER: MedId[] = ["firstaid", "medkit", "bandage", "energydrink"];

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  snap,
  layout,
  playerTeam,
  roomCode,
  mode,
  isFullscreen,
  onToggleFullscreen,
  onOpenLayoutEditor,
  onOpenPauseMenu,
  onReturnToLobby,
}) => {
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0, active: false });

  const stickTouchRef = useRef<{
    pointerId: number;
    centerX: number;
    centerY: number;
    maxR: number;
  } | null>(null);

  const lookTouchRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const shootTouchRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const activeSlotState = snap.slots[snap.activeSlot];
  const activeWeaponSpec = WEAPONS[activeSlotState.weaponId];
  const activeScopeSpec = SCOPES[activeSlotState.scope];
  const damageFlashActive = Date.now() - snap.damageFlashTs < 260;

  // Virtual Movement Joystick Handlers
  const onStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = rect.width * 0.38;
    stickTouchRef.current = { pointerId: e.pointerId, centerX: cx, centerY: cy, maxR };
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const updateStickFromEvent = (clientX: number, clientY: number) => {
    const st = stickTouchRef.current;
    if (!st) return;
    let dx = clientX - st.centerX;
    let dy = clientY - st.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > st.maxR) {
      dx = (dx / dist) * st.maxR;
      dy = (dy / dist) * st.maxR;
    }
    setStickKnob({ x: dx, y: dy, active: true });
    engine.setMoveStick(dx / st.maxR, dy / st.maxR);
  };

  const onStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickTouchRef.current?.pointerId !== e.pointerId) return;
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const onStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickTouchRef.current?.pointerId !== e.pointerId) return;
    stickTouchRef.current = null;
    setStickKnob({ x: 0, y: 0, active: false });
    engine.setMoveStick(0, 0);
  };

  // Touch-Look Drag Zone (Right Side / Background)
  const onLookZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") {
      engine.requestCanvasPointerLock();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    lookTouchRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const onLookZoneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookTouchRef.current?.pointerId !== e.pointerId) return;
    const dx = e.clientX - lookTouchRef.current.lastX;
    const dy = e.clientY - lookTouchRef.current.lastY;
    lookTouchRef.current.lastX = e.clientX;
    lookTouchRef.current.lastY = e.clientY;
    engine.addLookDelta(dx * 1.65, dy * 1.65);
  };

  const onLookZoneUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookTouchRef.current?.pointerId === e.pointerId) {
      lookTouchRef.current = null;
    }
  };

  // Shoot Button with PUBG-style Drag-Aim Recoil Control!
  const onShootDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    shootTouchRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    engine.setVirtualShoot(true);
  };

  const onShootMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shootTouchRef.current?.pointerId !== e.pointerId) return;
    const dx = e.clientX - shootTouchRef.current.lastX;
    const dy = e.clientY - shootTouchRef.current.lastY;
    shootTouchRef.current.lastX = e.clientX;
    shootTouchRef.current.lastY = e.clientY;
    engine.addLookDelta(dx * 1.4, dy * 1.4);
  };

  const onShootUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shootTouchRef.current?.pointerId === e.pointerId) {
      shootTouchRef.current = null;
    }
    engine.setVirtualShoot(false);
  };

  const cycleMedSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currIdx = MED_ORDER.indexOf(snap.selectedMed);
    const next = MED_ORDER[(currIdx + 1) % MED_ORDER.length];
    engine.selectMedType(next);
  };

  const btnStyle = (id: keyof HUDLayoutMap): React.CSSProperties => {
    const cfg = layout[id];
    const px = Math.round(cfg.baseSize * cfg.scale);
    return {
      left: `${cfg.xPct}%`,
      top: `${cfg.yPct}%`,
      width: px,
      height: px,
      opacity: cfg.opacity,
      transform: "translate(-50%, -50%)",
      touchAction: "none",
    };
  };

  return (
    <div className="fixed inset-0 z-20 select-none overflow-hidden pointer-events-none">
      {/* Touch-Look Background Layer */}
      <div
        onPointerDown={onLookZoneDown}
        onPointerMove={onLookZoneMove}
        onPointerUp={onLookZoneUp}
        onPointerCancel={onLookZoneUp}
        style={{ touchAction: "none" }}
        className="pointer-events-auto absolute inset-0 z-0"
      />

      {/* Red Damage Vignette Flash */}
      {damageFlashActive && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity"
          style={{
            boxShadow: "inset 0 0 110px 36px rgba(239, 68, 68, 0.58)",
          }}
        />
      )}

      {/* =========================================================
          OPTICAL SCOPE RETICLE OVERLAY (RED DOT / 2X / 4X / 8X)
      ========================================================= */}
      {snap.isScoped && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {(activeSlotState.scope === "scope4x" ||
            activeSlotState.scope === "scope8x") && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at center, transparent 27%, rgba(2,6,23,0.94) 31%)",
              }}
            />
          )}

          {/* Scope Ring & Stadia Crosshairs */}
          <div className="relative flex h-72 w-72 items-center justify-center rounded-full border-2 border-slate-700/80">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200/50" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200/50" />

            {activeSlotState.scope === "reddot" && (
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e]" />
            )}
            {activeSlotState.scope === "scope2x" && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </div>
            )}
            {activeSlotState.scope === "scope4x" && (
              <div className="flex flex-col items-center">
                <div className="h-0 w-0 border-x-[7px] border-b-[11px] border-x-transparent border-b-rose-500" />
                <div className="mt-2 h-0.5 w-4 bg-rose-400/75" />
                <div className="mt-2 h-0.5 w-2.5 bg-rose-400/60" />
              </div>
            )}
            {activeSlotState.scope === "scope8x" && (
              <div className="relative flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" />
                {[-48, -24, 24, 48].map((offset) => (
                  <React.Fragment key={offset}>
                    <div
                      style={{ transform: `translateX(${offset}px)` }}
                      className="absolute h-2 w-0.5 bg-slate-200/80"
                    />
                    <div
                      style={{ transform: `translateY(${offset}px)` }}
                      className="absolute h-0.5 w-2 bg-slate-200/80"
                    />
                  </React.Fragment>
                ))}
              </div>
            )}

            <span className="absolute bottom-4 rounded bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
              {activeScopeSpec.name} ({activeScopeSpec.zoomLabel})
            </span>
          </div>
        </div>
      )}

      {/* =========================================================
          HIPFIRE CROSSHAIR & HITMARKER
      ========================================================= */}
      {!snap.isScoped && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="h-1 w-1 rounded-full bg-amber-300 shadow" />
            <div className="absolute -top-1.5 h-2.5 w-0.5 bg-white/85 shadow" />
            <div className="absolute -bottom-1.5 h-2.5 w-0.5 bg-white/85 shadow" />
            <div className="absolute -left-1.5 h-0.5 w-2.5 bg-white/85 shadow" />
            <div className="absolute -right-1.5 h-0.5 w-2.5 bg-white/85 shadow" />
          </div>
        </div>
      )}

      {snap.hitMarker.active && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`relative h-7 w-7 rotate-45 ${
              snap.hitMarker.headshot ? "scale-125" : ""
            }`}
          >
            <div
              className={`absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 ${
                snap.hitMarker.headshot ? "bg-rose-500" : "bg-white"
              }`}
            />
            <div
              className={`absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 ${
                snap.hitMarker.headshot ? "bg-rose-500" : "bg-white"
              }`}
            />
            <div
              className={`absolute left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 ${
                snap.hitMarker.headshot ? "bg-rose-500" : "bg-white"
              }`}
            />
            <div
              className={`absolute right-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 ${
                snap.hitMarker.headshot ? "bg-rose-500" : "bg-white"
              }`}
            />
          </div>
        </div>
      )}

      {/* =========================================================
          TOP BAR: TEAM SCORES, COMPASS TAPE & FULLSCREEN/LAYOUT/PAUSE
      ========================================================= */}
      <div className="pointer-events-auto relative z-20 flex items-start justify-between px-3 pt-2.5">
        {/* Left: Team Alpha vs Team Bravo Live Scoreboard */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 backdrop-blur-md shadow-lg">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              ALPHA {playerTeam === "A" ? "(YOU)" : ""}
            </div>
            <div className="font-mono text-lg font-black leading-none text-white">
              {snap.teamAScore}
            </div>
          </div>

          <div className="px-2 text-center">
            <div className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              TARGET {snap.scoreLimit}
            </div>
            <div className="mt-0.5 text-[9px] text-slate-400">
              {mode === "multiplayer" ? `ROOM ${roomCode}` : "OFFLINE OPS"}
            </div>
          </div>

          <div className="text-left">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              BRAVO {playerTeam === "B" ? "(YOU)" : ""}
            </div>
            <div className="font-mono text-lg font-black leading-none text-white">
              {snap.teamBScore}
            </div>
          </div>

          <div className="ml-2 hidden border-l border-slate-800 pl-2.5 text-[11px] sm:block">
            <div className="font-mono font-bold text-emerald-400">
              {snap.fps} FPS
            </div>
            <div className="text-[10px] text-slate-400">
              K/D: <strong className="text-white">{snap.kills}</strong>/{snap.deaths}
            </div>
          </div>
        </div>

        {/* Center: Compass Bearing & 3-Stage Building Floor Telemetry */}
        <div className="hidden md:flex flex-col items-center">
          <div className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-950/75 px-5 py-1 backdrop-blur-md">
            {COMPASS_POINTS.map((cp) => {
              let diff = cp.deg - snap.compassDeg;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              if (Math.abs(diff) > 65) return null;
              return (
                <span
                  key={cp.label}
                  className={`font-mono text-xs font-bold ${
                    cp.label === "N" ? "text-amber-400" : "text-slate-300"
                  }`}
                >
                  {cp.label}
                </span>
              );
            })}
            <span className="rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-950">
              {snap.compassDeg}°
            </span>
          </div>
          <div className="mt-1 rounded-full bg-slate-950/70 px-3 py-0.5 text-[10px] font-bold tracking-wider text-amber-300/95 border border-amber-500/25">
            {snap.currentFloorLabel}
          </div>
        </div>

        {/* Right: Fullscreen, Custom Layout, & Pause Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenLayoutEditor}
            className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2.5 py-2 text-xs font-bold text-amber-300 backdrop-blur-md hover:border-amber-400"
            title="Customize HUD Buttons Layout"
          >
            <Sliders className="h-4 w-4" />
            <span className="hidden lg:inline">Layout</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2.5 py-2 text-xs font-bold text-slate-100 backdrop-blur-md hover:border-cyan-400"
            title="Toggle Fullscreen Landscape"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-cyan-400" />
            ) : (
              <Maximize2 className="h-4 w-4 text-cyan-400" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Window" : "Full Screen"}
            </span>
          </button>

          <button
            onClick={onOpenPauseMenu}
            className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-2 text-slate-200 backdrop-blur-md hover:border-amber-400"
            title="Pause / Settings (Esc)"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* =========================================================
          KILLFEED (TOP LEFT BELOW SCOREBOARD)
      ========================================================= */}
      <div className="pointer-events-none absolute left-3 top-16 z-10 flex flex-col gap-1 max-w-xs">
        {snap.killFeed.slice(-4).map((kf) => (
          <div
            key={kf.id}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-950/75 px-2.5 py-1 text-[11px] backdrop-blur-sm"
          >
            <span
              className={`font-bold ${
                kf.killerTeam === "A" ? "text-cyan-400" : "text-rose-400"
              }`}
            >
              {kf.killerName}
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
              {kf.weaponName} {kf.headshot ? "⌖HS" : ""}
            </span>
            <span
              className={`font-bold ${
                kf.victimTeam === "A" ? "text-cyan-300" : "text-rose-300"
              }`}
            >
              {kf.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* =========================================================
          CUSTOMIZABLE RADAR MINIMAP
      ========================================================= */}
      <div
        style={btnStyle("minimap")}
        className="pointer-events-none absolute z-10"
      >
        <MinimapCanvas
          size={Math.round(layout.minimap.baseSize * layout.minimap.scale)}
          playerPos={snap.playerPos}
          entities={snap.minimapEntities}
        />
      </div>

      {/* =========================================================
          FLOATING PROXIMITY LOOT PICKUP CARD (PUBG MOBILE STYLE)
      ========================================================= */}
      {snap.nearbyLoot.length > 0 && (
        <div className="pointer-events-auto absolute right-[24%] top-[28%] z-20 w-56 rounded-xl border border-amber-400/50 bg-slate-950/88 p-2 backdrop-blur-md shadow-2xl">
          <div className="mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <span className="flex items-center gap-1">
              <PackageOpen className="h-3.5 w-3.5" />
              Nearby Loot ([F] / Tap)
            </span>
            <span className="text-emerald-400">∞ Bag</span>
          </div>
          <div className="space-y-1">
            {snap.nearbyLoot.map((item) => (
              <button
                key={item.id}
                onClick={() => engine.pickupLootById(item.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-left text-xs hover:border-amber-400 hover:bg-slate-800 transition"
              >
                <span className="font-semibold text-white truncate">
                  {item.name}
                </span>
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                  +{item.quantity}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          CENTER ACTION CAST BARS (RELOADING / HEALING / RESPAWNING)
      ========================================================= */}
      {(snap.isReloading || snap.isHealing || snap.hp <= 0) && (
        <div className="pointer-events-none absolute left-1/2 top-[60%] z-20 -translate-x-1/2 -translate-y-1/2">
          {snap.hp <= 0 ? (
            <div className="rounded-xl border border-rose-500/60 bg-slate-950/90 px-5 py-2.5 text-center shadow-xl">
              <div className="text-xs font-black uppercase tracking-wider text-rose-400">
                ELIMINATED IN ACTION
              </div>
              <div className="text-[11px] text-slate-300">
                Redeploying at Team {playerTeam === "A" ? "Alpha" : "Bravo"} Command...
              </div>
            </div>
          ) : (
            <div className="w-52 rounded-xl border border-amber-400/50 bg-slate-950/88 px-3.5 py-2 shadow-xl">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                <span>
                  {snap.isReloading
                    ? `RELOADING ${activeWeaponSpec.name}`
                    : `USING ${MED_SPECS[snap.selectedMed].name.toUpperCase()}`}
                </span>
                <span>
                  {Math.round(
                    (snap.isReloading ? snap.reloadProgress : snap.healProgress) * 100
                  )}
                  %
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  style={{
                    width: `${
                      (snap.isReloading ? snap.reloadProgress : snap.healProgress) *
                      100
                    }%`,
                  }}
                  className="h-full bg-amber-400 transition-all duration-75"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          BOTTOM CENTER: TWO MAIN WEAPON SLOTS + HP & BOOST BARS
      ========================================================= */}
      <div className="pointer-events-auto absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 w-[330px] sm:w-[390px]">
        {/* Dual Main Weapon Switch Cards */}
        <div className="grid grid-cols-2 gap-2 mb-1.5">
          {([0, 1] as const).map((idx) => {
            const st = snap.slots[idx];
            const spec = WEAPONS[st.weaponId];
            const reserve = snap.ammoReserve[spec.ammoType] || 0;
            const isActive = snap.activeSlot === idx;

            return (
              <button
                key={idx}
                onClick={() => engine.selectWeaponSlot(idx)}
                className={`flex items-center justify-between rounded-xl border px-3 py-1.5 text-left backdrop-blur-md transition ${
                  isActive
                    ? "border-amber-400 bg-slate-900/92 shadow-lg shadow-amber-500/15"
                    : "border-slate-700/70 bg-slate-950/75 opacity-80 hover:opacity-100"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-amber-400">
                      [{idx + 1}]
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {spec.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {SCOPES[st.scope].zoomLabel} Optic • {spec.ammoType}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-black text-amber-300 leading-none">
                    {st.ammoInMag}
                  </div>
                  <div className="text-[10px] text-slate-400">/{reserve}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Energy Boost Bar & HP Bar */}
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/85 px-3 py-1.5 backdrop-blur-md">
          {/* Boost Gauge */}
          <div className="mb-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                style={{ width: `${snap.boost}%` }}
                className="h-full bg-amber-400 transition-all"
              />
            </div>
            <span className="font-mono text-[9px] font-bold text-amber-300">
              BOOST {snap.boost}%
            </span>
          </div>

          {/* Health Bar */}
          <div className="flex items-center gap-2.5">
            <div className="h-3 flex-1 overflow-hidden rounded-md bg-slate-800">
              <div
                style={{ width: `${Math.max(0, snap.hp)}%` }}
                className={`h-full transition-all ${
                  snap.hp > 50
                    ? "bg-emerald-400"
                    : snap.hp > 25
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
            </div>
            <span className="font-mono text-xs font-black text-white w-14 text-right">
              {snap.hp} HP
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          CUSTOMIZABLE VIRTUAL CONTROLS (DRAGGED VIA LAYOUT EDITOR)
      ========================================================= */}

      {/* 1. Virtual Movement Joystick */}
      <div
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
        style={btnStyle("joystick")}
        className="pointer-events-auto absolute z-20 flex items-center justify-center rounded-full border-2 border-slate-400/45 bg-slate-900/45 backdrop-blur-xs"
      >
        <div
          style={{
            transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)`,
          }}
          className={`h-12 w-12 rounded-full border-2 transition-colors ${
            stickKnob.active
              ? "border-amber-300 bg-amber-400/70"
              : "border-slate-300/70 bg-slate-200/35"
          }`}
        />
      </div>

      {/* 2. Primary Right Shoot Button */}
      <button
        onPointerDown={onShootDown}
        onPointerMove={onShootMove}
        onPointerUp={onShootUp}
        onPointerCancel={onShootUp}
        style={btnStyle("shootRight")}
        className="pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border-2 border-amber-400 bg-gradient-to-b from-amber-500/80 to-rose-600/85 text-white shadow-lg shadow-rose-600/30 active:scale-95"
      >
        <Flame className="h-7 w-7" />
        <span className="text-[9px] font-black uppercase tracking-wider">FIRE</span>
      </button>

      {/* 3. Left Index / Claw Shoot Button */}
      <button
        onPointerDown={onShootDown}
        onPointerMove={onShootMove}
        onPointerUp={onShootUp}
        onPointerCancel={onShootUp}
        style={btnStyle("shootLeft")}
        className="pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border-2 border-amber-400/80 bg-slate-900/80 text-amber-300 shadow active:scale-95 active:bg-amber-500 active:text-slate-950"
      >
        <Flame className="h-5 w-5" />
        <span className="text-[8px] font-bold uppercase">FIRE</span>
      </button>

      {/* 4. Scope / ADS Button */}
      <button
        onClick={() => engine.toggleScope()}
        style={btnStyle("scope")}
        className={`pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border-2 shadow active:scale-95 ${
          snap.isScoped
            ? "border-amber-300 bg-amber-500 text-slate-950"
            : "border-slate-400/70 bg-slate-900/80 text-white"
        }`}
      >
        <Crosshair className="h-5 w-5" />
        <span className="text-[9px] font-bold uppercase">
          {activeScopeSpec.zoomLabel}
        </span>
      </button>

      {/* 5. Jump Button */}
      <button
        onClick={() => engine.triggerJump()}
        style={btnStyle("jump")}
        className="pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border border-slate-400/70 bg-slate-900/80 text-white shadow active:scale-95"
      >
        <ArrowUpFromLine className="h-4 w-4" />
        <span className="text-[9px] font-bold uppercase">JUMP</span>
      </button>

      {/* 6. Crouch Button */}
      <button
        onClick={() => engine.toggleCrouch()}
        style={btnStyle("crouch")}
        className={`pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border shadow active:scale-95 ${
          snap.stance === PlayerStance.Crouch
            ? "border-amber-300 bg-amber-500 text-slate-950"
            : "border-slate-400/70 bg-slate-900/80 text-white"
        }`}
      >
        <span className="text-[10px] font-black uppercase">CROUCH</span>
      </button>

      {/* 7. Prone Button */}
      <button
        onClick={() => engine.toggleProne()}
        style={btnStyle("prone")}
        className={`pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border shadow active:scale-95 ${
          snap.stance === PlayerStance.Prone
            ? "border-amber-300 bg-amber-500 text-slate-950"
            : "border-slate-400/70 bg-slate-900/80 text-white"
        }`}
      >
        <span className="text-[10px] font-black uppercase">PRONE</span>
      </button>

      {/* 8. Reload Button */}
      <button
        onClick={() => engine.triggerReload()}
        style={btnStyle("reload")}
        className={`pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border shadow active:scale-95 ${
          snap.isReloading
            ? "border-amber-400 bg-amber-500/30 text-amber-200"
            : "border-slate-400/70 bg-slate-900/80 text-white"
        }`}
      >
        <RefreshCw
          className={`h-4 w-4 ${snap.isReloading ? "animate-spin" : ""}`}
        />
        <span className="text-[8px] font-bold uppercase">RELOAD</span>
      </button>

      {/* 9. Switch Weapons Button */}
      <button
        onClick={() => engine.switchWeapon()}
        style={btnStyle("switchWeapon")}
        className="pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border-2 border-cyan-400/80 bg-slate-900/85 text-cyan-300 shadow active:scale-95"
      >
        <Repeat className="h-4 w-4" />
        <span className="text-[8px] font-black uppercase">SWITCH</span>
      </button>

      {/* 10. Quick Heal Button + Med Selector Pill */}
      <div
        style={btnStyle("heal")}
        className="pointer-events-auto absolute z-20"
      >
        <button
          onClick={() => engine.triggerHeal()}
          className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 border-emerald-400/80 bg-slate-900/85 text-emerald-300 shadow active:scale-95"
        >
          <HeartPulse className="h-4 w-4" />
          <span className="text-[8px] font-black uppercase">
            HEAL ({snap.medCounts[snap.selectedMed]})
          </span>
        </button>
        <button
          onClick={cycleMedSelection}
          className="absolute -top-2 -right-2 rounded-full border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300 hover:border-amber-400"
          title="Switch Medical Item"
        >
          {snap.selectedMed.slice(0, 4)}
        </button>
      </div>

      {/* 11. Unlimited Backpack Button */}
      <button
        onClick={() => setBackpackOpen(true)}
        style={btnStyle("backpack")}
        className="pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border border-amber-400/70 bg-slate-900/85 text-amber-300 shadow active:scale-95"
      >
        <Backpack className="h-4 w-4" />
        <span className="text-[8px] font-black uppercase">BAG ∞</span>
      </button>

      {/* 12. Loot Pickup Button */}
      <button
        onClick={() => engine.pickupNearestLoot()}
        style={btnStyle("loot")}
        className={`pointer-events-auto absolute z-20 flex flex-col items-center justify-center rounded-full border shadow active:scale-95 ${
          snap.nearbyLoot.length > 0
            ? "border-amber-300 bg-amber-500 text-slate-950 animate-pulse"
            : "border-slate-500/50 bg-slate-900/60 text-slate-300"
        }`}
      >
        <PackageOpen className="h-4 w-4" />
        <span className="text-[8px] font-black uppercase">
          LOOT {snap.nearbyLoot.length > 0 ? `(${snap.nearbyLoot.length})` : ""}
        </span>
      </button>

      {/* =========================================================
          UNLIMITED STORAGE BACKPACK DRAWER
      ========================================================= */}
      <div className="pointer-events-auto">
        <BackpackDrawer
          open={backpackOpen}
          onClose={() => setBackpackOpen(false)}
          activeSlot={snap.activeSlot}
          slots={snap.slots}
          items={snap.backpackItems}
          helmetLevel={snap.helmetLevel}
          vestLevel={snap.vestLevel}
          onEquipWeapon={(uid, slot) => engine.equipWeaponFromBackpack(uid, slot)}
          onEquipScope={(sc) => engine.equipScopeToActiveWeapon(sc)}
          onUseMed={(m) => engine.triggerHeal(m)}
        />
      </div>

      {/* =========================================================
          MATCH ENDED VICTORY / DEFEAT BANNER
      ========================================================= */}
      {snap.matchEnded && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-400 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              WINNER WINNER CHICKEN DINNER
            </div>
            <h2 className="mt-1 text-3xl font-black uppercase text-white">
              {snap.winnerTeam === playerTeam ? "TACTICAL VICTORY" : "MATCH COMPLETE"}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {snap.winnerTeam === "A" ? "TEAM ALPHA" : "TEAM BRAVO"} DOMINATED ERANGEL
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono">
              <div>
                <div className="text-[10px] text-cyan-400">ALPHA</div>
                <div className="text-xl font-black text-white">
                  {snap.teamAScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-amber-400">YOUR K/D</div>
                <div className="text-xl font-black text-amber-300">
                  {snap.kills}/{snap.deaths}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-rose-400">BRAVO</div>
                <div className="text-xl font-black text-white">
                  {snap.teamBScore}
                </div>
              </div>
            </div>

            <button
              onClick={onReturnToLobby}
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
            >
              RETURN TO COMMAND LOBBY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
