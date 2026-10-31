"use client";

import {
  BackpackItem,
  MedId,
  ScopeId,
  WeaponSlotState,
} from "@/game/types";
import { SCOPES, WEAPONS } from "@/game/weapons";
import { Backpack, Crosshair, HeartPulse, Infinity as InfinityIcon, Shield, X } from "lucide-react";
import React from "react";

interface BackpackDrawerProps {
  open: boolean;
  onClose: () => void;
  activeSlot: 0 | 1;
  slots: [WeaponSlotState, WeaponSlotState];
  items: BackpackItem[];
  helmetLevel: number;
  vestLevel: number;
  onEquipWeapon: (uid: string, slot: 0 | 1) => void;
  onEquipScope: (scopeId: ScopeId) => void;
  onUseMed: (medId: MedId) => void;
}

const RARITY_BADGE: Record<BackpackItem["rarity"], string> = {
  common: "border-slate-600/70 bg-slate-800/80 text-slate-200",
  rare: "border-cyan-500/60 bg-cyan-950/60 text-cyan-200",
  epic: "border-purple-500/60 bg-purple-950/60 text-purple-200",
  mythic: "border-amber-500/80 bg-amber-950/70 text-amber-200",
};

export const BackpackDrawer: React.FC<BackpackDrawerProps> = ({
  open,
  onClose,
  activeSlot,
  slots,
  items,
  helmetLevel,
  vestLevel,
  onEquipWeapon,
  onEquipScope,
  onUseMed,
}) => {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-amber-500/45 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Backpack className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  TACTICAL BACKPACK
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <InfinityIcon className="h-3.5 w-3.5" />
                  UNLIMITED STORAGE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {items.length} Stacks Stored • Zero Weight Limit • Instant Loadout Swap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Helmet Lv.{helmetLevel}</span>
              <span className="text-slate-600">|</span>
              <span>Vest Lv.{vestLevel}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-12">
          {/* Equipped Dual Main Weapons */}
          <div className="md:col-span-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              EQUIPPED MAIN WEAPONS (2 SLOTS)
            </div>
            {([0, 1] as const).map((slotIdx) => {
              const s = slots[slotIdx];
              const spec = WEAPONS[s.weaponId];
              const sc = SCOPES[s.scope];
              const isCurrent = activeSlot === slotIdx;

              return (
                <div
                  key={slotIdx}
                  className={`rounded-xl border p-3.5 transition ${
                    isCurrent
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      MAIN WEAPON {slotIdx + 1} {isCurrent ? "• ACTIVE" : ""}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                      {spec.ammoType}
                    </span>
                  </div>
                  <div className="mt-1 text-base font-black text-white">
                    {spec.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Mag:{" "}
                      <strong className="text-slate-200">
                        {s.ammoInMag}/{spec.magSize}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Crosshair className="h-3.5 w-3.5" />
                      {sc.name}
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400">
              Tip: Any weapon, optic, ammo box, or medical kit you loot is stored
              here with <strong className="text-emerald-300">unlimited capacity</strong>.
            </div>
          </div>

          {/* Unlimited Backpack Contents */}
          <div className="md:col-span-7 flex flex-col">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              STORED GEAR, WEAPONS, OPTICS, MEDS & AMMO ({items.length})
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.uid}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 ${RARITY_BADGE[item.rarity]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {item.name}
                      </div>
                      <div className="text-[10px] opacity-80">{item.subtitle}</div>
                    </div>
                    <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-xs font-bold">
                      x{item.quantity}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  {item.kind === "weapon" && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => onEquipWeapon(item.uid, 0)}
                        className="flex-1 rounded bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase text-slate-950 hover:bg-amber-400"
                      >
                        Equip Slot 1
                      </button>
                      <button
                        onClick={() => onEquipWeapon(item.uid, 1)}
                        className="flex-1 rounded bg-slate-700 px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-slate-600"
                      >
                        Equip Slot 2
                      </button>
                    </div>
                  )}

                  {item.kind === "scope" && (
                    <button
                      onClick={() => onEquipScope(item.itemId as ScopeId)}
                      className="mt-2 flex items-center justify-center gap-1 rounded bg-cyan-500/25 border border-cyan-400/50 px-2 py-1 text-[10px] font-bold uppercase text-cyan-200 hover:bg-cyan-500/40"
                    >
                      <Crosshair className="h-3 w-3" />
                      Mount on Active Gun
                    </button>
                  )}

                  {item.kind === "med" && (
                    <button
                      onClick={() => {
                        onUseMed(item.itemId as MedId);
                        onClose();
                      }}
                      className="mt-2 flex items-center justify-center gap-1 rounded bg-emerald-500/25 border border-emerald-400/50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/40"
                    >
                      <HeartPulse className="h-3 w-3" />
                      Use Medical Item
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
