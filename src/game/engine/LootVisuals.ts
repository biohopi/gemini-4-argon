import * as THREE from "three";
import { WorldLootItem } from "../types";

const RARITY_COLORS: Record<WorldLootItem["rarity"], number> = {
  common: 0x94a3b8,
  rare: 0x38bdf8,
  epic: 0xc084fc,
  mythic: 0xf59e0b,
};

export class LootVisuals {
  public group = new THREE.Group();
  private itemMeshes = new Map<string, THREE.Group>();

  constructor(private scene: THREE.Scene, items: WorldLootItem[]) {
    this.buildLootMeshes(items);
    this.scene.add(this.group);
  }

  private buildLootMeshes(items: WorldLootItem[]) {
    const ringGeo = new THREE.RingGeometry(0.32, 0.42, 16);
    ringGeo.rotateX(-Math.PI * 0.5);

    const weaponGeo = new THREE.BoxGeometry(0.75, 0.14, 0.22);
    const ammoGeo = new THREE.BoxGeometry(0.34, 0.24, 0.26);
    const medGeo = new THREE.BoxGeometry(0.38, 0.22, 0.32);
    const scopeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.34, 10);
    scopeGeo.rotateZ(Math.PI * 0.5);
    const armorGeo = new THREE.SphereGeometry(0.22, 10, 8);

    for (const item of items) {
      const g = new THREE.Group();
      g.position.set(item.x, item.y, item.z);

      const rarityColor = RARITY_COLORS[item.rarity];
      const ringMat = new THREE.MeshBasicMaterial({
        color: rarityColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.02;
      g.add(ring);

      let objColor = 0x475569;
      let geo: THREE.BufferGeometry = ammoGeo;

      if (item.kind === "weapon") {
        geo = weaponGeo;
        objColor = item.itemId === "AWM" ? 0x15803d : item.itemId === "KAR98K" ? 0x92400e : 0x334155;
      } else if (item.kind === "ammo") {
        geo = ammoGeo;
        objColor = item.itemId === "5.56mm" ? 0x22c55e : item.itemId === "7.62mm" ? 0xd97706 : 0x38bdf8;
      } else if (item.kind === "med") {
        geo = medGeo;
        objColor = item.itemId === "energydrink" ? 0x0284c7 : 0xef4444;
      } else if (item.kind === "scope") {
        geo = scopeGeo;
        objColor = 0xeab308;
      } else if (item.kind === "armor") {
        geo = armorGeo;
        objColor = 0x1e293b;
      }

      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: objColor,
          emissive: rarityColor,
          emissiveIntensity: item.rarity === "mythic" ? 0.35 : 0.14,
          roughness: 0.45,
          metalness: 0.35,
        })
      );
      mesh.position.y = 0.22;
      g.add(mesh);

      this.itemMeshes.set(item.id, g);
      this.group.add(g);
    }
  }

  public markPickedUp(id: string) {
    const g = this.itemMeshes.get(id);
    if (g) {
      g.visible = false;
    }
  }

  public update(elapsed: number, playerX: number, playerZ: number) {
    for (const g of this.itemMeshes.values()) {
      if (!g.visible) continue;
      // Only animate nearby loot within 48m for slick CPU performance
      const dx = g.position.x - playerX;
      const dz = g.position.z - playerZ;
      if (dx * dx + dz * dz < 2304) {
        const itemObj = g.children[1];
        if (itemObj) {
          itemObj.rotation.y = elapsed * 1.4;
          itemObj.position.y = 0.22 + Math.sin(elapsed * 2.8 + g.position.x) * 0.05;
        }
      }
    }
  }
}
