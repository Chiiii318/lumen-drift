// Synthesized sound effects with the Web Audio API — no audio files, so the game stays fully
// offline. Everything is a short oscillator blip or a filtered noise puff, created on the fly.
// Sound starts only after the player's first gesture (browser autoplay rules) and M mutes it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freqFrom, freqTo, seconds, type = 'sine', volume = 0.5, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function puff(seconds = 0.25, volume = 0.3) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    unlock: ensure,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    pickup() {
      tone(880, 1320, 0.12, 'sine', 0.35);
    },
    banish() {
      tone(520, 1040, 0.22, 'triangle', 0.4);
      tone(780, 1560, 0.3, 'sine', 0.25, 0.05);
    },
    hurt() {
      tone(160, 60, 0.28, 'sawtooth', 0.35);
      puff(0.2, 0.25);
    },
    wave() {
      tone(392, 392, 0.16, 'triangle', 0.3);
      tone(523, 523, 0.22, 'triangle', 0.3, 0.14);
    },
    dawn() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.35, 'triangle', 0.3, i * 0.12));
    },
    over() {
      [440, 349, 262].forEach((f, i) => tone(f, f * 0.98, 0.4, 'sine', 0.3, i * 0.18));
    },
    click() {
      tone(660, 660, 0.06, 'square', 0.15);
    },
  };
}
