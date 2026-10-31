import * as THREE from "three";
import { getTerrainHeight, WORLD_HALF_SIZE } from "../worldData";

export interface WallCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface FloorCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  thickness: number;
  label: string;
  hole?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface RampCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  zStart: number;
  zEnd: number;
  yStart: number;
  yEnd: number;
  label: string;
}

export class WorldCollision {
  public walls: WallCollider[] = [];
  public floors: FloorCollider[] = [];
  public ramps: RampCollider[] = [];

  public clear() {
    this.walls = [];
    this.floors = [];
    this.ramps = [];
  }

  public addWallBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
    this.walls.push({
      minX: cx - sx * 0.5,
      maxX: cx + sx * 0.5,
      minY: cy - sy * 0.5,
      maxY: cy + sy * 0.5,
      minZ: cz - sz * 0.5,
      maxZ: cz + sz * 0.5,
    });
  }

  public addFloor(floor: FloorCollider) {
    this.floors.push(floor);
  }

  public addRamp(ramp: RampCollider) {
    this.ramps.push(ramp);
  }

  /**
   * Finds the highest walkable surface (terrain, floor slab, or stair ramp)
   * at (x, z) reachable from currentY + stepUpAllowance.
   */
  public getSupportSurface(
    x: number,
    z: number,
    currentY: number,
    stepAllowance = 0.72
  ): { y: number; label: string } {
    let bestY = getTerrainHeight(x, z);
    let bestLabel = "ERANGEL VALLEY";
    const maxReachable = currentY + stepAllowance;

    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        if (
          f.hole &&
          x > f.hole.minX &&
          x < f.hole.maxX &&
          z > f.hole.minZ &&
          z < f.hole.maxZ
        ) {
          continue;
        }
        if (f.y <= maxReachable && f.y >= bestY - 0.05) {
          bestY = f.y;
          bestLabel = f.label;
        }
      }
    }

    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const t = THREE.MathUtils.clamp(
          (z - r.zStart) / (r.zEnd - r.zStart),
          0,
          1
        );
        const ry = r.yStart + (r.yEnd - r.yStart) * t;
        if (ry <= maxReachable + 0.35 && ry >= bestY - 0.05) {
          bestY = ry;
          bestLabel = r.label;
        }
      }
    }

    return { y: bestY, label: bestLabel };
  }

  public resolveCharacter(params: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    dt: number;
    radius: number;
    height: number;
    grounded: boolean;
  }): {
    x: number;
    y: number;
    z: number;
    vy: number;
    grounded: boolean;
    floorLabel: string;
  } {
    const { vx, vz, dt, radius, height } = params;
    let x = THREE.MathUtils.clamp(
      params.x + vx * dt,
      -WORLD_HALF_SIZE + 5,
      WORLD_HALF_SIZE - 5
    );
    let z = THREE.MathUtils.clamp(
      params.z + vz * dt,
      -WORLD_HALF_SIZE + 5,
      WORLD_HALF_SIZE - 5
    );
    let y = params.y;
    let vy = params.vy;
    let grounded = params.grounded;

    // Horizontal circle-vs-AABB pushout (ignores obstacles below step-up threshold or above head)
    const footMinY = y + 0.52;
    const headMaxY = y + height;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.walls.length; i++) {
        const w = this.walls[i];
        if (w.maxY <= footMinY || w.minY >= headMaxY) continue;

        const closestX = Math.max(w.minX, Math.min(x, w.maxX));
        const closestZ = Math.max(w.minZ, Math.min(z, w.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = radius - dist;
            x += (dx / dist) * overlap;
            z += (dz / dist) * overlap;
          } else {
            // Inside box fallback: push along shallowest axis
            const penLeft = Math.abs(x - w.minX);
            const penRight = Math.abs(w.maxX - x);
            const penBack = Math.abs(z - w.minZ);
            const penFront = Math.abs(w.maxZ - z);
            const minPen = Math.min(penLeft, penRight, penBack, penFront);
            if (minPen === penLeft) x = w.minX - radius;
            else if (minPen === penRight) x = w.maxX + radius;
            else if (minPen === penBack) z = w.minZ - radius;
            else z = w.maxZ + radius;
          }
        }
      }
    }

    // Apply vertical velocity & gravity
    if (!grounded || vy > 0) {
      vy -= 26.5 * dt;
      y += vy * dt;
    }

    // Ceiling check against upper floor slabs when jumping indoors
    if (vy > 0) {
      for (let i = 0; i < this.floors.length; i++) {
        const f = this.floors[i];
        if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
          if (
            f.hole &&
            x > f.hole.minX &&
            x < f.hole.maxX &&
            z > f.hole.minZ &&
            z < f.hole.maxZ
          ) {
            continue;
          }
          const slabBottom = f.y - f.thickness;
          if (y + height > slabBottom && y < slabBottom - 0.3) {
            y = slabBottom - height;
            vy = 0;
          }
        }
      }
    }

    const support = this.getSupportSurface(x, z, params.y, grounded ? 0.78 : 0.35);

    if (y <= support.y + (grounded && vy <= 0 ? 0.42 : 0.06) && vy <= 0) {
      y = support.y;
      vy = 0;
      grounded = true;
    } else if (y > support.y + 0.08) {
      grounded = false;
    }

    return {
      x,
      y,
      z,
      vy,
      grounded,
      floorLabel: support.label,
    };
  }

  /**
   * Raycast against all solid walls + terrain heightmap. Returns hit distance or null.
   */
  public raycastSolid(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number
  ): { distance: number; point: THREE.Vector3; normal: THREE.Vector3 } | null {
    let bestT = maxDist;
    let hitFound = false;
    const hitNormal = new THREE.Vector3(0, 1, 0);

    const invX = dir.x !== 0 ? 1 / dir.x : 1e9;
    const invY = dir.y !== 0 ? 1 / dir.y : 1e9;
    const invZ = dir.z !== 0 ? 1 / dir.z : 1e9;

    for (let i = 0; i < this.walls.length; i++) {
      const b = this.walls[i];
      const t1 = (b.minX - origin.x) * invX;
      const t2 = (b.maxX - origin.x) * invX;
      const t3 = (b.minY - origin.y) * invY;
      const t4 = (b.maxY - origin.y) * invY;
      const t5 = (b.minZ - origin.z) * invZ;
      const t6 = (b.maxZ - origin.z) * invZ;

      const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
      const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

      if (tmax >= 0 && tmin <= tmax && tmin >= 0 && tmin < bestT) {
        bestT = tmin;
        hitFound = true;
      }
    }

    // Also test floor slabs for downward/upward bullets
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (Math.abs(dir.y) < 1e-5) continue;
      const t = (f.y - origin.y) / dir.y;
      if (t > 0.05 && t < bestT) {
        const hx = origin.x + dir.x * t;
        const hz = origin.z + dir.z * t;
        if (hx >= f.minX && hx <= f.maxX && hz >= f.minZ && hz <= f.maxZ) {
          if (
            f.hole &&
            hx > f.hole.minX &&
            hx < f.hole.maxX &&
            hz > f.hole.minZ &&
            hz < f.hole.maxZ
          ) {
            continue;
          }
          bestT = t;
          hitFound = true;
        }
      }
    }

    // Coarse-to-fine terrain march
    const step = 2.5;
    for (let t = 1.5; t < bestT; t += step) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const th = getTerrainHeight(px, pz);
      if (py <= th) {
        bestT = Math.max(0.2, t - step * 0.5);
        hitFound = true;
        break;
      }
    }

    if (!hitFound) return null;
    return {
      distance: bestT,
      point: origin.clone().addScaledVector(dir, bestT),
      normal: hitNormal,
    };
  }
}
