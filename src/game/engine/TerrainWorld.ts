import * as THREE from "three";
import { GraphicsQuality, TimeOfDay } from "../types";
import {
  COMPOUND_BUILDINGS,
  getTerrainHeight,
  isRoadSurface,
  WORLD_HALF_SIZE,
} from "../worldData";
import { TacticalTexturePack } from "./ProceduralTextures";

export class TerrainWorld {
  public group = new THREE.Group();
  public terrainMesh!: THREE.Mesh;
  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;
  public blueZoneMesh!: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private textures: TacticalTexturePack,
    quality: GraphicsQuality,
    timeOfDay: TimeOfDay
  ) {
    this.setupAtmosphereAndLights(quality, timeOfDay);
    this.buildTerrainMesh(quality);
    this.buildBlueZoneBarrier();
    this.scene.add(this.group);
  }

  private setupAtmosphereAndLights(quality: GraphicsQuality, timeOfDay: TimeOfDay) {
    const presets: Record<
      TimeOfDay,
      {
        zenith: THREE.Color;
        horizon: THREE.Color;
        sunColor: number;
        sunIntensity: number;
        sunPos: [number, number, number];
        hemiSky: number;
        hemiGround: number;
        fogColor: number;
        fogDensity: number;
      }
    > = {
      golden: {
        zenith: new THREE.Color(0x1e4d8c),
        horizon: new THREE.Color(0xf4b678),
        sunColor: 0xffe0b2,
        sunIntensity: 2.65,
        sunPos: [130, 115, -90],
        hemiSky: 0xdbeafe,
        hemiGround: 0x4b5335,
        fogColor: 0xd9b38c,
        fogDensity: 0.0021,
      },
      noon: {
        zenith: new THREE.Color(0x1d63b8),
        horizon: new THREE.Color(0xbce3ff),
        sunColor: 0xfffbeb,
        sunIntensity: 2.8,
        sunPos: [85, 195, 65],
        hemiSky: 0xe0f2fe,
        hemiGround: 0x4b553a,
        fogColor: 0xb9dcfa,
        fogDensity: 0.0017,
      },
      dawn: {
        zenith: new THREE.Color(0x1e293b),
        horizon: new THREE.Color(0x94a3b8),
        sunColor: 0xfde68a,
        sunIntensity: 2.1,
        sunPos: [-140, 85, 110],
        hemiSky: 0x93c5fd,
        hemiGround: 0x334155,
        fogColor: 0x8ea0b5,
        fogDensity: 0.0028,
      },
    };

    const p = presets[timeOfDay] || presets.golden;
    this.scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);

    // Custom GLSL Atmospheric Sky Dome
    const skyDir = new THREE.Vector3(...p.sunPos).normalize();
    const skyGeo = new THREE.SphereGeometry(850, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: p.zenith },
        uHorizon: { value: p.horizon },
        uSunDir: { value: skyDir },
        uSunColor: { value: new THREE.Color(p.sunColor) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y * 1.15, 0.0, 1.0);
          vec3 sky = mix(uHorizon, uZenith, pow(h, 0.58));
          float sunAmt = max(dot(dir, uSunDir), 0.0);
          sky += uSunColor * pow(sunAmt, 24.0) * 0.45;
          sky += vec3(1.0, 0.98, 0.92) * smoothstep(0.9982, 0.9996, sunAmt) * 1.6;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(skyMesh);

    this.hemiLight = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, 1.15);
    this.group.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(p.sunColor, p.sunIntensity);
    this.sunLight.position.set(...p.sunPos);
    this.sunLight.castShadow = quality !== "smooth";

    if (this.sunLight.castShadow) {
      const mapRes = quality === "ultra" ? 2048 : 1024;
      this.sunLight.shadow.mapSize.set(mapRes, mapRes);
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 420;
      const d = 145;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0006;
    }
    this.group.add(this.sunLight);
  }

  private buildTerrainMesh(quality: GraphicsQuality) {
    const segs = quality === "smooth" ? 130 : 196;
    const size = WORLD_HALF_SIZE * 2 + 24;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getTerrainHeight(x, z));
    }
    geo.computeVertexNormals();

    const norm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);

    const lushGrass = new THREE.Color(0x4d6b38);
    const meadowWheat = new THREE.Color(0x7c8044);
    const rockSlope = new THREE.Color(0x6e6a63);
    const roadAsphalt = new THREE.Color(0x3a3e45);
    const compoundDirt = new THREE.Color(0x83755f);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ny = norm.getY(i);

      // Base grass + golden meadow noise
      const patch = Math.sin(x * 0.032 + 0.5) * Math.cos(z * 0.029 - 0.3) * 0.5 + 0.5;
      tmp.copy(lushGrass).lerp(meadowWheat, patch * 0.58);

      // Compound courtyard dirt pad blend
      for (let bIdx = 0; bIdx < COMPOUND_BUILDINGS.length; bIdx++) {
        const b = COMPOUND_BUILDINGS[bIdx];
        const dx = Math.abs(x - b.x);
        const dz = Math.abs(z - b.z);
        if (dx < b.width * 0.5 + 5.5 && dz < b.depth * 0.5 + 5.5) {
          tmp.lerp(compoundDirt, 0.78);
          break;
        }
      }

      // Asphalt highway blend
      const roadFactor = isRoadSurface(x, z);
      if (roadFactor > 0) {
        tmp.lerp(roadAsphalt, roadFactor * 0.92);
      }

      // Steep rocky cliff ridges
      if (ny < 0.87 || y > 10.5) {
        const rockBlend = THREE.MathUtils.clamp((0.88 - ny) * 4.5 + Math.max(0, (y - 11) * 0.08), 0, 1);
        tmp.lerp(rockSlope, rockBlend);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.grassDetail,
      roughness: 0.92,
      metalness: 0.04,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.group.add(this.terrainMesh);
  }

  private buildBlueZoneBarrier() {
    const geo = new THREE.CylinderGeometry(
      WORLD_HALF_SIZE - 4,
      WORLD_HALF_SIZE - 4,
      65,
      64,
      1,
      true
    );
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.blueZoneMesh = new THREE.Mesh(geo, mat);
    this.blueZoneMesh.position.y = 28;
    this.group.add(this.blueZoneMesh);
  }

  public update(elapsed: number) {
    if (this.blueZoneMesh) {
      const mat = this.blueZoneMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.11 + Math.sin(elapsed * 2.2) * 0.03;
    }
  }
}
