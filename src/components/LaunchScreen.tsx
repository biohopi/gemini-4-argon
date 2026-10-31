"use client";

import { GraphicsQuality } from "@/game/types";
import {
  Crosshair,
  Gamepad2,
  Maximize2,
  Minimize2,
  Shield,
  Sliders,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import React from "react";

interface LaunchScreenProps {
  playerName: string;
  onChangeName: (name: string) => void;
  quality: GraphicsQuality;
  onChangeQuality: (q: GraphicsQuality) => void;
  muted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onEnterLobby: (initialTab: "offline" | "multiplayer" | "layout") => void;
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({
  playerName,
  onChangeName,
  quality,
  onChangeQuality,
  muted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onEnterLobby,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/75 p-4 sm:p-6 text-slate-100 select-none overflow-y-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/20 text-amber-400 shadow-lg">
            <Crosshair className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
              KRAFTON-INSPIRED WEBGL ENGINE
            </div>
            <div className="text-base font-black tracking-wide text-white">
              ERANGEL OPS: BATTLEGROUNDS 3D
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Graphics Preset Switch */}
          <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-950/80 p-1 backdrop-blur-md">
            {(
              [
                { id: "smooth", label: "SMOOTH" },
                { id: "hd", label: "HD" },
                { id: "ultra", label: "HDR ULTRA" },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                onClick={() => onChangeQuality(g.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  quality === g.id
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleMute}
            className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-2.5 text-slate-200 backdrop-blur-md hover:border-amber-400"
            title="Toggle Audio"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-slate-950/85 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 backdrop-blur-md hover:bg-cyan-500/20"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span>{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
          </button>
        </div>
      </div>

      {/* Center Hero Launch Card */}
      <div className="mx-auto my-auto w-full max-w-3xl rounded-2xl border border-amber-500/40 bg-slate-950/80 p-5 sm:p-7 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-emerald-300">
            ● LIVE 3D ENGINE READY
          </span>
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-amber-300">
            LANDSCAPE TACTICAL EDITION
          </span>
          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-0.5 text-cyan-300">
            3-STAGE BUILDINGS & ∞ LOOT
          </span>
        </div>

        <h1 className="mt-3 text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          DEPLOY INTO{" "}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
            ERANGEL 3D
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed">
          Enter multi-story 3-stage tactical compounds, loot mythic weapons &amp;
          8x sniper optics into an unlimited backpack, customize your landscape
          HUD button layout, and battle across Offline Squad Ops or Real-Time
          Multiplayer Rooms.
        </p>

        {/* Operator Callsign + Primary Launch CTA */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              OPERATOR CALLSIGN
            </label>
            <input
              type="text"
              maxLength={20}
              value={playerName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Enter Callsign..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => onEnterLobby("multiplayer")}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-3.5 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 transition cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-slate-950" />
              ENTER COMMAND LOBBY
            </button>
          </div>
        </div>

        {/* Direct Mode Quick-Jump Tabs */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            onClick={() => onEnterLobby("offline")}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-left hover:border-amber-400/60 hover:bg-slate-800/80 transition"
          >
            <Gamepad2 className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-black uppercase text-white">
                Offline Mode Tab
              </div>
              <div className="text-[11px] text-slate-400">
                Custom Team A &amp; B Bots
              </div>
            </div>
          </button>

          <button
            onClick={() => onEnterLobby("multiplayer")}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-left hover:border-cyan-400/60 hover:bg-slate-800/80 transition"
          >
            <Users className="h-5 w-5 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-black uppercase text-white">
                Multiplayer Rooms
              </div>
              <div className="text-[11px] text-slate-400">
                Create / Join Room Lobby
              </div>
            </div>
          </button>

          <button
            onClick={() => onEnterLobby("layout")}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-left hover:border-emerald-400/60 hover:bg-slate-800/80 transition"
          >
            <Sliders className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-black uppercase text-white">
                Custom HUD Layout
              </div>
              <div className="text-[11px] text-slate-400">
                Drag, Scale &amp; Claw Presets
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Controls Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300/90">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span>
            Desktop: <strong>WASD</strong> Move • <strong>C</strong> Crouch •{" "}
            <strong>Z/X</strong> Prone • <strong>Right-Click/V</strong> Scope •{" "}
            <strong>1/2/Q</strong> Switch Gun • <strong>H</strong> Heal •{" "}
            <strong>F</strong> Loot
          </span>
        </div>
        <span className="font-mono text-amber-300">
          TOUCH &amp; DESKTOP DUAL-INPUT READY
        </span>
      </div>
    </div>
  );
};
