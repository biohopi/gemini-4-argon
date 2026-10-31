import * as THREE from "three";
import { PlayerStance, TeamId, WeaponId } from "../types";
import { WEAPONS } from "../weapons";

export class CharacterModel {
  public root = new THREE.Group();
  public posturePivot = new THREE.Group();
  public torsoGroup = new THREE.Group();
  public headGroup = new THREE.Group();
  public leftLeg = new THREE.Group();
  public rightLeg = new THREE.Group();
  public weaponRig = new THREE.Group();
  public muzzleFlash!: THREE.Mesh;

  private weaponModelGroup = new THREE.Group();
  private currentWeaponId: WeaponId = "M416";
  private spetsnazShield!: THREE.Mesh;
  private heavyVestPlate!: THREE.Mesh;

  private labelCanvas?: HTMLCanvasElement;
  private labelTexture?: THREE.CanvasTexture;
  private labelSprite?: THREE.Sprite;
  private lastDrawnHp = -1;

  private walkPhase = 0;
  private flashTimer = 0;
  private recoilKick = 0;

  constructor(
    public id: string,
    public name: string,
    public team: TeamId,
    public isLocal: boolean
  ) {
    this.buildBody();
    this.setWeapon("M416");
    if (!isLocal) {
      this.buildNameplate();
    }
  }

