"use client";

import {
  cloneLayout,
  DEFAULT_HUD_LAYOUT,
  HUD_LAYOUT_PRESETS,
} from "@/game/defaultLayout";
import { HUDButtonId, HUDLayoutMap } from "@/game/types";
import { Check, Move, RotateCcw, Save, Sliders, X } from "lucide-react";
import React, { useRef, useState } from "react";

interface LayoutEditorModalProps {
  playerId: string;
  initialLayout: HUDLayoutMap;
  onSave: (newLayout: HUDLayoutMap) => void;
  onClose: () => void;
}

export const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({
  playerId,
  initialLayout,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<HUDLayoutMap>(() => cloneLayout(initialLayout));
  const [selectedId, setSelectedId] = useState<HUDButtonId>("shootRight");
  const [activePreset, setActivePreset] = useState<string>("Custom");
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{
    id: HUDButtonId;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
  } | null>(null);

  const selectedBtn = draft[selectedId];

  const handlePointerDown = (e: React.PointerEvent, id: HUDButtonId) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedId(id);
    draggingRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origXPct: draft[id].xPct,
      origYPct: draft[id].yPct,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - draggingRef.current.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - draggingRef.current.startY) / rect.height) * 100;

    const nextX = Math.max(4, Math.min(96, draggingRef.current.origXPct + dxPct));
    const nextY = Math.max(6, Math.min(94, draggingRef.current.origYPct + dyPct));

    const id = draggingRef.current.id;
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        xPct: Math.round(nextX * 10) / 10,
        yPct: Math.round(nextY * 10) / 10,
      },
    }));
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const updateSelectedProp = (prop: "scale" | "opacity", val: number) => {
    setDraft((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        [prop]: val,
      },
    }));
  };

  const applyPreset = (name: string) => {
    const preset = HUD_LAYOUT_PRESETS[name];
    if (preset) {
      setDraft(cloneLayout(preset));
      setActivePreset(name);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("erangel_hud_layout_v1", JSON.stringify(draft));
      await fetch("/api/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          presetName: activePreset,
          layout: draft,
        }),
      });
    } catch {
      // localStorage already succeeded
    }
    setSaving(false);
    setSavedToast(true);
    onSave(draft);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md select-none overflow-hidden text-slate-100">
      {/* Tactical Engineering Grid */}
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full h-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.09) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        {/* Center Crosshair Guide Lines */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-amber-400/20" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-amber-400/20" />

        {/* Floating Top Inspector Control Panel */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-4xl rounded-xl border border-amber-500/40 bg-slate-900/95 px-4 py-2.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  CUSTOM HUD BUTTONS LAYOUT
                </div>
                <div className="text-[11px] text-slate-400">
                  Drag any button • Selected:{" "}
                  <span className="font-semibold text-white">
                    {selectedBtn.label}
                  </span>{" "}
                  ({Math.round(selectedBtn.xPct)}%, {Math.round(selectedBtn.yPct)}%)
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(HUD_LAYOUT_PRESETS).map((pName) => (
                <button
                  key={pName}
                  onClick={() => applyPreset(pName)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    activePreset === pName
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {pName}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDraft(cloneLayout(DEFAULT_HUD_LAYOUT));
                  setActivePreset("Default");
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
              >
                {savedToast ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Layout
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sliders for Selected Button */}
          <div className="mt-2.5 grid grid-cols-1 gap-3 border-t border-slate-800 pt-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-xs">
              <span className="w-28 text-slate-400">
                Button Size:{" "}
                <strong className="text-amber-300">
                  {Math.round(selectedBtn.scale * 100)}%
                </strong>
              </span>
              <input
                type="range"
                min={0.55}
                max={1.75}
                step={0.05}
                value={selectedBtn.scale}
                onChange={(e) =>
                  updateSelectedProp("scale", parseFloat(e.target.value))
                }
                className="h-1.5 flex-1 accent-amber-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center gap-3 text-xs">
              <span className="w-32 text-slate-400">
                Transparency:{" "}
                <strong className="text-cyan-300">
                  {Math.round(selectedBtn.opacity * 100)}%
                </strong>
              </span>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.05}
                value={selectedBtn.opacity}
                onChange={(e) =>
                  updateSelectedProp("opacity", parseFloat(e.target.value))
                }
                className="h-1.5 flex-1 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Draggable HUD Elements */}
        {(Object.keys(draft) as HUDButtonId[]).map((id) => {
          const btn = draft[id];
          const isSelected = selectedId === id;
          const pxSize = Math.round(btn.baseSize * btn.scale);
          const isSquare = id === "minimap";

          return (
            <div
              key={id}
              onPointerDown={(e) => handlePointerDown(e, id)}
              style={{
                left: `${btn.xPct}%`,
                top: `${btn.yPct}%`,
                width: pxSize,
                height: pxSize,
                opacity: btn.opacity,
                transform: "translate(-50%, -50%)",
                touchAction: "none",
              }}
              className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow ${
                isSquare ? "rounded-xl" : "rounded-full"
              } ${
                isSelected
                  ? "border-2 border-amber-400 bg-amber-500/25 ring-4 ring-amber-400/25 z-20"
                  : "border border-slate-400/60 bg-slate-800/80 hover:border-cyan-400 z-10"
              }`}
            >
              <Move className="h-4 w-4 text-amber-300 mb-0.5 pointer-events-none" />
              <span className="px-1 text-center text-[10px] font-bold uppercase leading-tight text-white pointer-events-none">
                {btn.label}
              </span>
              <span className="text-[9px] text-slate-300 pointer-events-none">
                {Math.round(btn.scale * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
