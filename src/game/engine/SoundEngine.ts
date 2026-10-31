import { WeaponId } from "../types";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureCtx();
  }

  public playGunshot(weaponId: WeaponId, distance = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const atten = Math.max(0.06, 1 - distance / 180);
    const now = ctx.currentTime;

    const isSniper = weaponId === "KAR98K" || weaponId === "AWM";
    const isHeavy = weaponId === "AKM";
    const isSmg = weaponId === "UMP45";

    const duration = isSniper ? 0.48 : isHeavy ? 0.24 : 0.18;

    // White noise burst for gunpowder crack
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, isSniper ? 1.8 : 3.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(
      isSniper ? 950 : isHeavy ? 1100 : isSmg ? 1650 : 1400,
      now
    );
    filter.Q.setValueAtTime(0.75, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime((isSniper ? 0.55 : 0.36) * atten, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Low-end punch oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = isSniper ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(isSniper ? 145 : isHeavy ? 165 : 195, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + (isSniper ? 0.22 : 0.11));

    oscGain.gain.setValueAtTime((isSniper ? 0.5 : 0.32) * atten, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + (isSniper ? 0.24 : 0.12));

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isSniper ? 0.25 : 0.13));
  }

  public playHitmarker(headshot = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = headshot ? "square" : "triangle";
    osc.frequency.setValueAtTime(headshot ? 1950 : 1250, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 980 : 600, now + 0.065);

    gain.gain.setValueAtTime(headshot ? 0.24 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playReload() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.28].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 840, now + offset);
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  }

  public playScope(zoomIn: boolean) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(zoomIn ? 620 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(zoomIn ? 940 : 540, now + 0.06);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playPickup() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.12, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.1);
    });
  }

  public playHealComplete() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.11, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.15);
    });
  }

  public playFootstep() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.045);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}