  private buildBody() {
    const isAlpha = this.team === "A";
    const uniformColor = isAlpha ? 0x2c3e50 : 0x45322e;
    const armorColor = 0x1f242d;
    const accentColor = isAlpha ? 0x38bdf8 : 0xf43f5e;
    const skinColor = 0xd6a786;

    const uniformMat = new THREE.MeshStandardMaterial({
      color: uniformColor,
      roughness: 0.85,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: armorColor,
      roughness: 0.6,
      metalness: 0.22,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.75,
    });
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x3f4739,
      roughness: 0.88,
    });

    this.root.add(this.posturePivot);

    // Legs (pivots at hip height 0.84m)
    this.leftLeg.position.set(-0.14, 0.84, 0);
    this.rightLeg.position.set(0.14, 0.84, 0);

    const makeLegMesh = () => {
      const g = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.44, 0.21), uniformMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), armorMat);
      shin.position.y = -0.62;
      shin.castShadow = true;
      g.add(thigh, shin);
      return g;
    };
    this.leftLeg.add(makeLegMesh());
    this.rightLeg.add(makeLegMesh());
    this.posturePivot.add(this.leftLeg, this.rightLeg);

    // Torso & Armored Vest
    this.torsoGroup.position.set(0, 0.86, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), uniformMat);
    chest.position.y = 0.28;
    chest.castShadow = true;
    this.torsoGroup.add(chest);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.31), armorMat);
    vest.position.y = 0.3;
    vest.castShadow = true;
    this.torsoGroup.add(vest);

    this.heavyVestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.48, 0.35),
      armorMat
    );
    this.heavyVestPlate.position.y = 0.3;
    this.heavyVestPlate.visible = false;
    this.torsoGroup.add(this.heavyVestPlate);

    // Team shoulder identification strips
    const leftBand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), accentMat);
    leftBand.position.set(-0.27, 0.43, 0);
    const rightBand = leftBand.clone();
    rightBand.position.x = 0.27;
    this.torsoGroup.add(leftBand, rightBand);

    // Tactical Unlimited Backpack on Back (+Z in local model since -Z is forward)
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.2), packMat);
    backpack.position.set(0, 0.3, 0.23);
    backpack.castShadow = true;
    this.torsoGroup.add(backpack);

    // Head & Tactical Helmet
    this.headGroup.position.set(0, 0.62, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.26, 0.25), skinMat);
    head.position.y = 0.13;
    head.castShadow = true;

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      armorMat
    );
    helmet.position.y = 0.16;
    helmet.castShadow = true;

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.05), accentMat);
    visor.position.set(0, 0.15, -0.13);

    this.spetsnazShield = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.16, 0.07),
      armorMat
    );
    this.spetsnazShield.position.set(0, 0.14, -0.14);
    this.spetsnazShield.visible = false;

    this.headGroup.add(head, helmet, visor, this.spetsnazShield);
    this.torsoGroup.add(this.headGroup);

    // Arms & Weapon Rig (oriented pointing toward -Z forward)
    this.weaponRig.position.set(0.18, 0.42, -0.12);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.42), uniformMat);
    rightArm.position.set(0.05, -0.02, -0.08);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.46), uniformMat);
    leftArm.position.set(-0.22, -0.03, -0.14);
    leftArm.rotation.y = -0.34;

    this.weaponRig.add(rightArm, leftArm, this.weaponModelGroup);

    // Muzzle Flash Star
    const flashGeo = new THREE.ConeGeometry(0.14, 0.42, 6);
    flashGeo.rotateX(-Math.PI * 0.5);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.92,
    });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.position.set(0, 0.04, -0.92);
    this.muzzleFlash.visible = false;
    this.weaponRig.add(this.muzzleFlash);

    this.torsoGroup.add(this.weaponRig);
    this.posturePivot.add(this.torsoGroup);
  }

  public setArmorVisuals(helmetLevel: number, vestLevel: number) {
    this.spetsnazShield.visible = helmetLevel >= 3;
    this.heavyVestPlate.visible = vestLevel >= 3;
  }

  public setWeapon(weaponId: WeaponId) {
    if (this.currentWeaponId === weaponId && this.weaponModelGroup.children.length > 0) {
      return;
    }
    this.currentWeaponId = weaponId;
    this.weaponModelGroup.clear();

    const spec = WEAPONS[weaponId] || WEAPONS.M416;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: spec.colorHex,
      roughness: 0.48,
      metalness: 0.55,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.38,
      metalness: 0.75,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: spec.accentHex,
      roughness: 0.4,
    });

    const isSniper = spec.category === "SR";
    const barrelLen = isSniper ? 0.62 : spec.category === "SMG" ? 0.28 : 0.44;

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.42), bodyMat);
    receiver.position.set(0, 0.02, -0.24);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, barrelLen, 8),
      darkMetal
    );
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.set(0, 0.04, -0.44 - barrelLen * 0.5);

    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, isSniper ? 0.09 : 0.2, 0.085),
      darkMetal
    );
    mag.position.set(0, -0.1, -0.28);
    mag.rotation.x = 0.18;

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.1, 0.22), bodyMat);
    stock.position.set(0, 0.0, 0.04);

    const optic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, isSniper ? 0.24 : 0.11, 8),
      darkMetal
    );
    optic.rotation.x = Math.PI * 0.5;
    optic.position.set(0, 0.105, -0.24);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.16), accentMat);
    stripe.position.set(0, 0.05, -0.24);

    this.weaponModelGroup.add(receiver, barrel, mag, stock, optic, stripe);
    this.muzzleFlash.position.set(0, 0.04, -0.48 - barrelLen);
  }

  public triggerMuzzleFlash() {
    this.flashTimer = 0.055;
    this.recoilKick = 0.12;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
  }

  private buildNameplate() {
    this.labelCanvas = document.createElement("canvas");
    this.labelCanvas.width = 256;
    this.labelCanvas.height = 64;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    const mat = new THREE.SpriteMaterial({
      map: this.labelTexture,
      transparent: true,
      depthTest: false,
    });
    this.labelSprite = new THREE.Sprite(mat);
    this.labelSprite.scale.set(1.85, 0.46, 1);
    this.labelSprite.position.set(0, 2.05, 0);
    this.root.add(this.labelSprite);
    this.redrawNameplate(100);
  }

  private redrawNameplate(hp: number) {
    if (!this.labelCanvas || !this.labelTexture) return;
    const rounded = Math.max(0, Math.round(hp));
    if (rounded === this.lastDrawnHp) return;
    this.lastDrawnHp = rounded;

    const ctx = this.labelCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 64);

    const isAlpha = this.team === "A";
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(24, 6, 208, 48);
    ctx.strokeStyle = isAlpha ? "#38bdf8" : "#f43f5e";
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 6, 208, 48);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.name.slice(0, 14), 128, 28);

    // HP Bar
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(38, 37, 180, 9);
    ctx.fillStyle = isAlpha ? "#38bdf8" : "#fb7185";
    ctx.fillRect(38, 37, Math.max(0, (rounded / 100) * 180), 9);

    this.labelTexture.needsUpdate = true;
  }

  public updateTransformAndAnim(params: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    pitch: number;
    stance: PlayerStance;
    moveSpeed: number;
    hp: number;
    dt: number;
    showNameplate?: boolean;
  }) {
    const { x, y, z, rotY, pitch, stance, moveSpeed, hp, dt } = params;

    this.root.visible = hp > 0;
    if (hp <= 0) return;

    this.root.position.set(x, y, z);
    this.root.rotation.y = rotY;

    // Flash & Recoil decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.muzzleFlash.visible = false;
    }
    this.recoilKick = THREE.MathUtils.lerp(this.recoilKick, 0, 18 * dt);

    // Stance Posture Interpolation
    let targetPostureY = 0;
    let targetPostureRotX = 0;
    let targetPostureZ = 0;

    if (stance === PlayerStance.Crouch) {
      targetPostureY = -0.36;
      targetPostureRotX = -0.14;
    } else if (stance === PlayerStance.Prone) {
      targetPostureY = -0.64;
      targetPostureRotX = -Math.PI * 0.46; // Lies flat forward along ground!
      targetPostureZ = 0.55;
    }

    this.posturePivot.position.y = THREE.MathUtils.lerp(
      this.posturePivot.position.y,
      targetPostureY,
      14 * dt
    );
    this.posturePivot.position.z = THREE.MathUtils.lerp(
      this.posturePivot.position.z,
      targetPostureZ,
      14 * dt
    );
    this.posturePivot.rotation.x = THREE.MathUtils.lerp(
      this.posturePivot.rotation.x,
      targetPostureRotX,
      14 * dt
    );

    // Aim Pitch on Weapon & Head
    const clampedPitch = THREE.MathUtils.clamp(pitch, -0.85, 0.85);
    if (stance === PlayerStance.Prone) {
      this.headGroup.rotation.x = 1.15 + clampedPitch * 0.4;
      this.weaponRig.rotation.x = 1.2 + clampedPitch * 0.5 + this.recoilKick;
    } else {
      this.headGroup.rotation.x = clampedPitch * 0.55;
      this.weaponRig.rotation.x = clampedPitch * 0.85 + this.recoilKick;
    }
    this.weaponRig.position.z = -0.12 + this.recoilKick * 0.35;

    // Walk / Sprint Leg Cycle
    if (moveSpeed > 0.35 && stance !== PlayerStance.Prone) {
      this.walkPhase += dt * (2.6 + moveSpeed * 1.15);
      const amp = stance === PlayerStance.Crouch ? 0.38 : Math.min(0.82, 0.25 + moveSpeed * 0.065);
      this.leftLeg.rotation.x = Math.sin(this.walkPhase) * amp;
      this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * amp;
    } else {
      const restBend = stance === PlayerStance.Crouch ? 0.52 : 0;
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, restBend, 12 * dt);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(
        this.rightLeg.rotation.x,
        -restBend * 0.5,
        12 * dt
      );
    }

    if (this.labelSprite) {
      this.labelSprite.visible = params.showNameplate ?? true;
      this.labelSprite.position.y =
        stance === PlayerStance.Prone ? 0.95 : stance === PlayerStance.Crouch ? 1.55 : 2.05;
      this.redrawNameplate(hp);
    }
  }
}
