// Generative background music v2 — upbeat game loop, synthesized live.
// I–V–vi–IV progression (the eternally cheerful one), bouncing octave
// bass, square-wave arpeggio lead, kick + offbeat hats. 132 BPM.

const BPM = 132;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;

// C major: C — G — Am — F. [bass root, chord tones (lead pool)]
const PROGRESSION: Array<{ root: number; tones: number[] }> = [
  { root: 65.41, tones: [261.63, 329.63, 392.0, 523.25] }, // C
  { root: 98.0, tones: [246.94, 293.66, 392.0, 493.88] }, // G
  { root: 110.0, tones: [220.0, 261.63, 329.63, 440.0] }, // Am
  { root: 87.31, tones: [220.0, 261.63, 349.23, 440.0] }, // F
];
// Per-bar arpeggio shape over the chord-tone pool (8 eighths per bar).
const ARP = [0, 2, 1, 3, 0, 2, 3, 1];

export interface Music {
  setMuted(m: boolean): void;
  dispose(): void;
}

export function startMusic(): Music {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.15;
  master.connect(ctx.destination);

  // Shared noise buffer for the hats.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  let disposed = false;
  let eighth = 0;

  const tone = (
    type: OscillatorType,
    freq: number,
    t: number,
    vol: number,
    decay: number,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  };

  const kick = (t: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.2);
  };

  const hat = (t: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp).connect(gain).connect(master);
    src.start(t);
  };

  let nextTime = ctx.currentTime + 0.1;
  const tick = setInterval(() => {
    if (disposed) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const t = nextTime;
      const bar = Math.floor(eighth / 8) % PROGRESSION.length;
      const pos = eighth % 8; // eighth within the bar
      const chord = PROGRESSION[bar];

      // Bouncing bass: root octaves on every eighth.
      tone("triangle", pos % 2 === 0 ? chord.root : chord.root * 2, t, 0.5, 0.16);
      // Lead arpeggio, one octave up, occasional sparkle skip.
      if (Math.random() > 0.12) {
        tone("square", chord.tones[ARP[pos]] * 2, t, 0.12, 0.17);
      }
      // Kick on beats 1 & 3, hats on the offbeats.
      if (pos === 0 || pos === 4) kick(t);
      if (pos % 2 === 1) hat(t);

      eighth++;
      nextTime += EIGHTH;
    }
  }, 100);

  return {
    setMuted(m: boolean) {
      master.gain.linearRampToValueAtTime(m ? 0 : 0.15, ctx.currentTime + 0.3);
    },
    dispose() {
      disposed = true;
      clearInterval(tick);
      void ctx.close();
    },
  };
}
