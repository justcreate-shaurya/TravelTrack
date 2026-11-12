/**
 * The intro film's soundtrack, synthesised live with the Web Audio API: no audio files.
 * Everything is scheduled up front on the AudioContext clock when the film starts, and the
 * film reads the same clock (`elapsed()`) to pick its scene, so picture and sound stay locked.
 *
 * 120 BPM: one beat = 0.5s, one bar = 2s.
 */

export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

export type Fx = "whoosh" | "pop" | "impact" | "riser" | "chime" | "tick" | "cash" | "slam";
export interface Cue {
  /** Seconds from the start of the film. */
  t: number;
  fx: Fx;
  /** Pitch multiplier for pops/ticks, or duration for whoosh/riser. */
  arg?: number;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Bouncy pop progression, one chord per bar: C, G, Am, F.
const CHORDS: { root: number; pad: number[] }[] = [
  { root: 36, pad: [60, 64, 67, 72] },
  { root: 43, pad: [59, 62, 67, 71] },
  { root: 45, pad: [60, 64, 69, 72] },
  { root: 41, pad: [60, 65, 69, 72] },
];

export class FilmAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private music: GainNode;
  private sfx: GainNode;
  private noise: AudioBuffer;
  private t0 = 0;
  private muted = false;

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(this.ctx.destination);
    this.music = this.gain(0.55, this.master);
    this.sfx = this.gain(0.85, this.master);

    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Must be called from a user gesture (the Play button) or the browser keeps the audio blocked. */
  async start(totalBars: number, cues: Cue[], song: SongPlan) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.t0 = this.ctx.currentTime + 0.12;
    this.scheduleSong(totalBars, song);
    for (const c of cues) this.fx(c.fx, this.t0 + c.t, c.arg);
  }

  /**
   * Plays a music file instead of the synthesised song, with the sound effects layered on top.
   * The visuals read `elapsed()`, which only starts counting once the file is decoded, so the
   * picture waits for the music rather than drifting ahead of it.
   */
  async startTrack(data: ArrayBuffer, cues: Cue[], opt: { offset: number; duration: number; fadeFrom: number }) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const buffer = await this.ctx.decodeAudioData(data.slice(0)); // slice: decoding detaches the buffer, keep it for replays
    this.t0 = this.ctx.currentTime + 0.12;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const level = 0.72; // the file is mastered hot; leave room for the effects
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(level, this.t0);
    g.gain.setValueAtTime(level, this.t0 + opt.fadeFrom);
    g.gain.linearRampToValueAtTime(0.0001, this.t0 + opt.duration);
    src.connect(g).connect(this.master);
    src.start(this.t0, opt.offset, opt.duration + 0.2);
    this.sfx.gain.value = 0.45; // the track carries the energy; effects are accents
    for (const c of cues) this.fx(c.fx, this.t0 + c.t, c.arg);
  }

  /** Seconds since the film started, on the audio clock. */
  elapsed(): number {
    return Math.max(0, this.ctx.currentTime - this.t0);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.03);
  }

  isMuted() {
    return this.muted;
  }

  close() {
    void this.ctx.close().catch(() => {});
  }

  // ---------------------------------------------------------------- song

  private scheduleSong(totalBars: number, song: SongPlan) {
    for (let bar = 0; bar < totalBars; bar++) {
      const t = this.t0 + bar * BAR;
      const chord = CHORDS[bar % CHORDS.length]!;
      const isFinal = bar === song.finalBar;
      if (bar <= song.finalBar) {
        this.pad(t, isFinal ? [48, 55, 60, 64, 67, 72] : chord.pad, isFinal ? BAR * (totalBars - bar) : BAR, isFinal ? 0.085 : 0.05);
      }
      const drums = bar >= song.drumsFrom && bar < song.drumsUntil;
      if (drums) {
        for (let b = 0; b < 4; b++) {
          const bt = t + b * BEAT;
          this.kick(bt, 0.95);
          if (b === 1 || b === 3) this.clap(bt);
          this.hat(bt + BEAT / 2, 0.16);
          if (bar >= song.busyFrom) this.hat(bt + BEAT / 4, 0.07);
        }
        // Bouncy bass: root on the beat, octave on the off-beat.
        for (let e = 0; e < 8; e++) {
          const note = chord.root + (e % 2 === 1 ? 12 : 0);
          this.bass(t + e * (BEAT / 2), note, BEAT / 2 - 0.03);
        }
        if (bar >= song.busyFrom) {
          // A plucky arpeggio on top for the busier middle section.
          const arp = [chord.pad[0]! + 12, chord.pad[1]! + 12, chord.pad[2]! + 12, chord.pad[1]! + 12];
          for (let s = 0; s < 8; s++) this.pluck(t + s * (BEAT / 2), arp[s % 4]!);
        }
      }
    }
    // The outro: one bar of kicks between the title hit and the logo hit.
    for (let b = 0; b < 4; b++) this.kick(this.t0 + song.titleBar * BAR + b * BEAT, 0.8);
  }

  // ---------------------------------------------------------------- instruments

  private gain(value: number, to: AudioNode) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(to);
    return g;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseSource(t: number, dur: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  private kick(t: number, level: number) {
    const o = this.ctx.createOscillator();
    const g = this.gain(0, this.music);
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    this.env(g, t, level, 0.004, 0.32);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.4);
  }

  private clap(t: number) {
    const src = this.noiseSource(t, 0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1600;
    f.Q.value = 0.8;
    const g = this.gain(0, this.music);
    this.env(g, t, 0.55, 0.003, 0.16);
    src.connect(f).connect(g);
  }

  private hat(t: number, level: number) {
    const src = this.noiseSource(t, 0.06);
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7500;
    const g = this.gain(0, this.music);
    this.env(g, t, level, 0.002, 0.045);
    src.connect(f).connect(g);
  }

  private bass(t: number, midi: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = mtof(midi);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = this.gain(0, this.music);
    this.env(g, t, 0.32, 0.006, dur);
    o.connect(f).connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(t: number, notes: number[], dur: number, level: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1900;
    const g = this.gain(0, this.music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.18);
    g.gain.setValueAtTime(level, t + Math.max(0.2, dur - 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    f.connect(g);
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = mtof(n);
        o.detune.value = detune;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.3);
      }
    }
  }

  private pluck(t: number, midi: number) {
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = mtof(midi);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    const g = this.gain(0, this.music);
    this.env(g, t, 0.07, 0.003, 0.22);
    o.connect(f).connect(g);
    o.start(t);
    o.stop(t + 0.3);
  }

  // ---------------------------------------------------------------- sound effects

  private fx(kind: Fx, t: number, arg?: number) {
    switch (kind) {
      case "whoosh":
        return this.whoosh(t, arg ?? 0.6);
      case "pop":
        return this.pop(t, arg ?? 1);
      case "impact":
        return this.impact(t, 1);
      case "slam":
        return this.impact(t, 0.55);
      case "riser":
        return this.riser(t, arg ?? 2);
      case "chime":
        return this.chime(t);
      case "tick":
        return this.tick(t, arg ?? 1);
      case "cash":
        return this.cash(t);
    }
  }

  private whoosh(t: number, dur: number) {
    const src = this.noiseSource(t, dur);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = this.gain(0, this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
  }

  private pop(t: number, pitch: number) {
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(520 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(1250 * pitch, t + 0.05);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.42, 0.004, 0.11);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.18);
  }

  private impact(t: number, level: number) {
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 1.1 * level, 0.005, 0.9);
    o.connect(g);
    o.start(t);
    o.stop(t + 1);

    const src = this.noiseSource(t, 0.9);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.8);
    const ng = this.gain(0, this.sfx);
    this.env(ng, t, 0.5 * level, 0.003, 0.7);
    src.connect(f).connect(ng);
  }

  private riser(t: number, dur: number) {
    const src = this.noiseSource(t, dur);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = this.gain(0, this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    src.connect(f).connect(g);

    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const of = this.ctx.createBiquadFilter();
    of.type = "lowpass";
    of.frequency.value = 2400;
    const og = this.gain(0, this.sfx);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.08, t + dur * 0.95);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(of).connect(og);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private chime(t: number) {
    [
      [88, 0],
      [95, 0.07],
      [100, 0.14],
    ].forEach(([midi, d]) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = mtof(midi!);
      const g = this.gain(0, this.sfx);
      this.env(g, t + d!, 0.22, 0.004, 0.7);
      o.connect(g);
      o.start(t + d!);
      o.stop(t + d! + 0.8);
    });
  }

  private tick(t: number, pitch: number) {
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 1700 * pitch;
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.08, 0.001, 0.025);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.05);
  }

  private cash(t: number) {
    this.tick(t, 1.4);
    [
      [96, 0.06],
      [100, 0.12],
      [103, 0.18],
    ].forEach(([midi, d]) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = mtof(midi!);
      const g = this.gain(0, this.sfx);
      this.env(g, t + d!, 0.26, 0.003, 0.5);
      o.connect(g);
      o.start(t + d!);
      o.stop(t + d! + 0.6);
    });
  }
}

/** Where the song's sections fall, in bars (one bar = 2s). */
export interface SongPlan {
  drumsFrom: number;
  drumsUntil: number;
  busyFrom: number;
  /** Bar of the title hit in the outro (a bar of kicks follows it). */
  titleBar: number;
  /** Bar of the final logo hit; the big chord rings out from here to the end. */
  finalBar: number;
}
