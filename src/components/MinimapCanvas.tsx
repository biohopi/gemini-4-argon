"use client";

import { MinimapEntity } from "@/game/types";
import { COMPOUND_BUILDINGS } from "@/game/worldData";
import React, { useEffect, useRef } from "react";

interface MinimapCanvasProps {
  size: number;
  playerPos: { x: number; y: number; z: number; rotY: number };
  entities: MinimapEntity[];
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  size,
  playerPos,
  entities,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const half = size * 0.5;
    const radarRangeMeters = 105; // 105m radius around player
    const scale = half / radarRangeMeters;

    // Radar background
    ctx.fillStyle = "#0b1320";
    ctx.fillRect(0, 0, size, size);

    // Tactical grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    const gridStep = 35 * scale;
    const offsetX = ((-playerPos.x * scale) % gridStep + gridStep) % gridStep;
    const offsetZ = ((-playerPos.z * scale) % gridStep + gridStep) % gridStep;

    for (let gx = offsetX; gx < size; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, size);
      ctx.stroke();
    }
    for (let gz = offsetZ; gz < size; gz += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gz);
      ctx.lineTo(size, gz);
      ctx.stroke();
    }

    // 3-Stage Building Footprints
    for (const b of COMPOUND_BUILDINGS) {
      const sx = half + (b.x - playerPos.x) * scale;
      const sz = half + (b.z - playerPos.z) * scale;
      const sw = b.width * scale;
      const sd = b.depth * scale;
      if (sx + sw < 0 || sx - sw > size || sz + sd < 0 || sz - sd > size) continue;

      ctx.fillStyle = "rgba(214, 204, 184, 0.35)";
      ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.fillRect(sx - sw * 0.5, sz - sd * 0.5, sw, sd);
      ctx.strokeRect(sx - sw * 0.5, sz - sd * 0.5, sw, sd);
    }

    // Entities (Airdrops, Allies, Firing Enemies)
    for (const ent of entities) {
      if (ent.isLocal) continue;
      const sx = half + (ent.x - playerPos.x) * scale;
      const sz = half + (ent.z - playerPos.z) * scale;
      if (sx < 4 || sx > size - 4 || sz < 4 || sz > size - 4) continue;

      if (ent.team === "airdrop") {
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.fillRect(sx - 3.5, sz - 3.5, 7, 7);
        ctx.strokeRect(sx - 3.5, sz - 3.5, 7, 7);
      } else {
        const isEnemyFiring = ent.firing && ent.team !== entities[0]?.team;
        ctx.beginPath();
        ctx.arc(sx, sz, isEnemyFiring ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = isEnemyFiring
          ? "#f43f5e"
          : ent.team === "A"
          ? "#38bdf8"
          : "#fb923c";
        ctx.fill();
      }
    }

    // Local Player View Cone (-Z is yaw=0 North)
    const lookAngle = -playerPos.rotY - Math.PI * 0.5;
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(lookAngle);

    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
    grad.addColorStop(0, "rgba(250, 204, 21, 0.38)");
    grad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 36, -0.45, 0.45);
    ctx.closePath();
    ctx.fill();

    // Player chevron
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Compass Cardinal Marks
    ctx.fillStyle = "rgba(248, 250, 252, 0.75)";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", half, 10);
    ctx.fillText("S", half, size - 4);
  }, [size, playerPos, entities]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-lg border border-amber-400/50 shadow-lg block"
    />
  );
};
