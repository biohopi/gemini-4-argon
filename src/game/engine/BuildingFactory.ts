import * as THREE from "three";
import {
  AIRDROP_SPOTS,
  BuildingPlacement,
  COMPOUND_BUILDINGS,
  FLOOR_HEIGHT,
  getTerrainHeight,
} from "../worldData";
import { TacticalTexturePack } from "./ProceduralTextures";
import { WorldCollision } from "./WorldCollision";

interface SmokePuff {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
}

export class BuildingFactory {
  public group = new THREE.Group();
  private smokePuffs: SmokePuff[] = [];

  constructor(
    private scene: THREE.Scene,
    private textures: TacticalTexturePack,
    private collision: WorldCollision
  ) {
    this.buildAllCompounds();
    this.buildAirdropCrates();
    this.scene.add(this.group);
  }

  private addBox(
    parent: THREE.Group,
    mat: THREE.Material,
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    collide = true,
    castShadow = true
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (collide) {
      this.collision.addWallBox(cx, cy, cz, sx, sy, sz);
    }
    return mesh;
  }

  /**
   * Builds a wall segment along X (facing Z) with a central opening (doorway or window).
   */
  private buildWallAlongX(
    parent: THREE.Group,
    wallMat: THREE.Material,
    trimMat: THREE.Material,
    cx: number,
    baseY: number,
    z: number,
    totalWidth: number,
    height: number,
    thickness: number,
    opening: { width: number; sillH: number; topH: number }
  ) {
    const sideW = Math.max(0.4, (totalWidth - opening.width) * 0.5);
    const leftX = cx - totalWidth * 0.5 + sideW * 0.5;
    const rightX = cx + totalWidth * 0.5 - sideW * 0.5;

    // Left & Right solid piers
    this.addBox(parent, wallMat, leftX, baseY + height * 0.5, z, sideW, height, thickness);
    this.addBox(parent, wallMat, rightX, baseY + height * 0.5, z, sideW, height, thickness);

    // Sill below window (0 if doorway)
    if (opening.sillH > 0.05) {
      this.addBox(
        parent,
        wallMat,
        cx,
        baseY + opening.sillH * 0.5,
        z,
        opening.width,
        opening.sillH,
        thickness
      );
      // Architectural window sill ledge
      this.addBox(
        parent,
        trimMat,
        cx,
        baseY + opening.sillH + 0.04,
        z,
        opening.width + 0.2,
        0.09,
        thickness + 0.12,
        false,
        false
      );
    }

    // Lintel above opening
    const lintelH = height - opening.topH;
    if (lintelH > 0.05) {
      this.addBox(
        parent,
        wallMat,
        cx,
        baseY + opening.topH + lintelH * 0.5,
        z,
        opening.width,
        lintelH,
        thickness
      );
      this.addBox(
        parent,
        trimMat,
        cx,
        baseY + opening.topH - 0.04,
        z,
        opening.width + 0.16,
        0.09,
        thickness + 0.1,
        false,
        false
      );
    }
  }

  /**
   * Builds a wall segment along Z (facing X) with a central window opening.
   */
  private buildWallAlongZ(
    parent: THREE.Group,
    wallMat: THREE.Material,
    trimMat: THREE.Material,
    x: number,
    baseY: number,
    cz: number,
    totalDepth: number,
    height: number,
    thickness: number,
    opening: { width: number; sillH: number; topH: number }
  ) {
    const sideD = Math.max(0.4, (totalDepth - opening.width) * 0.5);
    const backZ = cz - totalDepth * 0.5 + sideD * 0.5;
    const frontZ = cz + totalDepth * 0.5 - sideD * 0.5;

    this.addBox(parent, wallMat, x, baseY + height * 0.5, backZ, thickness, height, sideD);
    this.addBox(parent, wallMat, x, baseY + height * 0.5, frontZ, thickness, height, sideD);

    if (opening.sillH > 0.05) {
      this.addBox(
        parent,
        wallMat,
        x,
        baseY + opening.sillH * 0.5,
        cz,
        thickness,
        opening.sillH,
        opening.width
      );
      this.addBox(
        parent,
        trimMat,
        x,
        baseY + opening.sillH + 0.04,
        cz,
        thickness + 0.12,
        0.09,
        opening.width + 0.2,
        false,
        false
      );
    }

    const lintelH = height - opening.topH;
    if (lintelH > 0.05) {
      this.addBox(
        parent,
        wallMat,
        x,
        baseY + opening.topH + lintelH * 0.5,
        cz,
        thickness,
        lintelH,
        opening.width
      );
    }
  }

