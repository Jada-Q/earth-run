// Generative background music — a cozy pentatonic travel loop, synthesized
// live with WebAudio (everything else in this game is procedural; so is
// the soundtrack). Plucked triangle-wave melody on a random walk, a soft
// sine bass on the downbeats, never repeats, always consonant.

const BPM = 88;
const BEAT = 60 / BPM;
// C major pentatonic across two octaves — every note agrees with every
// other, so a random walk always sounds intentional.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export interface Music {
  setMuted(m: boolean): void;
  dispose(): void;
}

export function startMusic(): Music {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  let step = 0;
  let melodyIdx = 3;
  let disposed = false;

  const pluck = (freq: number, t: number, vol: number, decay: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  };

  // Look-ahead scheduler: queue the next half-beat's notes ~200ms early.
  let nextNoteTime = ctx.currentTime + 0.1;
  const tick = setInterval(() => {
    if (disposed) return;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const t = nextNoteTime;
      // Melody on half-beats, ~28% rests for breathing room.
      if (Math.random() > 0.28) {
        const moves = [-2, -1, -1, 1, 1, 2];
        melodyIdx = Math.max(
          0,
          Math.min(
            SCALE.length - 1,
            melodyIdx + moves[Math.floor(Math.random() * moves.length)],
          ),
        );
        pluck(SCALE[melodyIdx], t, 0.5, BEAT * 1.6);
      }
      // Bass root/fifth on every other downbeat.
      if (step % 4 === 0) {
        pluck(step % 8 === 0 ? 130.81 : 98.0, t, 0.55, BEAT * 3.2);
      }
      step++;
      nextNoteTime += BEAT / 2;
    }
  }, 120);

  return {
    setMuted(m: boolean) {
      master.gain.linearRampToValueAtTime(
        m ? 0 : 0.16,
        ctx.currentTime + 0.3,
      );
    },
    dispose() {
      disposed = true;
      clearInterval(tick);
      void ctx.close();
    },
  };
}
