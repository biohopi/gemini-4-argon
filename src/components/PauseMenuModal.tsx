"use client";

import { GraphicsQuality } from "@/game/types";
import {
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";
import React from "react";

interface PauseMenuModalProps {
  open: boolean;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  quality: GraphicsQuality;
  onChangeQuality: (q: GraphicsQuality) => void;
  muted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenLayoutEditor: () => void;
  onResume: () => void;
  onQuitToLobby: () => void;
}

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  open,
  sensitivity,
  onChangeSensitivity,
  quality,
  onChangeQuality,
  muted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onOpenLayoutEditor,
  onResume,
  onQuitToLobby,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/45 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            TACTICAL SETTINGS
          </div>
          <h2 className="text-xl font-black uppercase text-white">
            COMBAT PAUSED
          </h2>
        </div>

        {/* Look Sensitivity */}
        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-slate-300">Camera &amp; Scope Sensitivity</span>
            <span className="text-amber-300 font-mono">
              {Math.round(sensitivity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.35}
            max={2.4}
            step={0.05}
            value={sensitivity}
            onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>

        {/* Graphics Quality */}
        <div>
          <div className="text-xs font-bold text-slate-300 mb-1.5">
            Graphics &amp; Performance Preset
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["smooth", "hd", "ultra"] as const).map((q) => (
              <button
                key={q}
                onClick={() => onChangeQuality(q)}
                className={`rounded-xl py-2 text-xs font-black uppercase ${
                  quality === q
                    ? "bg-amber-500 text-slate-950"
                    : "border border-slate-700 bg-slate-950 text-slate-300"
                }`}
              >
                {q === "ultra" ? "HDR ULTRA" : q}
              </button>
            ))}
          </div>
        </div>

        {/* Audio & Fullscreen */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onToggleMute}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
            <span>{muted ? "Audio Muted" : "Audio Active"}</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-slate-950 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span>{isFullscreen ? "Exit Full" : "Full Screen"}</span>
          </button>
        </div>

        {/* Open Custom HUD Layout Editor Mid-Match */}
        <button
          onClick={onOpenLayoutEditor}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 py-2.5 text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500/25"
        >
          <Sliders className="h-4 w-4" />
          CUSTOMIZE HUD BUTTONS LAYOUT
        </button>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-3 text-xs font-black uppercase text-slate-950 hover:bg-amber-400"
          >
            <Play className="h-4 w-4 fill-slate-950" />
            RESUME
          </button>
          <button
            onClick={onQuitToLobby}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-950/60 py-3 text-xs font-black uppercase text-rose-200 hover:bg-rose-900/70"
          >
            <LogOut className="h-4 w-4" />
            EXIT MATCH
          </button>
        </div>
      </div>
    </div>
  );
};