  private buildStaircaseFlight(
    parent: THREE.Group,
    mat: THREE.Material,
    minX: number,
    maxX: number,
    zStart: number,
    zEnd: number,
    yStart: number,
    yEnd: number,
    label: string
  ) {
    const steps = 12;
    const width = maxX - minX;
    const cx = (minX + maxX) * 0.5;
    const stepDepth = Math.abs(zEnd - zStart) / steps;
    const stepRise = (yEnd - yStart) / steps;

    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const sz = zStart + (zEnd - zStart) * t;
      const sy = yStart + stepRise * (i + 1);
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.18, stepDepth + 0.06),
        mat
      );
      tread.position.set(cx, sy - 0.09, sz);
      tread.castShadow = true;
      tread.receiveShadow = true;
      parent.add(tread);
    }

    this.collision.addRamp({
      minX,
      maxX,
      minZ: Math.min(zStart, zEnd) - 0.3,
      maxZ: Math.max(zStart, zEnd) + 0.3,
      zStart,
      zEnd,
      yStart,
      yEnd,
      label,
    });
  }

  private buildThreeStageBuilding(
    b: BuildingPlacement,
    floorMat: THREE.Material,
    crateMat: THREE.Material
  ) {
    const bGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: b.wallColor,
      map: this.textures.concreteWall,
      roughness: 0.86,
      metalness: 0.05,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: b.trimColor,
      roughness: 0.7,
      metalness: 0.18,
    });

    const W = b.width;
    const D = b.depth;
    const wallT = 0.36;
    const slabT = 0.28;

    const y1 = b.baseY + 0.16;
    const y2 = y1 + FLOOR_HEIGHT;
    const y3 = y2 + FLOOR_HEIGHT;

    const upperName = b.name.toUpperCase();

    // =========================================================
    // STAGE 1: GROUND FLOOR FOUNDATION, DOORWAYS, WINDOWS & STAIRS
    // =========================================================
    this.addBox(bGroup, floorMat, b.x, y1 - 0.18, b.z, W + 0.6, 0.36, D + 0.6, false, false);
    this.collision.addFloor({
      minX: b.x - W * 0.5 - 0.3,
      maxX: b.x + W * 0.5 + 0.3,
      minZ: b.z - D * 0.5 - 0.3,
      maxZ: b.z + D * 0.5 + 0.3,
      y: y1,
      thickness: 0.36,
      label: `${upperName} • STAGE 1 (GROUND)`,
    });

    // Front (+Z) & Back (-Z) Doorways
    this.buildWallAlongX(
      bGroup,
      wallMat,
      trimMat,
      b.x,
      y1,
      b.z + D * 0.5 - wallT * 0.5,
      W,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 2.9, sillH: 0, topH: 2.55 }
    );
    this.buildWallAlongX(
      bGroup,
      wallMat,
      trimMat,
      b.x,
      y1,
      b.z - D * 0.5 + wallT * 0.5,
      W,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 2.9, sillH: 0, topH: 2.55 }
    );

    // Left (-X) & Right (+X) Tactical Sniper Windows
    this.buildWallAlongZ(
      bGroup,
      wallMat,
      trimMat,
      b.x - W * 0.5 + wallT * 0.5,
      y1,
      b.z,
      D - wallT * 2,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 4.4, sillH: 1.05, topH: 2.35 }
    );
    this.buildWallAlongZ(
      bGroup,
      wallMat,
      trimMat,
      b.x + W * 0.5 - wallT * 0.5,
      y1,
      b.z,
      D - wallT * 2,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 4.0, sillH: 1.05, topH: 2.35 }
    );

    // Interior Cover Crate on Ground Floor
    this.addBox(bGroup, crateMat, b.x - 2.4, y1 + 0.55, b.z - 1.2, 1.3, 1.1, 1.3);

    // Flight 1 Staircase (East interior bay: climbs South -> North)
    const stair1MinX = b.x + W * 0.5 - 3.05;
    const stair1MaxX = b.x + W * 0.5 - 0.55;
    const stair1ZStart = b.z + D * 0.5 - 2.9;
    const stair1ZEnd = b.z - D * 0.5 + 3.1;
    this.buildStaircaseFlight(
      bGroup,
      trimMat,
      stair1MinX,
      stair1MaxX,
      stair1ZStart,
      stair1ZEnd,
      y1,
      y2,
      `${upperName} • STAIRS (1 -> 2)`
    );

    // =========================================================
    // STAGE 2: SECOND FLOOR DECK, BALCONY, SNIPER WINDOWS & STAIRS
    // =========================================================
    // Render Floor 2 slab around stairwell 1 opening
    const mainSlab2W = W - 3.1;
    this.addBox(
      bGroup,
      floorMat,
      b.x - 1.55,
      y2 - slabT * 0.5,
      b.z,
      mainSlab2W,
      slabT,
      D,
      false
    );
    // North landing strip in front of Stair 1 top
    this.addBox(
      bGroup,
      floorMat,
      (stair1MinX + stair1MaxX) * 0.5,
      y2 - slabT * 0.5,
      b.z - D * 0.5 + 1.55,
      2.6,
      slabT,
      3.1,
      false
    );
    // Exterior architectural belt trim
    this.addBox(bGroup, trimMat, b.x, y2 - 0.14, b.z, W + 0.32, 0.3, D + 0.32, false, false);

    this.collision.addFloor({
      minX: b.x - W * 0.5,
      maxX: b.x + W * 0.5,
      minZ: b.z - D * 0.5,
      maxZ: b.z + D * 0.5,
      y: y2,
      thickness: slabT,
      label: `${upperName} • STAGE 2 (2ND FLOOR)`,
      hole: {
        minX: stair1MinX - 0.05,
        maxX: stair1MaxX + 0.05,
        minZ: stair1ZEnd + 0.15,
        maxZ: stair1ZStart + 0.2,
      },
    });

    // Stage 2 Front Balcony (+Z)
    const balcW = 5.2;
    const balcD = 2.3;
    const balcZ = b.z + D * 0.5 + balcD * 0.5;
    this.addBox(bGroup, floorMat, b.x, y2 - slabT * 0.5, balcZ, balcW, slabT, balcD, false);
    this.addBox(bGroup, trimMat, b.x, y2 + 0.52, balcZ + balcD * 0.5 - 0.1, balcW, 1.04, 0.2);
    this.addBox(bGroup, trimMat, b.x - balcW * 0.5 + 0.1, y2 + 0.52, balcZ, 0.2, 1.04, balcD);
    this.addBox(bGroup, trimMat, b.x + balcW * 0.5 - 0.1, y2 + 0.52, balcZ, 0.2, 1.04, balcD);
    this.collision.addFloor({
      minX: b.x - balcW * 0.5,
      maxX: b.x + balcW * 0.5,
      minZ: b.z + D * 0.5,
      maxZ: b.z + D * 0.5 + balcD,
      y: y2,
      thickness: slabT,
      label: `${upperName} • STAGE 2 BALCONY`,
    });

    // Stage 2 Walls (Front opens onto Balcony; Back/Left/Right have wide sniper windows)
    this.buildWallAlongX(
      bGroup,
      wallMat,
      trimMat,
      b.x,
      y2,
      b.z + D * 0.5 - wallT * 0.5,
      W,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 2.8, sillH: 0, topH: 2.5 }
    );
    this.buildWallAlongX(
      bGroup,
      wallMat,
      trimMat,
      b.x,
      y2,
      b.z - D * 0.5 + wallT * 0.5,
      W,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 5.2, sillH: 1.0, topH: 2.35 }
    );
    this.buildWallAlongZ(
      bGroup,
      wallMat,
      trimMat,
      b.x - W * 0.5 + wallT * 0.5,
      y2,
      b.z,
      D - wallT * 2,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 4.8, sillH: 1.0, topH: 2.35 }
    );
    this.buildWallAlongZ(
      bGroup,
      wallMat,
      trimMat,
      b.x + W * 0.5 - wallT * 0.5,
      y2,
      b.z,
      D - wallT * 2,
      FLOOR_HEIGHT - slabT,
      wallT,
      { width: 4.8, sillH: 1.0, topH: 2.35 }
    );

    // Interior Crate on Floor 2
    this.addBox(bGroup, crateMat, b.x + 0.6, y2 + 0.55, b.z + 1.5, 1.2, 1.1, 1.2);

    // Flight 2 Staircase (West interior bay: climbs North -> South up to Stage 3 Rooftop)
    const stair2MinX = b.x - W * 0.5 + 0.55;
    const stair2MaxX = b.x - W * 0.5 + 3.05;
    const stair2ZStart = b.z - D * 0.5 + 2.9;
    const stair2ZEnd = b.z + D * 0.5 - 3.1;
    this.buildStaircaseFlight(
      bGroup,
      trimMat,
      stair2MinX,
      stair2MaxX,
      stair2ZStart,
      stair2ZEnd,
      y2,
      y3,
      `${upperName} • STAIRS (2 -> 3)`
    );

    // =========================================================
    // STAGE 3: THIRD FLOOR SNIPER ROOFTOP, PARAPETS & PENTHOUSE
    // =========================================================
    const mainSlab3W = W - 3.1;
    this.addBox(
      bGroup,
      floorMat,
      b.x + 1.55,
      y3 - slabT * 0.5,
      b.z,
      mainSlab3W,
      slabT,
      D,
      false
    );
    // South landing strip in front of Stair 2 top
    this.addBox(
      bGroup,
      floorMat,
      (stair2MinX + stair2MaxX) * 0.5,
      y3 - slabT * 0.5,
      b.z + D * 0.5 - 1.55,
      2.6,
      slabT,
      3.1,
      false
    );
    this.addBox(bGroup, trimMat, b.x, y3 - 0.14, b.z, W + 0.4, 0.3, D + 0.4, false, false);

    this.collision.addFloor({
      minX: b.x - W * 0.5,
      maxX: b.x + W * 0.5,
      minZ: b.z - D * 0.5,
      maxZ: b.z + D * 0.5,
      y: y3,
      thickness: slabT,
      label: `${upperName} • STAGE 3 (ROOFTOP)`,
      hole: {
        minX: stair2MinX - 0.05,
        maxX: stair2MaxX + 0.05,
        minZ: stair2ZStart - 0.2,
        maxZ: stair2ZEnd - 0.15,
      },
    });

    // Crenellated Sniper Parapet Walls (1.02m high: crouch/prone = full cover, stand = clear shot!)
    const pH = 1.02;
    this.addBox(bGroup, wallMat, b.x - W * 0.26, y3 + pH * 0.5, b.z + D * 0.5 - 0.18, W * 0.4, pH, 0.35);
    this.addBox(bGroup, wallMat, b.x + W * 0.26, y3 + pH * 0.5, b.z + D * 0.5 - 0.18, W * 0.4, pH, 0.35);
    this.addBox(bGroup, wallMat, b.x - W * 0.26, y3 + pH * 0.5, b.z - D * 0.5 + 0.18, W * 0.4, pH, 0.35);
    this.addBox(bGroup, wallMat, b.x + W * 0.26, y3 + pH * 0.5, b.z - D * 0.5 + 0.18, W * 0.4, pH, 0.35);
    this.addBox(bGroup, wallMat, b.x + W * 0.5 - 0.18, y3 + pH * 0.5, b.z - D * 0.25, 0.35, pH, D * 0.38);
    this.addBox(bGroup, wallMat, b.x + W * 0.5 - 0.18, y3 + pH * 0.5, b.z + D * 0.25, 0.35, pH, D * 0.38);
    this.addBox(bGroup, wallMat, b.x - W * 0.5 + 0.18, y3 + pH * 0.5, b.z, 0.35, pH, D * 0.85);

    // Stage 3 Stairhead Canopy & Tactical Antenna Mast
    const canopyY = y3 + 2.55;
    this.addBox(
      bGroup,
      trimMat,
      (stair2MinX + stair2MaxX) * 0.5,
      canopyY,
      b.z - 0.4,
      3.1,
      0.24,
      D - 2.6,
      false
    );
    // Support posts for canopy
    this.addBox(bGroup, trimMat, stair2MaxX, y3 + 1.25, b.z - D * 0.5 + 2.0, 0.22, 2.5, 0.22);
    this.addBox(bGroup, trimMat, stair2MaxX, y3 + 1.25, b.z + D * 0.5 - 3.2, 0.22, 2.5, 0.22);

    // Rooftop Comms Mast
    this.addBox(
      bGroup,
      trimMat,
      (stair2MinX + stair2MaxX) * 0.5,
      canopyY + 1.8,
      b.z - 1.5,
      0.12,
      3.6,
      0.12,
      false,
      false
    );

    // Rooftop Tactical Supply Crate
    this.addBox(bGroup, crateMat, b.x + 2.8, y3 + 0.55, b.z - 1.6, 1.4, 1.1, 1.1);

    this.group.add(bGroup);
  }

  private buildAllCompounds() {
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      map: this.textures.floorConcrete,
      roughness: 0.9,
      metalness: 0.05,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      map: this.textures.militaryCrate,
      roughness: 0.82,
      metalness: 0.08,
    });
    const jerseyMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.92,
    });

    for (const b of COMPOUND_BUILDINGS) {
      this.buildThreeStageBuilding(b, floorMat, crateMat);

      // Exterior compound concrete jersey barriers for outdoor cover
      const bx1 = b.x + b.width * 0.5 + 3.4;
      const bz1 = b.z + 2.2;
      const h1 = getTerrainHeight(bx1, bz1);
      this.addBox(this.group, jerseyMat, bx1, h1 + 0.6, bz1, 0.65, 1.2, 3.4);

      const bx2 = b.x - b.width * 0.5 - 3.4;
      const bz2 = b.z - 2.2;
      const h2 = getTerrainHeight(bx2, bz2);
      this.addBox(this.group, jerseyMat, bx2, h2 + 0.6, bz2, 0.65, 1.2, 3.4);
    }
  }

  private buildAirdropCrates() {
    const dropMat = new THREE.MeshStandardMaterial({
      map: this.textures.airdropSide,
      roughness: 0.65,
      metalness: 0.15,
    });
    const smokeGeo = new THREE.SphereGeometry(0.65, 8, 8);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    for (const spot of AIRDROP_SPOTS) {
      const y = getTerrainHeight(spot.x, spot.z);
      this.addBox(this.group, dropMat, spot.x, y + 0.72, spot.z, 1.55, 1.45, 1.55);

      // Glowing red flare beacon on top
      const flare = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4444 })
      );
      flare.position.set(spot.x + 0.4, y + 1.55, spot.z + 0.3);
      this.group.add(flare);

      // Rising red smoke plume spheres
      for (let i = 0; i < 9; i++) {
        const puff = new THREE.Mesh(smokeGeo, smokeMat.clone());
        this.group.add(puff);
        this.smokePuffs.push({
          mesh: puff,
          baseX: spot.x + 0.4,
          baseY: y + 1.7,
          baseZ: spot.z + 0.3,
          phase: i / 9,
          speed: 0.22 + (i % 3) * 0.03,
        });
      }
    }
  }

  public update(elapsed: number) {
    for (let i = 0; i < this.smokePuffs.length; i++) {
      const p = this.smokePuffs[i];
      const cycle = (elapsed * p.speed + p.phase) % 1;
      p.mesh.position.set(
        p.baseX + Math.sin(elapsed * 1.4 + p.phase * 6) * cycle * 2.1,
        p.baseY + cycle * 14.5,
        p.baseZ + Math.cos(elapsed * 1.1 + p.phase * 5) * cycle * 1.8
      );
      const scale = 0.55 + cycle * 2.6;
      p.mesh.scale.setScalar(scale);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.44;
    }
  }
}
