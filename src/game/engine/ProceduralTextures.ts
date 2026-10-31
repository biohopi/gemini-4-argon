import * as THREE from "three";

export interface TacticalTexturePack {
  grassDetail: THREE.CanvasTexture;
  concreteWall: THREE.CanvasTexture;
  floorConcrete: THREE.CanvasTexture;
  militaryCrate: THREE.CanvasTexture;
  airdropSide: THREE.CanvasTexture;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy = 4): TacticalTexturePack {
  // 1. Grass micro-detail texture (blended with vertex colors on Terrain)
  const [gCanvas, gCtx] = makeCanvas(256);
  gCtx.fillStyle = "#d9e2d0";
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 185 + Math.floor(Math.random() * 65);
    gCtx.fillStyle = `rgb(${shade - 12}, ${shade + 8}, ${shade - 22})`;
    gCtx.fillRect(x, y, 2, 4);
  }
  const grassDetail = new THREE.CanvasTexture(gCanvas);
  grassDetail.wrapS = grassDetail.wrapT = THREE.RepeatWrapping;
  grassDetail.repeat.set(95, 95);
  grassDetail.anisotropy = maxAnisotropy;

  // 2. Weathered Plaster / Concrete Wall for 3-Stage Buildings
  const [wCanvas, wCtx] = makeCanvas(256);
  wCtx.fillStyle = "#e5e2dc";
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 205 + Math.floor(Math.random() * 45);
    wCtx.fillStyle = `rgba(${v}, ${v - 2}, ${v - 6}, 0.45)`;
    wCtx.fillRect(x, y, 3, 3);
  }
  // Subtle architectural form lines & weathering streaks
  wCtx.strokeStyle = "rgba(90, 86, 78, 0.18)";
  wCtx.lineWidth = 2;
  for (let y = 32; y < 256; y += 64) {
    wCtx.beginPath();
    wCtx.moveTo(0, y);
    wCtx.lineTo(256, y);
    wCtx.stroke();
  }
  const concreteWall = new THREE.CanvasTexture(wCanvas);
  concreteWall.wrapS = concreteWall.wrapT = THREE.RepeatWrapping;
  concreteWall.repeat.set(2, 1);
  concreteWall.anisotropy = maxAnisotropy;

  // 3. Tactical Concrete Floor Slab
  const [fCanvas, fCtx] = makeCanvas(256);
  fCtx.fillStyle = "#8a8f98";
  fCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    const v = 115 + Math.floor(Math.random() * 45);
    fCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    fCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  fCtx.strokeStyle = "rgba(40, 44, 52, 0.35)";
  fCtx.lineWidth = 2;
  for (let p = 0; p <= 256; p += 64) {
    fCtx.strokeRect(p, 0, 64, 256);
    fCtx.strokeRect(0, p, 256, 64);
  }
  const floorConcrete = new THREE.CanvasTexture(fCanvas);
  floorConcrete.wrapS = floorConcrete.wrapT = THREE.RepeatWrapping;
  floorConcrete.repeat.set(4, 4);
  floorConcrete.anisotropy = maxAnisotropy;

  // 4. Military Supply Crate
  const [cCanvas, cCtx] = makeCanvas(128);
  cCtx.fillStyle = "#4b5338";
  cCtx.fillRect(0, 0, 128, 128);
  cCtx.strokeStyle = "#2c3220";
  cCtx.lineWidth = 10;
  cCtx.strokeRect(5, 5, 118, 118);
  cCtx.beginPath();
  cCtx.moveTo(10, 10);
  cCtx.lineTo(118, 118);
  cCtx.stroke();
  cCtx.fillStyle = "#eab308";
  cCtx.fillRect(20, 56, 88, 14);
  const militaryCrate = new THREE.CanvasTexture(cCanvas);
  militaryCrate.anisotropy = maxAnisotropy;

  // 5. Iconic Red & Blue Tarp Airdrop Crate
  const [aCanvas, aCtx] = makeCanvas(128);
  aCtx.fillStyle = "#b91c1c";
  aCtx.fillRect(0, 44, 128, 84);
  aCtx.fillStyle = "#1d4ed8";
  aCtx.fillRect(0, 0, 128, 48);
  aCtx.strokeStyle = "#111827";
  aCtx.lineWidth = 6;
  aCtx.strokeRect(3, 3, 122, 122);
  aCtx.beginPath();
  aCtx.moveTo(64, 0);
  aCtx.lineTo(64, 128);
  aCtx.moveTo(0, 48);
  aCtx.lineTo(128, 48);
  aCtx.stroke();
  const airdropSide = new THREE.CanvasTexture(aCanvas);
  airdropSide.anisotropy = maxAnisotropy;

  return {
    grassDetail,
    concreteWall,
    floorConcrete,
    militaryCrate,
    airdropSide,
  };
}
