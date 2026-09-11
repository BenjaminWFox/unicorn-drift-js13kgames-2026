let ctx: AudioContext | undefined;
let gain: GainNode;
let filter: BiquadFilterNode;
let oscA: OscillatorNode;
let oscB: OscillatorNode;
let slideGain: GainNode;
let slideFilt: BiquadFilterNode;
let slideOsc: OscillatorNode;
let lastSp = 0;
let beepAt = 4;

export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    const mix = ctx.createGain();
    mix.gain.value = 0.18;
    oscA.connect(filter);
    oscB.connect(mix);
    mix.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    oscA.start();
    oscB.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate >> 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    slideFilt = ctx.createBiquadFilter();
    slideFilt.type = 'bandpass';
    slideFilt.Q.value = 1.1;
    slideGain = ctx.createGain();
    slideGain.gain.value = 0;
    slideOsc = ctx.createOscillator();
    slideOsc.type = 'sawtooth';
    const slideMix = ctx.createGain();
    slideMix.gain.value = 0.22;
    src.connect(slideFilt);
    slideOsc.connect(slideMix);
    slideMix.connect(slideFilt);
    slideFilt.connect(slideGain);
    slideGain.connect(ctx.destination);
    src.start();
    slideOsc.start();
  }
  if (ctx.state !== 'running') {
    ctx.resume();
  }
}

export function armCountdown(): void {
  beepAt = 4;
}

function blip(hz: number, dur: number, vol: number): void {
  if (!ctx) {
    return;
  }
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = hz;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export function updateAudio(
  dt: number,
  speed: number,
  gas: number,
  on: number,
  count: number,
  charge: number
): void {
  if (!ctx) {
    return;
  }
  const t = ctx.currentTime;
  const sp = Math.abs(speed);
  const acc = (sp - lastSp) / Math.max(dt, 0.001);
  lastSp = sp;
  const load = on ? Math.max(0, acc * 0.045, gas ? 0.55 : 0) : 0;
  const hz = 62 + sp * 3.6 + load * 38;
  oscA.frequency.setTargetAtTime(hz, t, 0.05);
  oscB.frequency.setTargetAtTime(hz * 2.005, t, 0.05);
  filter.frequency.setTargetAtTime(240 + sp * 22 + load * 420, t, 0.07);
  gain.gain.setTargetAtTime(on ? Math.min(0.13, 0.016 + sp * 0.0022 + load * 0.05) : 0, t, 0.07);

  const step = count > 0.15 ? Math.ceil(count) : 0;
  if (on && step < beepAt) {
    beepAt = step;
    blip(step ? 740 : 1175, step ? 0.1 : 0.32, 0.12);
  }

  const whoosh = on && charge > 0.02 ? charge : 0;
  slideFilt.frequency.setTargetAtTime(280 + whoosh * 2400, t, 0.09);
  slideOsc.frequency.setTargetAtTime(160 + whoosh * 720, t, 0.1);
  slideGain.gain.setTargetAtTime(whoosh ? 0.018 + whoosh * 0.08 : 0, t, 0.08);
}
