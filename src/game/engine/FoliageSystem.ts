import * as THREE from "three";
import { GraphicsQuality } from "../types";
import {
  AIRDROP_SPOTS,
  COMPOUND_BUILDINGS,
  getTerrainHeight,
  isRoadSurface,
  WORLD_HALF_SIZE,
} from "../worldData";
import { WorldCollision } from "./WorldCollision";

export class FoliageSystem {
  public group = new THREE.Group();
  private grassUniformTime = { value: 0 };

  constructor(
    private scene: THREE.Scene,
    private collision: WorldCollision,
    quality: GraphicsQuality
  ) {
    this.spawnTreesAndRocks(quality);
    this.spawnInstancedGrass(quality);
    this.scene.add(this.group);
  }

  private isClearOfStructures(x: number, z: number, margin: number): boolean {
    if (isRoadSurface(x, z) > 0.15) return false;
    for (const b of COMPOUND_BUILDINGS) {
      if (
        Math.abs(x - b.x) < b.width * 0.5 + margin &&
        Math.abs(z - b.z) < b.depth * 0.5 + margin
      ) {
        return false;
      }
    }
    for (const d of AIRDROP_SPOTS) {
      if (Math.hypot(x - d.x, z - d.z) < margin + 3) return false;
    }
    return true;
  }

  private spawnTreesAndRocks(quality: GraphicsQuality) {
    const treeCount = quality === "smooth" ? 95 : 155;
    const rockCount = quality === "smooth" ? 55 : 85;

    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 2.8, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.95 });

    const canopyGeo1 = new THREE.ConeGeometry(2.1, 4.2, 8);
    const canopyGeo2 = new THREE.ConeGeometry(1.55, 3.4, 8);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x2d4c2b,
      roughness: 0.88,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const conesLow = new THREE.InstancedMesh(canopyGeo1, canopyMat, treeCount);
    const conesHigh = new THREE.InstancedMesh(canopyGeo2, canopyMat, treeCount);

    trunks.castShadow = quality !== "smooth";
    conesLow.castShadow = quality !== "smooth";
    conesHigh.castShadow = quality === "ultra";

    const dummy = new THREE.Object3D();
    let placedTrees = 0;
    let seed = 48271;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let attempt = 0; attempt < treeCount * 6 && placedTrees < treeCount; attempt++) {
      const x = (rand() - 0.5) * (WORLD_HALF_SIZE * 1.88);
      const z = (rand() - 0.5) * (WORLD_HALF_SIZE * 1.88);
      if (!this.isClearOfStructures(x, z, 7.5)) continue;

      const y = getTerrainHeight(x, z);
      const scale = 0.82 + rand() * 0.58;

      dummy.position.set(x, y + 1.3 * scale, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placedTrees, dummy.matrix);

      dummy.position.set(x, y + 3.6 * scale, z);
      dummy.updateMatrix();
      conesLow.setMatrixAt(placedTrees, dummy.matrix);

      dummy.position.set(x, y + 5.3 * scale, z);
      dummy.updateMatrix();
      conesHigh.setMatrixAt(placedTrees, dummy.matrix);

      // Solid tree trunk collider for tactical tree-cover firefights!
      this.collision.addWallBox(x, y + 1.6, z, 0.65 * scale, 3.2 * scale, 0.65 * scale);
      placedTrees++;
    }

    trunks.count = placedTrees;
    conesLow.count = placedTrees;
    conesHigh.count = placedTrees;
    this.group.add(trunks, conesLow, conesHigh);

    // Tactical Boulders
    const rockGeo = new THREE.DodecahedronGeometry(1.15, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.92,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = quality !== "smooth";
    rocks.receiveShadow = true;

    let placedRocks = 0;
    for (let attempt = 0; attempt < rockCount * 6 && placedRocks < rockCount; attempt++) {
      const x = (rand() - 0.5) * (WORLD_HALF_SIZE * 1.84);
      const z = (rand() - 0.5) * (WORLD_HALF_SIZE * 1.84);
      if (!this.isClearOfStructures(x, z, 5.5)) continue;

      const y = getTerrainHeight(x, z);
      const sx = 0.9 + rand() * 1.1;
      const sy = 0.7 + rand() * 0.75;
      const sz = 0.9 + rand() * 1.1;

      dummy.position.set(x, y + sy * 0.55, z);
      dummy.rotation.set(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      rocks.setMatrixAt(placedRocks, dummy.matrix);

      this.collision.addWallBox(x, y + sy * 0.6, z, sx * 1.5, sy * 1.5, sz * 1.5);
      placedRocks++;
    }
    rocks.count = placedRocks;
    this.group.add(rocks);
  }

  private spawnInstancedGrass(quality: GraphicsQuality) {
    const count = quality === "smooth" ? 1400 : quality === "hd" ? 3200 : 5200;

    // Crossed blade tuft geometry (2 intersecting quads = 4 triangles per tuft)
    const p1 = new THREE.PlaneGeometry(0.55, 0.55);
    p1.translate(0, 0.26, 0);
    const p2 = p1.clone();
    p2.rotateY(Math.PI * 0.5);

    const pos1 = p1.attributes.position.array as Float32Array;
    const pos2 = p2.attributes.position.array as Float32Array;
    const combinedPos = new Float32Array(pos1.length + pos2.length);
    combinedPos.set(pos1, 0);
    combinedPos.set(pos2, pos1.length);

    const idx1 = Array.from(p1.index!.array);
    const idx2 = Array.from(p2.index!.array).map((v) => v + 4);
    const tuftGeo = new THREE.BufferGeometry();
    tuftGeo.setAttribute("position", new THREE.BufferAttribute(combinedPos, 3));
    tuftGeo.setIndex([...idx1, ...idx2]);
    tuftGeo.computeVertexNormals();

    const grassMat = new THREE.MeshLambertMaterial({
      color: 0x5c7c3d,
      side: THREE.DoubleSide,
    });

    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.grassUniformTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          float tip = max(0.0, position.y);
          vec4 instWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          transformed.x += sin(uTime * 2.4 + instWorld.x * 0.35 + instWorld.z * 0.25) * 0.14 * tip;
          `
        );
    };

    const grassInst = new THREE.InstancedMesh(tuftGeo, grassMat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    let placed = 0;
    let seed = 91823;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < count * 2 && placed < count; i++) {
      const x = (rand() - 0.5) * 320;
      const z = (rand() - 0.5) * 320;
      if (!this.isClearOfStructures(x, z, 4.2)) continue;
      const y = getTerrainHeight(x, z);
      if (y > 10.5) continue;

      const s = 0.75 + rand() * 0.75;
      dummy.position.set(x, y - 0.03, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(s, s * (0.85 + rand() * 0.5), s);
      dummy.updateMatrix();
      grassInst.setMatrixAt(placed, dummy.matrix);

      color.setHSL(0.24 + (rand() - 0.5) * 0.05, 0.42, 0.34 + rand() * 0.12);
      grassInst.setColorAt(placed, color);
      placed++;
    }

    grassInst.count = placed;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    this.group.add(grassInst);
  }

  public update(elapsed: number) {
    this.grassUniformTime.value = elapsed;
  }
}
