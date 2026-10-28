'use strict';
// Synthesized sound effects + adaptive procedural music. No audio files.
(function () {
  const U = XH.U;
  const A = XH.audio = { ready: false, announcer: true, hiveOn: true };
  let ctx, master, sfxBus, musicBus, revIn, noiseBuf, distCurve, ambBus, weatherBus;
  let LA = 0.02; // scheduling lookahead: at least one audio buffer, so nothing is ever scheduled in the past (that clicks)
  A.vol = { master: 0.8, music: 0.55, sfx: 0.85, weather: 1 };
  A.listener = { x: 0, z: 0, yaw: 0 };

  A.init = function () {
    if (XH.MUTE) return; // debug/test sessions (?debug or ?mute) are always silent
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // 'balanced' latency gives the audio thread bigger buffers, which stops dropouts (crackle) when many sounds overlap
    try { ctx = A.ctx = new AC({ latencyHint: 'balanced' }); } catch (e) { ctx = A.ctx = new AC(); }
    LA = Math.max(0.02, (ctx.baseLatency || 0.01) * 2);
    // master chain: glue compressor -> brickwall-ish limiter -> soft clipper, so a pile-up of sounds never hard-clips
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.18;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    // soft clipper: transparent up to 0.8, then a smooth knee that reaches 1.0 at an input of 2.0. The curve covers
    // +-2 (the pre-gain halves the signal) because a waveshaper hard-clips anything outside its curve.
    const pre = ctx.createGain(); pre.gain.value = 0.5;
    const clip = ctx.createWaveShaper(), cc = new Float32Array(4097);
    for (let i = 0; i < cc.length; i++) { const x = ((i / (cc.length - 1)) * 2 - 1) * 2, a = Math.abs(x); cc[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
    clip.curve = cc; clip.oversample = '2x';
    const outG = ctx.createGain(); outG.gain.value = 0.92;
    comp.connect(lim); lim.connect(pre); pre.connect(clip); clip.connect(outG); outG.connect(ctx.destination);
    master = ctx.createGain(); master.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    const conv = ctx.createConvolver(); conv.buffer = impulse(3, 2.4);
    const rg = ctx.createGain(); rg.gain.value = 0.32; conv.connect(rg); rg.connect(master);
    revIn = conv;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    distCurve = makeCurve(50);
    ambBus = ctx.createGain(); ambBus.connect(sfxBus);
    weatherBus = ctx.createGain(); weatherBus.connect(ambBus); // the map's rain, wind or ember bed, with its own volume setting
    A.nodes = { comp, lim, clip, outG, master, sfxBus, musicBus, ambBus, weatherBus, conv, rg }; // exposed for the audio self-test
    A.ready = true;
    A.applyVolume();
    Music.init();
    if (AMB.want) A.ambience(AMB.want);
  };
  function impulse(dur, decay) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  // odd length and x spanning exactly -1..1, so silence maps to exactly 0 (an even curve leaves a DC offset,
  // which clicks when the node switches off)
  function makeCurve(k) {
    const n = 1025, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; c[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); }
    return c;
  }
  A.applyVolume = () => {
    if (!ctx) return;
    master.gain.value = A.vol.master;
    musicBus.gain.value = A.vol.music * 0.55;
    sfxBus.gain.value = A.vol.sfx;
    weatherBus.gain.value = A.vol.weather;
  };

  // ---------- building blocks ----------
  function out(o) {
    const g = ctx.createGain(); g.gain.value = o.vol === undefined ? 1 : o.vol;
    let node = g;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = U.clamp(o.pan, -1, 1); g.connect(p); node = p; }
    node.connect(o.dest || sfxBus);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; node.connect(s); s.connect(revIn); }
    return g;
  }
  function tone(o) {
    const t = o.t === undefined ? ctx.currentTime : o.t, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.a === undefined ? 0.003 : o.a;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.3 : o.vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, o.dur));
    osc.connect(g);
    let last = g;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1000; f.Q.value = o.q || 1; g.connect(f); last = f; }
    last.connect(o.out);
    osc.start(t); osc.stop(t + o.dur + 0.05);
    return osc;
  }
  function noise(o) {
    const t = o.t === undefined ? ctx.currentTime : o.t, src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q === undefined ? 1 : o.q;
    const g = ctx.createGain(), a = o.a === undefined ? 0.002 : o.a;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.3 : o.vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, o.dur));
    src.connect(f); f.connect(g); g.connect(o.out);
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  }
  const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function spatial(o) {
    if (o.pos) {
      const dx = o.pos.x - A.listener.x, dz = o.pos.z - A.listener.z, d = Math.hypot(dx, dz);
      const vol = 1 / (1 + d * d * 0.0035 + d * 0.03);
      const rx = Math.cos(A.listener.yaw), rz = -Math.sin(A.listener.yaw);
      const pan = d > 0.5 ? (dx * rx + dz * rz) / d : 0;
      return { vol: vol * (o.vol === undefined ? 1 : o.vol), pan: pan * 0.8 };
    }
    return { vol: o.vol === undefined ? 1 : o.vol, pan: o.pan || 0 };
  }

  // ---------- SFX library ----------
  const S = {};
  S.pistol = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.15 }); noise({ t, dur: 0.12, vol: 0.6, f: 2200, q: 0.7, out: o }); tone({ t, f: 190, f2: 45, dur: 0.14, vol: 0.7, out: o }); noise({ t, dur: 0.35, vol: 0.14, type: 'lowpass', f: 900, out: o, a: 0.01 }); };
  S.magnum = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.35 }); noise({ t, dur: 0.18, vol: 0.9, f: 1600, q: 0.6, out: o }); tone({ t, f: 120, f2: 30, dur: 0.35, vol: 1, out: o }); noise({ t, dur: 0.7, vol: 0.25, type: 'lowpass', f: 700, f2: 120, out: o, a: 0.01 }); };
  S.smg = (t, v, p) => { const o = out({ vol: v * 0.8, pan: p, rev: 0.1 }); noise({ t, dur: 0.08, vol: 0.6, f: 2600, q: 0.8, out: o }); tone({ t, f: 160, f2: 50, dur: 0.09, vol: 0.5, out: o }); };
  S.rifle = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.15 }); noise({ t, dur: 0.13, vol: 0.7, f: 1500, q: 0.6, out: o }); tone({ t, type: 'triangle', f: 130, f2: 40, dur: 0.15, vol: 0.7, out: o }); tone({ t, type: 'sawtooth', f: 1400, f2: 300, dur: 0.05, vol: 0.08, out: o }); };
  S.burst = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.2 }); noise({ t, dur: 0.15, vol: 0.7, f: 1200, q: 0.6, out: o }); tone({ t, type: 'triangle', f: 150, f2: 35, dur: 0.18, vol: 0.8, out: o }); tone({ t, type: 'square', f: 2200, f2: 500, dur: 0.06, vol: 0.06, out: o }); };
  S.shotgun = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.25 }); noise({ t, dur: 0.45, vol: 0.9, type: 'lowpass', f: 2600, f2: 250, out: o }); tone({ t, f: 95, f2: 28, dur: 0.4, vol: 0.9, out: o }); noise({ t: t + 0.3, dur: 0.05, vol: 0.18, f: 1300, q: 3, out: o }); noise({ t: t + 0.42, dur: 0.06, vol: 0.18, f: 900, q: 3, out: o }); };
  S.rail = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.45 }); tone({ t, type: 'sawtooth', f: 3200, f2: 150, dur: 0.35, vol: 0.22, out: o }); noise({ t, dur: 0.08, vol: 0.8, f: 4000, q: 0.5, out: o }); tone({ t, f: 70, f2: 25, dur: 0.7, vol: 0.9, out: o }); noise({ t, dur: 1.1, vol: 0.2, type: 'lowpass', f: 600, f2: 100, a: 0.02, out: o }); tone({ t: t + 0.35, f: 400, f2: 1800, dur: 0.8, vol: 0.05, a: 0.3, out: o }); };
  S.minigun = (t, v, p) => { const o = out({ vol: v * 0.65, pan: p }); noise({ t, dur: 0.06, vol: 0.6, f: 1800, q: 0.8, out: o }); tone({ t, f: 140, f2: 60, dur: 0.06, vol: 0.5, out: o }); };
  S.plasma = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.3 }); tone({ t, f: 1400, f2: 180, dur: 0.28, vol: 0.4, out: o }); tone({ t, type: 'square', f: 700, f2: 90, dur: 0.18, vol: 0.1, out: o }); noise({ t, dur: 0.06, vol: 0.3, type: 'highpass', f: 3000, out: o }); };
  S.launcher = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.2 }); tone({ t, f: 220, f2: 55, dur: 0.25, vol: 0.8, out: o }); noise({ t, dur: 0.2, vol: 0.4, type: 'lowpass', f: 700, out: o }); };
  S.arc = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.2 }); for (let i = 0; i < 7; i++) tone({ t: t + i * 0.025, type: 'square', f: U.rand(80, 1800), dur: 0.04, vol: 0.16, out: o }); tone({ t, type: 'sawtooth', f: 3200, f2: 400, dur: 0.25, vol: 0.1, out: o }); noise({ t, dur: 0.2, vol: 0.3, f: 5000, q: 0.5, out: o }); };
  S.cryo = (t, v, p) => { const o = out({ vol: v * 0.8, pan: p, rev: 0.3 }); noise({ t, dur: 0.18, vol: 0.4, type: 'highpass', f: 5000, out: o }); tone({ t, f: 2200, f2: 3000, dur: 0.15, vol: 0.08, out: o }); tone({ t, type: 'triangle', f: 600, f2: 300, dur: 0.1, vol: 0.2, out: o }); };
  S.void = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.6 }); tone({ t, type: 'sawtooth', f: 500, f2: 30, dur: 0.9, vol: 0.3, out: o, filter: 'lowpass', ff: 1200 }); tone({ t, f: 60, f2: 25, dur: 1.2, vol: 0.8, out: o }); tone({ t, f: 2000, f2: 100, dur: 0.5, vol: 0.12, out: o }); };
  S.singularity = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.7 }); tone({ t, f: 40, f2: 90, dur: 3.5, vol: 0.7, a: 0.3, out: o }); tone({ t, type: 'sawtooth', f: 80, f2: 400, dur: 3.5, vol: 0.12, a: 0.5, out: o, filter: 'lowpass', ff: 900 }); noise({ t, dur: 3.5, vol: 0.3, type: 'bandpass', f: 200, f2: 3000, q: 2, a: 0.5, out: o }); };
  S.empty = (t, v) => { const o = out({ vol: v * 0.5 }); tone({ t, type: 'square', f: 1400, dur: 0.03, vol: 0.3, out: o }); tone({ t: t + 0.05, type: 'square', f: 900, dur: 0.02, vol: 0.2, out: o }); };
  S.magout = (t, v) => { const o = out({ vol: v * 0.6 }); noise({ t, dur: 0.07, vol: 0.4, f: 700, q: 2, out: o }); tone({ t, type: 'square', f: 320, dur: 0.03, vol: 0.12, out: o }); };
  S.magin = (t, v) => { const o = out({ vol: v * 0.6 }); tone({ t, type: 'square', f: 900, dur: 0.02, vol: 0.2, out: o }); noise({ t: t + 0.02, dur: 0.06, vol: 0.5, f: 1400, q: 2, out: o }); };
  S.chamber = (t, v) => { const o = out({ vol: v * 0.6 }); noise({ t, dur: 0.05, vol: 0.5, f: 2200, q: 3, out: o }); noise({ t: t + 0.09, dur: 0.05, vol: 0.5, f: 1600, q: 3, out: o }); };
  S.shell = (t, v) => { const o = out({ vol: v * 0.5 }); noise({ t, dur: 0.05, vol: 0.5, f: 1100, q: 4, out: o }); };
  S.charge = (t, v) => { const o = out({ vol: v * 0.5 }); tone({ t, type: 'sawtooth', f: 200, f2: 1600, dur: 0.6, vol: 0.12, out: o, filter: 'lowpass', ff: 2500 }); };
  S.hit = (t, v) => { const o = out({ vol: v * 0.55 }); tone({ t, f: 1900, dur: 0.035, vol: 0.28, out: o }); noise({ t, dur: 0.05, vol: 0.2, type: 'lowpass', f: 700, out: o }); };
  S.head = (t, v) => { const o = out({ vol: v * 0.65 }); tone({ t, type: 'triangle', f: 2600, dur: 0.12, vol: 0.35, out: o }); tone({ t, f: 3900, dur: 0.08, vol: 0.1, out: o }); };
  S.armor = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p }); tone({ t, type: 'square', f: 1100, f2: 800, dur: 0.06, vol: 0.15, out: o }); noise({ t, dur: 0.05, vol: 0.3, f: 3500, q: 3, out: o }); };
  S.kill = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.1 }); noise({ t, dur: 0.3, vol: 0.5, type: 'lowpass', f: 900, f2: 150, out: o }); tone({ t, type: 'sawtooth', f: 260, f2: 60, dur: 0.2, vol: 0.15, out: o, filter: 'lowpass', ff: 800 }); };
  S.gib = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.2 }); noise({ t, dur: 0.5, vol: 0.8, type: 'lowpass', f: 1400, f2: 120, out: o }); for (let i = 0; i < 4; i++) noise({ t: t + 0.1 + i * 0.07, dur: 0.08, vol: 0.3, type: 'lowpass', f: 500, out: o }); };
  S.splat = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p }); noise({ t, dur: 0.15, vol: 0.5, type: 'lowpass', f: 800, f2: 200, out: o }); };
  S.explosion = (t, v, p, x) => { const s = x.size || 1, o = out({ vol: v, pan: p, rev: 0.5 }); noise({ t, dur: 1.4 * s, vol: 1, type: 'lowpass', f: 1800, f2: 70, out: o }); tone({ t, f: 90, f2: 22, dur: 1 * s, vol: 1, out: o }); noise({ t, dur: 0.12, vol: 0.6, f: 3000, q: 0.4, out: o }); };
  S.acidburst = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.3 }); noise({ t, dur: 0.6, vol: 0.9, type: 'lowpass', f: 1200, f2: 150, out: o }); tone({ t, f: 140, f2: 40, dur: 0.4, vol: 0.7, out: o }); noise({ t: t + 0.1, dur: 1.2, vol: 0.25, type: 'highpass', f: 3500, a: 0.1, out: o }); };
  S.hurt = (t, v) => { const o = out({ vol: v }); tone({ t, type: 'sawtooth', f: 220, f2: 70, dur: 0.22, vol: 0.22, out: o, filter: 'lowpass', ff: 900 }); noise({ t, dur: 0.15, vol: 0.3, type: 'lowpass', f: 500, out: o }); };
  S.heart = (t, v) => { const o = out({ vol: v }); tone({ t, f: 62, f2: 40, dur: 0.14, vol: 0.8, out: o }); tone({ t: t + 0.2, f: 55, f2: 38, dur: 0.16, vol: 0.6, out: o }); };
  // footsteps: soft dull thunks with a faint surface layer
  S.step = (t, v, p, x) => {
    const o = out({ vol: v * 0.3, pan: p }), f = U.rand(62, 78);
    tone({ t, f: f * 1.8, f2: f, slide: 0.045, dur: 0.17, vol: 0.75, out: o, filter: 'lowpass', ff: 260 });
    noise({ t, dur: 0.06, vol: 0.22, type: 'lowpass', f: 300, out: o });
    if (x.surf === 'metal') tone({ t: t + 0.004, type: 'triangle', f: U.rand(135, 165), f2: 115, dur: 0.08, vol: 0.05, out: o });
    else if (x.surf === 'snow') noise({ t, dur: 0.11, vol: 0.07, type: 'bandpass', f: 1700, q: 1.2, out: o });
    else if (x.surf === 'creep') noise({ t, dur: 0.14, vol: 0.09, type: 'lowpass', f: 650, f2: 220, out: o });
  };
  S.land = (t, v) => { const o = out({ vol: v * 0.5 }); tone({ t, f: 120, f2: 42, slide: 0.07, dur: 0.3, vol: 0.9, out: o, filter: 'lowpass', ff: 300 }); noise({ t, dur: 0.12, vol: 0.35, type: 'lowpass', f: 260, out: o }); };
  S.uiHover = (t, v) => { const o = out({ vol: v * 0.35 }); tone({ t, type: 'triangle', f: 2100, dur: 0.03, vol: 0.12, out: o }); };
  S.lure = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p, rev: 0.2 }); tone({ t, type: 'square', f: 1760, dur: 0.07, vol: 0.18, out: o, filter: 'bandpass', ff: 1800, q: 3 }); tone({ t: t + 0.08, type: 'sawtooth', f: 600, f2: 1400, dur: 0.18, vol: 0.08, out: o }); };
  S.capsule = (t, v, p) => { const o = out({ vol: v * 0.8, pan: p, rev: 0.3 }); for (let i = 0; i < 6; i++) noise({ t: t + i * 0.16, dur: 0.08, vol: 0.4, f: 900 + i * 90, q: 5, out: o }); tone({ t: t + 1.1, type: 'sine', f: 300, f2: 900, dur: 0.12, vol: 0.4, out: o }); noise({ t: t + 1.2, dur: 0.1, vol: 0.4, type: 'lowpass', f: 1500, out: o }); [0, 4, 7, 12].forEach((sN, i) => tone({ t: t + 1.3 + i * 0.07, type: 'triangle', f: 660 * Math.pow(2, sN / 12), dur: 0.3, vol: 0.15, out: o })); };
  S.build = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.3 }); for (let i = 0; i < 7; i++) { tone({ t: t + i * 0.24, type: 'square', f: U.rand(700, 1200), f2: 400, dur: 0.06, vol: 0.12, out: o, filter: 'bandpass', ff: 2000, q: 4 }); noise({ t: t + i * 0.24, dur: 0.07, vol: 0.3, f: 3000, q: 2, out: o }); } };
  S.slat = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p }); tone({ t, type: 'square', f: 420, f2: 300, dur: 0.07, vol: 0.12, out: o, filter: 'bandpass', ff: 1200, q: 3 }); noise({ t, dur: 0.06, vol: 0.4, f: 1800, q: 2, out: o }); tone({ t: t + 0.04, f: 120, f2: 70, dur: 0.1, vol: 0.4, out: o }); };
  S.tear = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p }); noise({ t, dur: 0.18, vol: 0.5, f: 2400, f2: 900, q: 3, out: o }); tone({ t, type: 'sawtooth', f: 300, f2: 120, dur: 0.15, vol: 0.1, out: o, filter: 'lowpass', ff: 1500 }); };
  S.shieldHit = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.2 }); tone({ t, type: 'triangle', f: 380, f2: 300, dur: 0.25, vol: 0.4, out: o }); tone({ t, type: 'square', f: 1250, dur: 0.12, vol: 0.06, out: o }); noise({ t, dur: 0.08, vol: 0.4, f: 2500, q: 1, out: o }); };
  S.rankup = (t, v) => { const o = out({ vol: v, rev: 0.5 }); [0, 4, 7, 12, 16, 19].forEach((sN, i) => tone({ t: t + i * 0.09, type: 'triangle', f: 440 * Math.pow(2, sN / 12), dur: 0.6, vol: 0.2, out: o })); tone({ t, f: 110, f2: 55, dur: 0.8, vol: 0.5, out: o }); };
  S.aat = (t, v) => { const o = out({ vol: v * 0.7, rev: 0.3 }); tone({ t, type: 'sawtooth', f: 200, f2: 1600, slide: 0.15, dur: 0.3, vol: 0.12, out: o, filter: 'lowpass', ff: 3000 }); };
  S.uiClick = (t, v) => { const o = out({ vol: v * 0.5, rev: 0.15 }); tone({ t, f: 700, f2: 1400, slide: 0.05, dur: 0.09, vol: 0.2, out: o }); noise({ t, dur: 0.04, vol: 0.1, type: 'highpass', f: 4000, out: o }); };
  S.knife = (t, v) => { const o = out({ vol: v * 0.7 }); noise({ t, dur: 0.18, vol: 0.5, f: 3000, f2: 700, q: 2, out: o }); };
  S.knifeHit = (t, v) => { const o = out({ vol: v }); noise({ t, dur: 0.12, vol: 0.7, type: 'lowpass', f: 900, out: o }); tone({ t, f: 300, f2: 90, dur: 0.12, vol: 0.4, out: o }); };
  S.throw = (t, v) => { const o = out({ vol: v * 0.5 }); noise({ t, dur: 0.2, vol: 0.4, f: 1500, f2: 500, q: 1.5, out: o }); tone({ t, type: 'square', f: 2400, dur: 0.02, vol: 0.1, out: o }); };
  S.bounce = (t, v, p) => { const o = out({ vol: v * 0.4, pan: p }); tone({ t, type: 'triangle', f: 700, f2: 500, dur: 0.06, vol: 0.3, out: o }); };
  S.buy = (t, v) => { const o = out({ vol: v * 0.7, rev: 0.2 }); [660, 880, 1320].forEach((f, i) => tone({ t: t + i * 0.06, type: 'triangle', f, dur: 0.2, vol: 0.28, out: o })); noise({ t, dur: 0.1, vol: 0.15, f: 6000, q: 0.5, out: o }); };
  S.deny = (t, v) => { const o = out({ vol: v * 0.55 }); tone({ t, type: 'square', f: 140, dur: 0.28, vol: 0.2, out: o, filter: 'lowpass', ff: 900 }); tone({ t, type: 'square', f: 147, dur: 0.28, vol: 0.2, out: o, filter: 'lowpass', ff: 900 }); };
  S.door = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.4 }); tone({ t, type: 'sawtooth', f: 55, f2: 38, dur: 1.4, vol: 0.3, out: o, filter: 'lowpass', ff: 400 }); noise({ t, dur: 1.3, vol: 0.35, type: 'lowpass', f: 300, out: o, a: 0.1 }); noise({ t: t + 0.9, dur: 0.8, vol: 0.22, type: 'highpass', f: 2500, out: o, a: 0.05 }); tone({ t: t + 1.3, f: 80, f2: 40, dur: 0.3, vol: 0.8, out: o }); };
  S.membrane = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.3 }); for (let i = 0; i < 8; i++) noise({ t: t + i * 0.09, dur: 0.14, vol: 0.4, type: 'lowpass', f: U.rand(300, 900), out: o }); tone({ t, type: 'sawtooth', f: 120, f2: 50, dur: 1, vol: 0.12, out: o, filter: 'lowpass', ff: 500 }); };
  S.power = (t, v) => { const o = out({ vol: v, rev: 0.5 }); tone({ t, type: 'sawtooth', f: 30, f2: 120, dur: 2.5, slide: 2.2, vol: 0.28, a: 0.5, out: o, filter: 'lowpass', ff: 600 }); tone({ t, f: 60, f2: 240, dur: 2.5, slide: 2.2, vol: 0.28, a: 0.5, out: o }); tone({ t: t + 2.3, f: 80, f2: 35, dur: 0.6, vol: 0.9, out: o }); noise({ t: t + 2.3, dur: 0.4, vol: 0.4, type: 'lowpass', f: 800, out: o }); };
  S.box = (t, v, p) => {
    const o = out({ vol: v * 0.8, pan: p, rev: 0.5 });
    [76, 79, 83, 81, 79, 76, 74, 76, 79, 83, 86, 84, 83, 79, 81, 76].forEach((n, i) => {
      tone({ t: t + i * 0.24, type: 'triangle', f: mf(n), dur: 0.5, vol: 0.16, out: o });
      tone({ t: t + i * 0.24, f: mf(n + 12), dur: 0.3, vol: 0.04, out: o });
    });
  };
  S.boxLeave = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.5 }); S.roar(t, v * 0.7, p, {}); noise({ t: t + 0.8, dur: 1.5, vol: 0.4, f: 400, f2: 3000, q: 1, a: 0.5, out: o }); };
  S.perk = (t, v) => { const o = out({ vol: v, rev: 0.3 }); noise({ t, dur: 0.5, vol: 0.3, type: 'highpass', f: 2500, out: o, a: 0.05 }); [0, 4, 7, 12].forEach((s, i) => tone({ t: t + 0.5 + i * 0.08, type: 'square', f: 330 * Math.pow(2, s / 12), dur: 0.25, vol: 0.09, out: o, filter: 'lowpass', ff: 2000 })); tone({ t: t + 0.9, f: 70, f2: 40, dur: 0.3, vol: 0.6, out: o }); };
  S.forge = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.5 }); tone({ t, type: 'sawtooth', f: 60, f2: 400, dur: 3, slide: 2.8, vol: 0.18, a: 0.3, out: o, filter: 'lowpass', ff: 1500 }); for (let i = 0; i < 6; i++) { tone({ t: t + 0.4 + i * 0.45, f: 100, f2: 40, dur: 0.2, vol: 0.6, out: o }); noise({ t: t + 0.4 + i * 0.45, dur: 0.1, vol: 0.3, f: 2000, out: o }); } tone({ t: t + 3, type: 'triangle', f: 880, dur: 0.6, vol: 0.2, out: o }); };
  S.powerup = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p, rev: 0.4 }); [0, 7, 12, 19].forEach((s, i) => tone({ t: t + i * 0.07, f: 520 * Math.pow(2, s / 12), dur: 0.5, vol: 0.14, out: o })); };
  S.grab = (t, v) => { const o = out({ vol: v, rev: 0.4 }); [0, 4, 7, 12, 16].forEach((s, i) => tone({ t: t + i * 0.06, type: 'triangle', f: 440 * Math.pow(2, s / 12), dur: 0.4, vol: 0.2, out: o })); };
  S.nuke = (t, v) => { const o = out({ vol: v, rev: 0.6 }); tone({ t, type: 'sawtooth', f: 2000, f2: 50, dur: 1, vol: 0.2, out: o }); S.explosion(t + 0.6, v, 0, { size: 2 }); };
  S.revive = (t, v) => { const o = out({ vol: v, rev: 0.5 }); [0, 5, 7, 12].forEach((s, i) => tone({ t: t + i * 0.12, type: 'sine', f: 330 * Math.pow(2, s / 12), dur: 0.8, vol: 0.2, out: o })); };
  // --- alien voices ---
  S.chitter = (t, v, p) => { const o = out({ vol: v * 0.5, pan: p, rev: 0.15 }); const n = U.randi(5, 10), f = U.rand(2000, 3800); for (let i = 0; i < n; i++) noise({ t: t + i * U.rand(0.025, 0.045), dur: 0.02, vol: 0.5, f: f * U.rand(0.8, 1.2), q: 8, out: o }); tone({ t, type: 'sawtooth', f: f / 4, f2: f / 6, dur: 0.25, vol: 0.05, out: o }); };
  S.hiss = (t, v, p) => { const o = out({ vol: v * 0.55, pan: p, rev: 0.2 }); noise({ t, dur: 0.7, vol: 0.5, f: 3500, f2: 1400, q: 4, a: 0.08, out: o }); tone({ t, type: 'sawtooth', f: 320, f2: 180, dur: 0.6, vol: 0.08, a: 0.1, out: o, filter: 'bandpass', ff: 900, q: 3 }); };
  S.gurgle = (t, v, p) => { const o = out({ vol: v * 0.55, pan: p }); for (let i = 0; i < 6; i++) tone({ t: t + i * 0.06, f: U.rand(90, 220), f2: U.rand(60, 300), dur: 0.08, vol: 0.3, out: o }); noise({ t, dur: 0.4, vol: 0.2, type: 'lowpass', f: 500, out: o }); };
  S.shriek = (t, v, p) => {
    const o = out({ vol: v * 0.45, pan: p, rev: 0.3 });
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    c.type = 'sawtooth'; c.frequency.setValueAtTime(1200, t); c.frequency.linearRampToValueAtTime(1900, t + 0.2); c.frequency.linearRampToValueAtTime(900, t + 0.6);
    m.frequency.value = 35; mg.gain.value = 300; m.connect(mg); mg.connect(c.frequency);
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    c.connect(f); f.connect(g); g.connect(o); c.start(t); m.start(t); c.stop(t + 0.7); m.stop(t + 0.7);
  };
  S.roar = (t, v, p, x) => {
    const big = x && x.big ? 1.7 : 1, o = out({ vol: v, pan: p, rev: 0.4 });
    const sh = ctx.createWaveShaper(); sh.curve = distCurve; sh.connect(o);
    [0, 7, -5].forEach((d) => tone({ t, type: 'sawtooth', f: 78 / big, f2: 46 / big, dur: 1.1 * big, vol: 0.22, a: 0.08, detune: d * 10, out: sh, filter: 'lowpass', ff: 700 }));
    noise({ t, dur: 1.1 * big, vol: 0.4, type: 'lowpass', f: 650, f2: 180, a: 0.1, out: o });
  };
  S.wail = (t, v, p) => {
    const o = out({ vol: v * 0.4, pan: p, rev: 0.5 });
    const c = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    c.type = 'triangle'; c.frequency.setValueAtTime(520, t); c.frequency.linearRampToValueAtTime(300, t + 1.2);
    l.frequency.value = 7; lg.gain.value = 25; l.connect(lg); lg.connect(c.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    c.connect(g); g.connect(o); c.start(t); l.start(t); c.stop(t + 1.4); l.stop(t + 1.4);
  };
  S.screech = (t, v, p) => { const o = out({ vol: v * 0.5, pan: p, rev: 0.2 }); tone({ t, type: 'sawtooth', f: U.rand(700, 1100), f2: 180, dur: 0.35, vol: 0.2, out: o, filter: 'bandpass', ff: 1400, q: 2 }); noise({ t, dur: 0.25, vol: 0.3, f: 2500, q: 2, out: o }); };
  S.burrow = (t, v, p) => { const o = out({ vol: v, pan: p }); noise({ t, dur: 0.9, vol: 0.6, type: 'lowpass', f: 250, a: 0.1, out: o }); };
  S.emerge = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p }); noise({ t, dur: 0.6, vol: 0.6, type: 'lowpass', f: 500, f2: 200, a: 0.05, out: o }); };
  S.spike = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p }); noise({ t, dur: 0.12, vol: 0.5, f: 1500, q: 1, out: o }); tone({ t, f: 300, f2: 90, dur: 0.12, vol: 0.4, out: o }); };
  S.spit = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p }); noise({ t, dur: 0.15, vol: 0.5, f: 1200, q: 2, out: o }); tone({ t, f: 500, f2: 200, dur: 0.15, vol: 0.2, out: o }); };
  S.acid = (t, v, p) => { const o = out({ vol: v * 0.4, pan: p }); noise({ t, dur: 0.5, vol: 0.4, type: 'highpass', f: 3000, a: 0.05, out: o }); };
  S.flap = (t, v, p) => { const o = out({ vol: v * 0.35, pan: p }); noise({ t, dur: 0.14, vol: 0.6, type: 'lowpass', f: 450, out: o }); };
  S.stomp = (t, v, p) => { const o = out({ vol: v, pan: p }); tone({ t, f: 70, f2: 30, dur: 0.3, vol: 0.9, out: o }); noise({ t, dur: 0.2, vol: 0.3, type: 'lowpass', f: 300, out: o }); };
  S.slash = (t, v, p) => { const o = out({ vol: v * 0.7, pan: p }); noise({ t, dur: 0.2, vol: 0.5, f: 2400, f2: 600, q: 2, out: o }); };
  S.claw = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p }); noise({ t, dur: 0.1, vol: 0.5, f: 3000, q: 3, out: o }); noise({ t: t + 0.07, dur: 0.1, vol: 0.4, f: 2600, q: 3, out: o }); };
  S.hatch = (t, v, p) => { const o = out({ vol: v * 0.6, pan: p }); noise({ t, dur: 0.3, vol: 0.5, type: 'lowpass', f: 900, out: o }); S.chitter(t + 0.1, v * 0.7, p); };
  S.slam = (t, v, p) => { S.explosion(t, v, p, { size: 1.3 }); };
  // ---------- voices: a buzzy source through vowel/formant bands (creatures and the player) ----------
  function vox(t, dest, o) {
    const dur = o.dur, osc = ctx.createOscillator(), stop = t + dur + 0.06, nodes = [osc];
    osc.type = o.wave || 'sawtooth';
    const fq = osc.frequency; fq.setValueAtTime(o.f0, t);
    if (o.fp) fq.exponentialRampToValueAtTime(o.fp, t + dur * (o.peak || 0.25));
    fq.exponentialRampToValueAtTime(Math.max(15, o.f1 || o.f0), t + dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.f0 * o.vib[1]; l.connect(lg); lg.connect(fq); nodes.push(l); }
    let src = osc;
    if (o.am) { const am = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); am.gain.value = 1 - o.am[1] * 0.5; l.type = 'triangle'; l.frequency.value = o.am[0]; lg.gain.value = o.am[1] * 0.5; l.connect(lg); lg.connect(am.gain); osc.connect(am); src = am; nodes.push(l); }
    const env = ctx.createGain(), a = o.a || 0.015, vol = o.vol === undefined ? 0.4 : o.vol;
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol, t + a);
    env.gain.setValueAtTime(vol, t + Math.max(a + 0.005, dur * (o.hold || 0.45))); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mix = ctx.createGain(); mix.gain.value = o.gain || 4;
    (o.form || [800, 1600]).forEach((ff, i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(ff, t);
      if (o.formEnd) bp.frequency.exponentialRampToValueAtTime(ff * o.formEnd, t + dur);
      bp.Q.value = o.q || 5; const g = ctx.createGain(); g.gain.value = i === 0 ? 1 : 0.6 / i;
      src.connect(bp); bp.connect(g); g.connect(mix);
    });
    let last = mix;
    if (o.dist) { const sh = ctx.createWaveShaper(); sh.curve = distCurve; mix.connect(sh); last = sh; }
    last.connect(env); env.connect(dest);
    if (o.sub) {
      const so = ctx.createOscillator(), sg = ctx.createGain(); so.frequency.setValueAtTime(o.f0 * 0.5, t); so.frequency.exponentialRampToValueAtTime(Math.max(15, (o.f1 || o.f0) * 0.5), t + dur);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(vol * o.sub, t + a * 2); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      so.connect(sg); sg.connect(dest); nodes.push(so);
    }
    nodes.forEach((n) => { n.start(t); n.stop(stop); });
    if (o.noise) noise({ t, dur, vol: vol * o.noise, type: 'bandpass', f: (o.form || [800, 1600])[1], q: 1.2, out: dest, a });
  }

  // Player pain: a short grunt on a random vowel; heavy hits get a longer, rougher "argh", going down a long groan.
  S.pain = (t, v, p, x) => {
    const heavy = !!x.heavy, down = !!x.down, o = out({ vol: v, rev: 0.1 }), f0 = U.rand(100, 132) * (heavy ? 0.92 : 1);
    const vowel = U.pick([[640, 1150, 2450], [560, 920, 2400], [720, 1240, 2550], [480, 1000, 2300]]);
    const dur = down ? U.rand(0.9, 1.1) : heavy ? U.rand(0.34, 0.46) : U.rand(0.17, 0.27);
    vox(t, o, { f0: f0 * (down ? 1.1 : 1.28), fp: f0 * (down ? 1.25 : 1.4), peak: down ? 0.2 : 0.12, f1: f0 * (down ? 0.62 : 0.82), dur, form: vowel, formEnd: down ? 0.8 : null, q: 7, gain: 5,
      am: heavy || down ? [30, 0.35] : null, vib: down ? [5, 0.03] : null, dist: heavy, noise: 0.3, vol: heavy ? 0.6 : 0.48, hold: 0.35, a: 0.01 });
    noise({ t, dur: 0.08, vol: 0.3, type: 'lowpass', f: 380, out: o });
    if (heavy || down) noise({ t: t + dur * 0.8, dur: 0.35, vol: 0.12, type: 'bandpass', f: 1300, q: 1, a: 0.08, out: o });
  };

  // ---------- creature sound suites ----------
  // Each species has a voice profile; events shape the pitch contour, length and loudness.
  const CV = {
    skitterling: { f: [700, 1000], wave: 'sawtooth', form: [2200, 3600], q: 7, am: [42, 0.8], noise: 0.35, len: 0.55, step: 'tick', gain: 3 },
    broodling: { f: [1300, 1800], wave: 'square', form: [3000, 4800], q: 8, am: [60, 0.8], noise: 0.25, len: 0.4, step: 'tick', gain: 2 },
    lancer: { f: [170, 240], wave: 'sawtooth', form: [850, 2300], q: 5, am: [26, 0.6], noise: 0.9, len: 0.8, step: 'pad', gain: 4, dist: true },
    burster: { f: [110, 170], wave: 'triangle', form: [420, 1000], q: 4, vib: [9, 0.22], noise: 0.35, len: 0.8, step: 'squish', gain: 4 },
    shrieker: { f: [950, 1400], wave: 'square', form: [1700, 3200], q: 6, vib: [7, 0.07], noise: 0.2, len: 0.7, step: null, gain: 1.4 },
    behemoth: { f: [52, 72], wave: 'sawtooth', form: [280, 720], q: 4, am: [17, 0.7], noise: 0.45, len: 1.3, step: 'stomp', gain: 7, dist: true, sub: 0.6 },
    broodmother: { f: [140, 210], wave: 'sawtooth', form: [620, 1350], q: 6, vib: [5, 0.06], am: [11, 0.35], noise: 0.4, len: 1.2, step: 'squish', gain: 3.8 },
    burrower: { f: [68, 100], wave: 'sawtooth', form: [340, 880], q: 4, am: [22, 0.6], noise: 0.5, len: 1.0, step: 'pad', gain: 6, dist: true, sub: 0.4 },
    tyrant: { f: [38, 52], wave: 'sawtooth', form: [240, 560, 1300], q: 4, am: [14, 0.75], noise: 0.5, len: 1.8, step: 'stomp', gain: 8, dist: true, sub: 0.9 },
  };
  // c = [start, peak, end] pitch multipliers
  const CEV = {
    idle: { c: [1, 1.12, 0.85], peak: 0.4, dur: [0.55, 0.9], vol: 0.3, hold: 0.5 },
    alert: { c: [0.85, 1.4, 0.7], peak: 0.35, dur: [0.9, 1.3], vol: 0.55, hold: 0.55, formEnd: 1.15 },
    attack: { c: [1.15, 1.55, 0.85], peak: 0.18, dur: [0.35, 0.5], vol: 0.5, hold: 0.3, a: 0.008 },
    pain: { c: [1.35, 1.7, 1.05], peak: 0.22, dur: [0.25, 0.38], vol: 0.45, hold: 0.25, a: 0.006 },
    death: { c: [1.3, 1.5, 0.4], peak: 0.12, dur: [1.2, 1.7], vol: 0.55, hold: 0.35, formEnd: 0.7 },
  };
  const clicks = (t, o, n, gap, f, vol) => { for (let i = 0; i < n; i++) noise({ t: t + i * gap * U.rand(0.8, 1.2), dur: 0.014, vol, f: f * U.rand(0.85, 1.15), q: 6, out: o }); };
  const bubbles = (t, o, n, span, vol) => { for (let i = 0; i < n; i++) { const f = U.rand(220, 700); tone({ t: t + U.rand(0, span), f, f2: f * 1.9, dur: 0.05, vol, out: o }); } };
  function crStep(t, o, V) {
    if (V.step === 'tick') clicks(t, o, 2, 0.035, 3400, 0.8);
    else if (V.step === 'pad') { tone({ t, f: 150, f2: 70, dur: 0.1, vol: 0.38, out: o, filter: 'lowpass', ff: 320 }); noise({ t, dur: 0.05, vol: 0.2, type: 'lowpass', f: 600, out: o }); }
    else if (V.step === 'squish') { noise({ t, dur: 0.13, vol: 0.35, type: 'lowpass', f: 750, f2: 220, out: o }); tone({ t, f: 95, f2: 50, dur: 0.1, vol: 0.35, out: o }); }
    else if (V.step === 'stomp') { tone({ t, f: 70, f2: 30, dur: 0.3, vol: 0.9, out: o }); noise({ t, dur: 0.2, vol: 0.3, type: 'lowpass', f: 300, out: o }); }
  }
  function crSpecial(t, o, type, V, p) {
    const f = U.rand(V.f[0], V.f[1]);
    if (type === 'skitterling' || type === 'broodling') {          // pounce: rising screech + whoosh
      vox(t, o, { f0: f * 1.2, fp: f * 1.9, f1: f * 1.4, peak: 0.5, dur: 0.3, wave: V.wave, form: V.form, q: V.q, am: V.am, gain: V.gain, vol: 0.45, a: 0.005 });
      noise({ t, dur: 0.35, vol: 0.3, f: 600, f2: 2600, q: 1.5, out: o });
    } else if (type === 'lancer') {                                  // spine volley: quill rattle + rising hiss
      clicks(t, o, 14, 0.028, 2200, 0.3);
      noise({ t, dur: 0.5, vol: 0.35, f: 1800, f2: 4200, q: 2, a: 0.2, out: o });
    } else if (type === 'burster') {                                 // fuse: swelling whine and frantic bubbling
      tone({ t, type: 'triangle', f: 280, f2: 1500, dur: 0.6, vol: 0.28, out: o });
      bubbles(t, o, 12, 0.55, 0.12);
    } else if (type === 'shrieker') {                                // dive: falling scream + wind
      vox(t, o, { f0: f * 1.2, fp: f * 1.8, f1: f * 0.7, peak: 0.25, dur: 0.9, wave: V.wave, form: V.form, q: V.q, vib: [11, 0.05], gain: V.gain, vol: 0.5 });
      noise({ t, dur: 0.9, vol: 0.3, f: 500, f2: 1600, q: 1, a: 0.2, out: o });
    } else if (type === 'behemoth') {                                // charge: two snorts, then a bellow
      for (const d of [0, 0.22]) noise({ t: t + d, dur: 0.16, vol: 0.5, type: 'lowpass', f: 900, f2: 250, out: o });
      vox(t + 0.45, o, { f0: f, fp: f * 1.5, f1: f * 0.9, peak: 0.3, dur: 1.1, wave: V.wave, form: V.form, q: V.q, am: V.am, dist: true, sub: V.sub, gain: V.gain, vol: 0.6 });
    } else if (type === 'broodmother') {                             // egg: wet squelch and a plop
      noise({ t, dur: 0.35, vol: 0.45, type: 'lowpass', f: 1100, f2: 200, out: o });
      tone({ t: t + 0.28, f: 210, f2: 55, dur: 0.18, vol: 0.5, out: o });
      vox(t, o, { f0: f * 0.9, fp: f * 1.1, f1: f * 0.8, dur: 0.6, wave: V.wave, form: V.form, q: V.q, vib: V.vib, gain: V.gain, vol: 0.3 });
    } else if (type === 'burrower') {                                // digging: gritty rumble
      noise({ t, dur: 1.2, vol: 0.55, type: 'lowpass', f: 140, a: 0.1, out: o });
      clicks(t, o, 18, 0.06, 900, 0.14);
    } else S.roar(t, 1, p, { big: true });
  }
  function creature(t, v, p, type, ev) {
    const V = CV[type] || CV.skitterling, o = out({ vol: v, pan: p, rev: V.len > 1 ? 0.45 : 0.22 });
    if (ev === 'step') return crStep(t, o, V);
    if (ev === 'special') return crSpecial(t, o, type, V, p);
    const K = CEV[ev] || CEV.idle, f = U.rand(V.f[0], V.f[1]), dur = V.len * U.rand(K.dur[0], K.dur[1]);
    vox(t, o, { f0: f * K.c[0], fp: f * K.c[1], f1: f * K.c[2], peak: K.peak, dur, wave: V.wave, form: V.form, formEnd: K.formEnd, q: V.q,
      am: V.am && (ev === 'death' ? [V.am[0] * 0.6, V.am[1]] : V.am), vib: V.vib, noise: V.noise, dist: V.dist, sub: V.sub, gain: V.gain, vol: K.vol, hold: K.hold, a: K.a });
    // species layers on top of the voice
    const small = type === 'skitterling' || type === 'broodling', big = type === 'behemoth' || type === 'tyrant';
    if (small && ev !== 'pain') clicks(t, o, ev === 'death' ? 10 : 6, 0.03, type === 'broodling' ? 4200 : 3000, 0.25);
    if (small && ev === 'attack') noise({ t, dur: 0.12, vol: 0.35, f: 3000, f2: 900, q: 2, out: o });
    if (type === 'lancer' && (ev === 'idle' || ev === 'death')) noise({ t, dur: dur * 0.9, vol: 0.18, f: 3400, f2: 1300, q: 3, a: 0.06, out: o });
    if (type === 'lancer' && ev === 'alert') clicks(t + 0.1, o, 16, 0.03, 2000, 0.22);
    if (type === 'burster' && ev !== 'attack') bubbles(t, o, ev === 'death' ? 10 : 5, dur, 0.1);
    if (type === 'burster' && ev === 'pain') noise({ t, dur: 0.18, vol: 0.4, type: 'lowpass', f: 900, f2: 200, out: o });
    if (type === 'shrieker' && ev === 'alert') S.shriek(t + 0.05, v * 0.5, p);
    if (type === 'shrieker' && ev === 'death') tone({ t, f: 2400, f2: 260, dur: 1.3, vol: 0.12, out: o });
    if (big && ev === 'alert') S.roar(t, v * 0.8, p, { big: type === 'tyrant' });
    if (big && ev === 'attack') noise({ t, dur: 0.2, vol: 0.45, type: 'lowpass', f: 700, f2: 200, out: o });
    if ((big || type === 'broodmother' || type === 'burrower') && ev === 'death') {
      tone({ t: t + dur * 0.85, f: 60, f2: 24, dur: 0.6, vol: 0.9, out: o }); noise({ t: t + dur * 0.85, dur: 0.5, vol: 0.5, type: 'lowpass', f: 400, out: o });
    }
    if (type === 'broodmother' && ev === 'idle') noise({ t, dur, vol: 0.12, type: 'lowpass', f: 900, a: 0.2, out: o });
    if (type === 'burrower' && ev === 'alert') noise({ t, dur: 0.9, vol: 0.4, type: 'lowpass', f: 160, a: 0.05, out: o });
  }
  A.CREATURE_EVENTS = ['idle', 'alert', 'attack', 'pain', 'special', 'step', 'death'];

  // --- expanded arsenal ---
  S.crossbow = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.15 }); tone({ t, type: 'triangle', f: 180, f2: 90, dur: 0.12, vol: 0.5, out: o }); noise({ t, dur: 0.1, vol: 0.5, f: 1800, f2: 600, q: 2, out: o }); tone({ t: t + 0.02, type: 'square', f: 95, dur: 0.18, vol: 0.06, out: o, filter: 'lowpass', ff: 600 }); };
  S.rocket = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.4 }); noise({ t, dur: 0.9, vol: 0.8, type: 'lowpass', f: 2400, f2: 300, out: o }); tone({ t, f: 110, f2: 40, dur: 0.4, vol: 0.8, out: o }); noise({ t: t + 0.05, dur: 0.7, vol: 0.3, type: 'bandpass', f: 900, f2: 400, q: 1, a: 0.05, out: o }); };
  S.saw = (t, v, p) => { const o = out({ vol: v * 0.8, pan: p, rev: 0.15 }); tone({ t, type: 'sawtooth', f: 900, f2: 1400, dur: 0.3, vol: 0.1, out: o, filter: 'bandpass', ff: 2000, q: 3 }); noise({ t, dur: 0.12, vol: 0.4, f: 2500, q: 2, out: o }); tone({ t, f: 160, f2: 70, dur: 0.12, vol: 0.5, out: o }); };
  S.wave = (t, v, p) => { const o = out({ vol: v, pan: p, rev: 0.5 }); tone({ t, f: 90, f2: 30, dur: 0.6, vol: 1, out: o }); tone({ t, type: 'sawtooth', f: 300, f2: 60, dur: 0.4, vol: 0.18, out: o, filter: 'lowpass', ff: 900 }); noise({ t, dur: 0.5, vol: 0.6, type: 'lowpass', f: 1200, f2: 90, out: o }); noise({ t, dur: 0.08, vol: 0.4, type: 'highpass', f: 3500, out: o }); };
  S.ray = (t, v, p) => { const o = out({ vol: v * 0.8, pan: p, rev: 0.3 }); tone({ t, type: 'square', f: 1800, f2: 400, dur: 0.16, vol: 0.12, out: o, filter: 'lowpass', ff: 3000 }); tone({ t, type: 'sine', f: 900, f2: 1600, dur: 0.12, vol: 0.2, out: o }); tone({ t: t + 0.04, type: 'sine', f: 450, f2: 200, dur: 0.2, vol: 0.2, out: o }); };

  // ---------- sample cache ----------
  // Building a sound live costs 6-15 audio nodes (oscillators, sweeping filters). A big fight plays hundreds a second,
  // which is more than the audio thread can render in time, and it crackles. So each sound is rendered offline a
  // few times (on a background thread) and then played back as a buffer: 3-4 cheap nodes, no automation.
  const VARIANTS = 4, cache = new Map();
  const VARY = { hit: 1, kill: 1, splat: 1, gib: 1, claw: 1, slash: 1, spit: 1, spike: 1, acid: 1, flap: 1, stomp: 1, emerge: 1, burrow: 1, step: 1, land: 1, bounce: 1, armor: 1, head: 1, shieldHit: 1, explosion: 1, acidburst: 1, knifeHit: 1 };
  const NOCACHE = new Set(['uiHover']);
  const qSize = (x) => Math.max(0.2, Math.round(x * 5) / 5);
  function cacheKey(name, o) {
    if (NOCACHE.has(name) || !window.OfflineAudioContext) return null;
    let k = name;
    if (o.size) k += '|s' + qSize(o.size);
    if (o.surf) k += '|' + o.surf;
    if (o.big) k += '|big';
    if (o.heavy) k += '|heavy';
    if (o.down) k += '|down';
    return k;
  }
  function renderVariant(key, len, draw) {
    let c = cache.get(key);
    if (!c) cache.set(key, c = { bufs: [], wet: 0, pending: false, len });
    if (c.pending || c.broken || c.bufs.length >= VARIANTS) return;
    const sr = ctx.sampleRate, off = new OfflineAudioContext(2, Math.ceil(Math.min(8, c.len) * sr), sr);
    const live = [ctx, sfxBus, revIn], mg = off.createChannelMerger(2); mg.connect(off.destination);
    ctx = off; sfxBus = off.createGain(); sfxBus.connect(mg, 0, 0); revIn = off.createGain(); revIn.connect(mg, 0, 1);
    try { draw(0.005); } catch (e) { c.broken = true; } finally { [ctx, sfxBus, revIn] = live; }
    if (c.broken) return;
    c.pending = true;
    off.startRendering().then((buf) => {
      c.pending = false;
      const dry = buf.getChannelData(0), wet = buf.getChannelData(1), n = dry.length;
      let end = n - 1; while (end > 0 && Math.abs(dry[end]) < 2e-4 && Math.abs(wet[end]) < 2e-4) end--;
      if (end > n - sr * 0.02 && c.len < 8) { c.len = Math.min(8, c.len * 2); return; } // still ringing: render longer next time
      const len2 = Math.min(n, end + Math.round(sr * 0.01)), out = ctx.createBuffer(1, Math.max(1, len2), sr), d = out.getChannelData(0);
      let ed = 0, ew = 0;
      for (let i = 0; i < len2; i++) { d[i] = dry[i]; ed += dry[i] * dry[i]; ew += wet[i] * wet[i]; }
      c.bufs.push(out); c.wet = ed > 1e-9 ? Math.sqrt(ew / ed) : 0;
    }).catch(() => { c.pending = false; c.broken = true; });
  }
  function playBuf(c, t, v, p, rate) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = c.bufs[Math.floor(Math.random() * c.bufs.length)];
    if (rate !== 1) src.playbackRate.value = rate;
    g.gain.value = v; src.connect(g);
    let node = g;
    if (Math.abs(p || 0) > 0.03) { const pn = ctx.createStereoPanner(); pn.pan.value = U.clamp(p, -1, 1); g.connect(pn); node = pn; }
    node.connect(sfxBus);
    if (c.wet > 0.01) { const sg = ctx.createGain(); sg.gain.value = c.wet; node.connect(sg); sg.connect(revIn); }
    src.start(t);
  }
  A.cacheStats = (detail) => {
    let n = 0, b = 0; const d = {};
    for (const [k, c] of cache) {
      n++; b += c.bufs.length;
      if (detail) d[k] = c.bufs.map((x) => { let pk = 0; const a = x.getChannelData(0); for (let i = 0; i < a.length; i++) pk = Math.max(pk, Math.abs(a[i])); return x.duration.toFixed(2) + 's/' + pk.toFixed(2); }).join(' ') + (c.broken ? ' BROKEN' : '') + ' wet ' + c.wet.toFixed(2);
    }
    return { sounds: n, buffers: b, d };
  };

  const lastPlay = {};
  const THROTTLE = { pain: 0.28, uiHover: 0.03, chitter: 0.07, hiss: 0.12, gurgle: 0.1, shriek: 0.15, roar: 0.4, wail: 0.5, step: 0.05, hit: 0.03, kill: 0.03, splat: 0.03, screech: 0.06, flap: 0.08, stomp: 0.1, bounce: 0.05, armor: 0.05 };
  // Voice budget: every sound is a small graph of nodes; too many at once overloads the audio thread (crackle).
  // Estimated lengths let us count what is still ringing and drop quiet or far-away sounds first.
  const LEN = { explosion: 1.4, nuke: 2.5, roar: 1.3, wail: 1.3, singularity: 3.5, power: 2.8, forge: 3.5, box: 4, boxLeave: 2.3, capsule: 1.6, build: 1.8, door: 2.2, rail: 1.2, magnum: 0.7, void: 1.2, shotgun: 0.5, rocket: 0.9, wave: 0.6 };
  let ringing = [];
  A.budget = (len, vol, important) => {
    const now = ctx.currentTime;
    if (ringing.length > 12) ringing = ringing.filter((t) => t > now);
    const n = ringing.length, cap = important ? 56 : 40;
    if (n >= cap || (n > 28 && vol < 0.12 && !important)) return false;
    ringing.push(now + len); return true;
  };
  A.voices = () => { const now = ctx ? ctx.currentTime : 0; return ringing.filter((t) => t > now).length; };
  A.play = (name, o = {}) => {
    if (!A.ready || ctx.state !== 'running') return;
    const fn = S[name]; if (!fn) return;
    const now = ctx.currentTime, th = THROTTLE[name];
    if (th && lastPlay[name] && now - lastPlay[name] < th) return;
    const s = spatial(o);
    if (s.vol < 0.015) return;
    if (!A.budget(LEN[name] || 0.45, s.vol, !o.pos)) return;
    lastPlay[name] = now;
    const t = now + LA + (o.delay || 0), key = cacheKey(name, o), c = key && cache.get(key);
    if (c && c.bufs.length && (c.bufs.length >= VARIANTS || Math.random() < 0.75)) { playBuf(c, t, s.vol, s.pan, VARY[name] ? U.rand(0.96, 1.04) : 1); return; }
    fn(t, s.vol, s.pan, o);
    if (key) { const x = Object.assign({}, o); if (x.size) x.size = qSize(x.size); renderVariant(key, (LEN[name] || 0.6) + 0.5, (t0) => fn(t0, 1, 0, x)); }
  };

  // Creature events: per-species throttling plus a cap on overlapping voices so a horde stays readable.
  const crLast = {}, CR_TH = { idle: 0.35, alert: 0.5, attack: 0.1, pain: 0.07, death: 0.04, step: 0.02, special: 0.15 };
  let crVoices = [], crSteps = [];
  A.creature = (type, ev, o = {}) => {
    if (!A.ready || ctx.state !== 'running') return;
    const now = ctx.currentTime, key = type + ev;
    if (crLast[key] && now - crLast[key] < (CR_TH[ev] || 0.1)) return;
    const s = spatial(o); if (s.vol < 0.02) return;
    if (ev === 'step') { crSteps = crSteps.filter((x) => now - x < 0.25); if (crSteps.length >= 6) return; crSteps.push(now); }
    else { crVoices = crVoices.filter((x) => now - x < 0.35); if (crVoices.length >= (ev === 'death' || ev === 'alert' ? 10 : 6)) return; crVoices.push(now); }
    if (!A.budget(ev === 'step' ? 0.2 : ev === 'death' ? 1.6 : 0.9, s.vol, ev === 'death')) return;
    crLast[key] = now;
    const t = now + LA + (o.delay || 0), ck = 'cr:' + type + ':' + ev, c = cache.get(ck);
    if (c && c.bufs.length && (c.bufs.length >= VARIANTS || Math.random() < 0.75)) { playBuf(c, t, s.vol, s.pan, U.rand(0.95, 1.05)); return; }
    creature(t, s.vol, s.pan, type, ev);
    const V = CV[type] || CV.skitterling;
    renderVariant(ck, ev === 'step' ? 0.5 : V.len * 2 + 1.2, (t0) => creature(t0, 1, 0, type, ev));
  };

  // ---------- looping sounds (flamethrower, minigun spin) ----------
  const loops = {};
  A.loop = (name, on, v = 1) => {
    if (!A.ready) return;
    let L = loops[name];
    if (on && !L) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(), g = ctx.createGain(); g.gain.value = 0;
      let base = 0.5;
      if (name === 'flame') { f.type = 'lowpass'; f.frequency.value = 1100; base = 0.55; }
      else if (name === 'spin') { f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 4; base = 0.35; }
      else if (name === 'wind') { f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6; base = 0.12; }
      else if (name === 'hazard') { f.type = 'highpass'; f.frequency.value = 2500; base = 0.12; }
      else if (name === 'trap') { f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.5; base = 0.3; }
      else if (name === 'beam') { f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 6; base = 0.4; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 110; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(f); o.start(); }
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
      L = loops[name] = { g, f, base };
    }
    if (L) L.g.gain.setTargetAtTime(on ? v * L.base : 0, ctx.currentTime, 0.06);
  };
  A.stopLoops = () => { for (const k in loops) A.loop(k, false); };


  // ---------- ambience: per-map background bed + distant events ----------
  const AMB = { want: null, kind: null, nodes: [], nextThud: 14, nextCall: 9, nextCreak: 6 };
  function ambNoise(type, freq, q, vol, lfoRate, lfoDepth) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(weatherBus);
    src.start(0, Math.random() * 1.5);
    g.gain.setTargetAtTime(vol, ctx.currentTime, 1.5);
    const nodes = [src, g];
    if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(f.frequency); l.start(); nodes.push(l); }
    return nodes;
  }
  function ambTone(freq, vol, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = 0;
    o.connect(g); g.connect(weatherBus); o.start(); g.gain.setTargetAtTime(vol, ctx.currentTime, 1.5);
    return [o, g];
  }
  A.ambience = (kind) => {
    AMB.want = kind;
    if (!A.ready || kind === AMB.kind) return;
    const old = AMB.nodes;
    for (const n of old) if (n instanceof GainNode) n.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(() => old.forEach((n) => { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* already stopped */ } }), 3000);
    AMB.nodes = []; AMB.kind = kind;
    if (!kind) return;
    const add = (arr) => AMB.nodes.push(...arr);
    if (kind === 'rain') { add(ambNoise('highpass', 2600, 0.5, 0.09)); add(ambNoise('bandpass', 900, 0.7, 0.05, 0.1, 250)); add(ambNoise('lowpass', 150, 0.7, 0.1)); }
    else if (kind === 'embers') { add(ambNoise('lowpass', 85, 1, 0.24)); add(ambNoise('bandpass', 320, 2, 0.04, 0.07, 140)); add(ambTone(36, 0.05)); }
    else if (kind === 'snow') { add(ambNoise('bandpass', 520, 3, 0.1, 0.09, 360)); add(ambNoise('bandpass', 1250, 4, 0.035, 0.13, 600)); add(ambNoise('lowpass', 110, 0.7, 0.06)); }
    else if (kind === 'ash') { add(ambNoise('bandpass', 380, 0.8, 0.09, 0.07, 220)); add(ambNoise('lowpass', 95, 0.8, 0.12)); add(ambTone(41, 0.035)); add(ambNoise('bandpass', 1900, 5, 0.01, 0.11, 700)); }
    else if (kind === 'dust') { add(ambNoise('bandpass', 520, 0.6, 0.12, 0.09, 300)); add(ambNoise('highpass', 3200, 0.5, 0.03, 0.12, 900)); add(ambNoise('lowpass', 110, 0.8, 0.08)); }
    else if (kind === 'fireflies') { add(ambNoise('bandpass', 4200, 6, 0.012, 7, 900)); add(ambNoise('lowpass', 160, 0.8, 0.05)); add(ambTone(55, 0.02)); }
    else if (kind === 'spores') { add(ambTone(50, 0.05)); add(ambTone(100, 0.018)); add(ambNoise('lowpass', 190, 1, 0.07)); add(ambNoise('bandpass', 2400, 8, 0.012, 0.05, 800)); }
  };
  function distantBus(pan, vol, cutoff, rev) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.connect(ambBus);
    const g = ctx.createGain(); g.gain.value = vol; const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(lp); const s = ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(revIn);
    return g;
  }
  // Something big walking somewhere in the dark: a slow run of dull, distant thuds.
  function distantSteps() {
    const n = U.randi(5, 8), gap = U.rand(0.62, 0.85), t0 = ctx.currentTime + 0.05;
    const g = distantBus(U.rand(-0.8, 0.8), 0.2, 180, 0.9);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * gap + U.rand(-0.03, 0.03), v = 0.45 + Math.sin(i / (n - 1) * Math.PI) * 0.55;
      tone({ t, f: 56, f2: 30, dur: 0.5, vol: 0.9 * v, out: g });
      noise({ t, dur: 0.25, vol: 0.45 * v, type: 'lowpass', f: 130, out: g });
    }
  }
  function distantCall() {
    const t = ctx.currentTime + 0.05, g = distantBus(U.rand(-0.9, 0.9), 0.07, 650, 1.2);
    const f1 = U.rand(300, 700), f2 = f1 * U.rand(0.4, 0.6), dur = U.rand(0.8, 1.6);
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), vg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    l.frequency.value = U.rand(5, 9); lg.gain.value = f1 * 0.05; l.connect(lg); lg.connect(o.frequency);
    vg.gain.setValueAtTime(0.0001, t); vg.gain.linearRampToValueAtTime(0.5, t + 0.15); vg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(vg); vg.connect(g); o.start(t); l.start(t); o.stop(t + dur + 0.1); l.stop(t + dur + 0.1);
  }
  // A far-off city siren winding up and down behind the buildings.
  function siren() {
    const t = ctx.currentTime + 0.05, dur = U.rand(5, 9), g = distantBus(U.rand(-0.9, 0.9), 0.05, 1400, 1.4);
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), vg = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 620; l.frequency.value = U.rand(0.18, 0.3); lg.gain.value = 220; l.connect(lg); lg.connect(o.frequency);
    vg.gain.setValueAtTime(0.0001, t); vg.gain.linearRampToValueAtTime(0.5, t + 1.2); vg.gain.setValueAtTime(0.5, t + dur - 1.5); vg.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(vg); vg.connect(g); o.start(t); l.start(t); o.stop(t + dur + 0.1); l.stop(t + dur + 0.1);
  }
  function creak() {
    const t = ctx.currentTime + 0.05, o = out({ vol: 0.06, pan: U.rand(-0.9, 0.9), dest: ambBus, rev: 0.8 });
    tone({ t, type: 'sawtooth', f: U.rand(90, 160), f2: U.rand(60, 110), dur: U.rand(0.8, 1.6), vol: 0.3, a: 0.2, out: o, filter: 'bandpass', ff: 700, q: 6 });
  }
  A.ambientTick = (dt) => {
    if (!A.ready || !AMB.kind || ctx.state !== 'running') return;
    AMB.nextThud -= dt; AMB.nextCall -= dt; AMB.nextCreak -= dt;
    if (AMB.nextThud <= 0) { AMB.nextThud = U.rand(22, 45); distantSteps(); }
    if (AMB.nextCall <= 0) { AMB.nextCall = U.rand(10, 24); distantCall(); }
    if (AMB.kind === 'spores' && AMB.nextCreak <= 0) { AMB.nextCreak = U.rand(6, 14); creak(); }
    if (AMB.kind === 'ash' && AMB.nextCreak <= 0) { AMB.nextCreak = U.rand(16, 34); if (Math.random() < 0.6) siren(); else creak(); }
  };

  // ---------- announcer (speech synthesis) ----------
  // The Hive Mind: deep, slow, never interrupts the announcer
  A.hive = (text) => {
    if (XH.MUTE || !A.announcer || !A.hiveOn || !window.speechSynthesis) return;
    try {
      if (speechSynthesis.speaking) return;
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.05; u.rate = 0.72; u.volume = Math.min(1, A.vol.master * 0.95);
      const voices = speechSynthesis.getVoices();
      const pref = voices.find((q) => /en/i.test(q.lang) && /zira|hazel|susan|female|samantha/i.test(q.name)) || voices.find((q) => /en/i.test(q.lang));
      if (pref) u.voice = pref;
      A.hiveSpeaking = true; u.onend = u.onerror = () => { A.hiveSpeaking = false; };
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };
  // Every perk machine hums its own little tune
  const JINGLES = {
    J: { notes: [45, 52, 57, 52, 48, 52, 57, 60], type: 'sawtooth', cut: 900, bpm: 110 },
    R: { notes: [72, 74, 76, 79, 76, 74, 72, 79], type: 'square', cut: 2400, bpm: 170 },
    D: { notes: [60, 60, 67, 67, 65, 64, 62, 60], type: 'square', cut: 1500, bpm: 140 },
    A: { notes: [64, 67, 71, 74, 76, 74, 71, 67], type: 'triangle', cut: 4000, bpm: 150 },
    L: { notes: [69, 72, 76, 81, 79, 76, 72, 74], type: 'sine', cut: 5000, bpm: 90 },
    V: { notes: [57, 60, 63, 62, 60, 58, 57, 51], type: 'sawtooth', cut: 1200, bpm: 100 },
    E: { notes: [55, 59, 62, 67, 62, 59, 62, 55], type: 'square', cut: 1800, bpm: 130 },
    I: { notes: [48, 55, 48, 58, 48, 55, 60, 63], type: 'sawtooth', cut: 1000, bpm: 125 },
    Q: { notes: [76, 83, 76, 81, 76, 79, 76, 88], type: 'square', cut: 3000, bpm: 180 },
    N: { notes: [67, 71, 74, 78, 74, 71, 67, 62], type: 'triangle', cut: 3500, bpm: 115 },
  };
  A.jingle = (key, pos) => {
    if (!A.ready || ctx.state !== 'running') return;
    const J = JINGLES[key]; if (!J) return;
    const sp = spatial({ pos, vol: 0.9 }); if (sp.vol < 0.05) return;
    const o = out({ vol: sp.vol * 0.55, pan: sp.pan, rev: 0.35 }), step = 60 / J.bpm / 2, t0 = ctx.currentTime + 0.05;
    J.notes.forEach((n, i) => {
      tone({ t: t0 + i * step, type: J.type, f: mf(n), dur: step * 1.6, vol: 0.12, out: o, filter: 'lowpass', ff: J.cut });
      if (i % 2 === 0) tone({ t: t0 + i * step, type: 'triangle', f: mf(n - 12), dur: step * 2, vol: 0.06, out: o });
    });
  };
  A.say = (text) => {
    if (XH.MUTE || !A.announcer || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.2; u.rate = 0.82; u.volume = Math.min(1, A.vol.master * 1.1);
      const voices = speechSynthesis.getVoices();
      const pref = voices.find((v) => /en/i.test(v.lang) && /male|david|daniel|george|guy/i.test(v.name)) || voices.find((v) => /en/i.test(v.lang));
      if (pref) u.voice = pref;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };

  // =====================================================================
  //                       PROCEDURAL MUSIC ENGINE
  // =====================================================================
  const Music = A.music = { intensity: 0, cur: 0 };
  const AEOLIAN = [0, 2, 3, 5, 7, 8, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], HARM = [0, 2, 3, 5, 7, 8, 11];
  const STYLES = {
    menu: { bpm: 72, root: 33, scale: AEOLIAN, prog: [0, 5, 3, 4, 0, 5, 6, 4] },
    kestrel: { bpm: 112, root: 33, scale: AEOLIAN, prog: [0, 5, 2, 6] },
    depths: { bpm: 96, root: 38, scale: PHRYG, prog: [0, 1, 0, 6, 0, 1, 5, 4] },
    frostfall: { bpm: 104, root: 40, scale: DORIAN, prog: [0, 3, 5, 4] },
    ark: { bpm: 124, root: 29, scale: HARM, prog: [0, 5, 3, 4] },
    city: { bpm: 118, root: 36, scale: AEOLIAN, prog: [0, 5, 3, 6, 0, 5, 2, 4] },
    dustbasin: { bpm: 100, root: 38, scale: DORIAN, prog: [0, 3, 4, 3] },
    verdant: { bpm: 92, root: 35, scale: AEOLIAN, prog: [0, 6, 5, 4] },
    helix: { bpm: 128, root: 33, scale: HARM, prog: [0, 1, 0, 5] },
    undercroft: { bpm: 88, root: 31, scale: PHRYG, prog: [0, 1, 6, 0] },
    glacier: { bpm: 96, root: 40, scale: DORIAN, prog: [0, 5, 3, 4, 0, 5, 6, 4] },
    crucible: { bpm: 132, root: 30, scale: PHRYG, prog: [0, 1, 0, 3] },
    cathedral: { bpm: 84, root: 29, scale: HARM, prog: [0, 5, 1, 4, 0, 5, 6, 4] },
    bastion: { bpm: 120, root: 33, scale: AEOLIAN, prog: [0, 5, 6, 4] },
    selene: { bpm: 108, root: 41, scale: DORIAN, prog: [0, 4, 5, 3] },
    starfall: { bpm: 112, root: 34, scale: AEOLIAN, prog: [0, 3, 5, 4, 0, 3, 6, 5] },
    vesper: { bpm: 116, root: 37, scale: DORIAN, prog: [0, 5, 3, 4] },
    temple: { bpm: 94, root: 36, scale: PHRYG, prog: [0, 1, 5, 4, 0, 1, 6, 0] },
  };
  let style = STYLES.menu, step = 0, nextT = 0, bar = -1, chord = [0, 3, 7], leadNote = 7, leadLeft = 0;
  let L = {};
  Music.init = () => {
    const mk = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus); return g; };
    L = { pad: mk(), bass: mk(), arp: mk(), drums: mk(), lead: mk(), drone: mk(), bell: mk(), gtr: mk() };
    // distorted guitar chain for the hidden song
    L.gtrIn = ctx.createGain(); const sh = ctx.createWaveShaper(); sh.curve = makeCurve(400); sh.oversample = '4x';
    const gl = ctx.createBiquadFilter(); gl.type = 'lowpass'; gl.frequency.value = 3200; const gh = ctx.createBiquadFilter(); gh.type = 'highpass'; gh.frequency.value = 90;
    L.gtrIn.connect(sh); sh.connect(gh); gh.connect(gl); gl.connect(L.gtr);
    const gr = ctx.createGain(); gr.gain.value = 0.25; L.gtr.connect(gr); gr.connect(revIn);
    const padRev = ctx.createGain(); padRev.gain.value = 0.6; L.pad.connect(padRev); padRev.connect(revIn);
    const bellRev = ctx.createGain(); bellRev.gain.value = 1; L.bell.connect(bellRev); bellRev.connect(revIn);
    const leadRev = ctx.createGain(); leadRev.gain.value = 0.5; L.lead.connect(leadRev); leadRev.connect(revIn);
    // arp through a feedback delay
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = 0.3; fb.gain.value = 0.38; wet.gain.value = 0.5;
    L.arpIn = ctx.createGain(); L.arpIn.connect(L.arp); L.arpIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(L.arp); wet.connect(revIn);
    L.delay = dl;
    // persistent drone
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 220; df.Q.value = 3; df.connect(L.drone);
    L.droneOsc = [ctx.createOscillator(), ctx.createOscillator(), ctx.createOscillator()];
    L.droneOsc[0].type = 'sawtooth'; L.droneOsc[1].type = 'sawtooth'; L.droneOsc[1].detune.value = 9; L.droneOsc[2].type = 'sine';
    L.droneOsc.forEach((o) => { o.connect(df); o.start(); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(df.frequency); lfo.start();
    L.droneFilter = df;
    Music.setStyle('menu');
    nextT = ctx.currentTime + 0.1;
    setInterval(tick, 25);
  };
  Music.setStyle = (k) => {
    style = STYLES[k] || STYLES.menu;
    if (!ctx || !L.droneOsc) return;
    const f = mf(style.root);
    L.droneOsc[0].frequency.setTargetAtTime(f, ctx.currentTime, 0.5);
    L.droneOsc[1].frequency.setTargetAtTime(f * 1.5, ctx.currentTime, 0.5);
    L.droneOsc[2].frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.5);
    L.delay.delayTime.value = (60 / style.bpm) * 0.75;
    bar = -1; step = 0;
  };
  function chordFor(deg) {
    const s = style.scale;
    return [0, 2, 4].map((i) => { const k = deg + i; return s[k % 7] + 12 * Math.floor(k / 7); });
  }
  function scaleNote(idx) { const s = style.scale; return s[((idx % 7) + 7) % 7] + 12 * Math.floor(idx / 7); }

  function voice(o) {
    const g = ctx.createGain(), fl = ctx.createBiquadFilter();
    fl.type = 'lowpass'; fl.Q.value = o.q || 0.8;
    fl.frequency.setValueAtTime(o.cut, o.t);
    if (o.cut2) fl.frequency.exponentialRampToValueAtTime(o.cut2, o.t + (o.cutT || o.dur));
    const a = o.a || 0.01, r = o.r || 0.1;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.vol, o.t + a);
    g.gain.setValueAtTime(o.vol, o.t + Math.max(a + 0.001, o.dur));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur + r);
    fl.connect(g); g.connect(o.out);
    const dets = o.det || [0];
    dets.forEach((d) => {
      const os = ctx.createOscillator(); os.type = o.type || 'sawtooth';
      os.frequency.value = o.f; os.detune.value = d;
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(o.t); l.stop(o.t + o.dur + r + 0.1); }
      os.connect(fl); os.start(o.t); os.stop(o.t + o.dur + r + 0.1);
    });
  }
  const kick = (t, v = 1) => tone({ t, f: 150, f2: 42, slide: 0.12, dur: 0.4, vol: 0.9 * v, out: L.drums });
  const snare = (t, v = 1) => { noise({ t, dur: 0.2, vol: 0.45 * v, f: 1800, q: 0.7, out: L.drums }); tone({ t, type: 'triangle', f: 200, f2: 140, dur: 0.1, vol: 0.3 * v, out: L.drums }); };
  const hat = (t, v = 1, open) => noise({ t, dur: open ? 0.2 : 0.045, vol: 0.18 * v, type: 'highpass', f: 7500, out: L.drums });
  const tom = (t, f) => tone({ t, f, f2: f * 0.55, dur: 0.3, vol: 0.55, out: L.drums });
  const clank = (t) => { tone({ t, type: 'square', f: 523, dur: 0.12, vol: 0.06, out: L.drums, filter: 'bandpass', ff: 2200, q: 6 }); tone({ t, type: 'square', f: 741, dur: 0.12, vol: 0.06, out: L.drums, filter: 'bandpass', ff: 3100, q: 6 }); };

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (Music.metal) { metalTick(); return; }
    L.gtr.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    Music.cur += (Music.intensity - Music.cur) * 0.02;
    const I = Music.cur, now = ctx.currentTime, T = 0.4;
    L.drone.gain.setTargetAtTime(I < 0.5 ? 0.22 : 0.12, now, T);
    L.pad.gain.setTargetAtTime(0.16 + Math.min(I, 2) * 0.03, now, T);
    L.bell.gain.setTargetAtTime(I < 0.8 ? 0.5 : 0.1, now, T);
    L.bass.gain.setTargetAtTime(I > 0.6 ? Math.min(1, (I - 0.6) * 1.5) * 0.5 : 0, now, T);
    L.drums.gain.setTargetAtTime(I > 0.85 ? Math.min(1, (I - 0.85) * 2) * 0.55 : 0, now, T);
    L.arp.gain.setTargetAtTime(I > 1.3 ? Math.min(1, (I - 1.3) * 1.5) * 0.18 : 0, now, T);
    L.lead.gain.setTargetAtTime(I > 2.3 ? Math.min(1, (I - 2.3) * 2) * 0.16 : 0, now, T);
    L.droneFilter.Q.value = 2 + I;
    const spb = 60 / style.bpm / 4;
    // after a hitch, skip notes whose start has already passed; scheduling in the past makes the envelopes jump (clicks)
    while (nextT < now + LA) { if (step % 16 === 0) bar++; nextT += spb; step++; }
    while (nextT < now + 0.12) { schedule(step, nextT, spb, I); nextT += spb; step++; }
  }

  function schedule(st, t, spb, I) {
    const s16 = st % 16;
    const root = style.root;
    if (s16 === 0) {
      bar++;
      let deg = style.prog[bar % style.prog.length];
      if (Math.random() < 0.12) deg = U.pick([0, 3, 5]);
      chord = chordFor(deg);
      // pad chord (whole bar, overlapping release)
      const cut = 500 + Math.min(I, 3) * 450;
      chord.forEach((n) => voice({ t, f: mf(root + 24 + n), dur: spb * 16, a: 0.7, r: 1.4, vol: 0.07, det: [-9, 9], cut, cut2: cut * 1.6, cutT: spb * 12, out: L.pad }));
      voice({ t, f: mf(root + 12 + chord[0]), dur: spb * 16, a: 0.9, r: 1.5, vol: 0.06, type: 'triangle', cut: 800, out: L.pad });
    }
    // bells (ambient layer)
    if (I < 0.9 && s16 % 4 === 0 && Math.random() < 0.28) {
      const n = root + 48 + U.pick(chord) + (Math.random() < 0.3 ? 12 : 0);
      tone({ t, type: 'triangle', f: mf(n), dur: 1.8, vol: 0.09, out: L.bell });
      tone({ t, f: mf(n + 19), dur: 1.2, vol: 0.02, out: L.bell });
    }
    // drums
    if (I > 0.85) {
      const lvl = I >= 2.2 ? 3 : I >= 1.5 ? 2 : 1;
      const lastBar = bar % 4 === 3;
      if (lvl === 1) {
        if (s16 === 0 || s16 === 10) kick(t);
        if (s16 % 4 === 2 && I > 1.15) hat(t, 0.7);
        if (s16 === 12 && bar % 2 === 1) snare(t, 0.6);
      } else if (lvl === 2) {
        if (s16 === 0 || s16 === 6 || s16 === 8 || (s16 === 14 && Math.random() < 0.4)) kick(t);
        if (s16 === 4 || s16 === 12) snare(t);
        if (s16 % 2 === 0) hat(t, s16 % 4 === 2 ? 1 : 0.6, s16 === 14);
        if (lastBar && s16 >= 12) tom(t, 180 - (s16 - 12) * 25);
      } else {
        if (s16 % 4 === 0 || s16 === 14 || (s16 === 7 && Math.random() < 0.5)) kick(t);
        if (s16 === 4 || s16 === 12 || (s16 === 15 && Math.random() < 0.5)) snare(t, s16 === 15 ? 0.5 : 1);
        hat(t, s16 % 2 ? 0.45 : 0.9);
        if (s16 === 2 || s16 === 10) clank(t);
        if (lastBar && s16 >= 8 && s16 % 2 === 0) tom(t, 200 - (s16 - 8) * 15);
      }
    }
    // bass
    if (I > 0.6) {
      const r = root + chord[0];
      let hitNote = null, dur = spb * 0.9;
      if (I < 1.5) { if (s16 === 0 || s16 === 8) { hitNote = r; dur = spb * 7; } }
      else if (I < 2.2) { if (s16 % 2 === 0) hitNote = (s16 % 8 === 6) ? r + 12 : r; }
      else { if ([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s16)) hitNote = (s16 === 7 || s16 === 15) ? r + 7 : (s16 % 8 === 4 ? r + 12 : r); }
      if (hitNote !== null) voice({ t, f: mf(hitNote), dur, a: 0.005, r: 0.08, vol: 0.32, det: [0, 6], type: 'sawtooth', cut: 900, cut2: 180, cutT: dur, q: 4, out: L.bass });
    }
    // arpeggio
    if (I > 1.3 && Math.random() > 0.08) {
      const seq = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 5];
      const k = seq[s16], n = root + 36 + chord[k % 3] + 12 * Math.floor(k / 3);
      tone({ t, type: bar % 8 < 4 ? 'square' : 'triangle', f: mf(n), dur: spb * 0.8, vol: 0.22, out: L.arpIn, filter: 'lowpass', ff: 2500 });
    }
    // lead melody (boss / high intensity)
    if (I > 2.3) {
      if (leadLeft <= 0 && s16 % 2 === 0) {
        leadNote += U.pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
        leadNote = U.clamp(leadNote, 3, 14);
        const len = U.pick([2, 4, 4, 6, 8]);
        leadLeft = len;
        voice({ t, f: mf(root + 36 + scaleNote(leadNote)), dur: spb * len * 0.95, a: 0.02, r: 0.2, vol: 0.2, det: [-6, 6], type: 'sawtooth', cut: 1800, vib: 6, out: L.lead });
      }
      leadLeft--;
    }
  }

  // ---------------- hidden song: "Chitin & Chrome" (E phrygian thrash, 168 bpm) ----------------
  let mStep = 0, mNext = 0, mBar = 0;
  const RIFFS = [[0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 1, 0, 5, 3, 1, 0], [0, 0, 7, 0, 0, 6, 0, 0, 5, 0, 3, 0, 1, 0, 3, 5], [0, 0, 0, 0, 12, 0, 10, 0, 0, 0, 8, 0, 7, 6, 5, 3]];
  Music.secret = (on) => {
    if (!A.ready) return;
    Music.metal = on; mStep = 0; mBar = 0; mNext = ctx.currentTime + 0.1;
    if (on) Music.stinger('boss');
  };
  function metalTick() {
    const now = ctx.currentTime, T = 0.2;
    for (const k of ['pad', 'bass', 'arp', 'bell', 'drone']) L[k].gain.setTargetAtTime(0, now, T);
    L.drums.gain.setTargetAtTime(0.6, now, T); L.gtr.gain.setTargetAtTime(0.32, now, T); L.lead.gain.setTargetAtTime(0.16, now, T);
    const spb = 60 / 168 / 4, root = 40;
    while (mNext < now + LA) { if (mStep % 16 === 0) mBar++; mNext += spb; mStep++; }
    while (mNext < now + 0.12) {
      const t = mNext, s16 = mStep % 16;
      if (s16 === 0) mBar++;
      if (mBar > 34) { Music.metal = false; return; }
      const section = mBar < 5 ? 0 : mBar < 13 ? 1 : mBar < 21 ? 2 : mBar < 29 ? 1 : 0;
      const riff = RIFFS[mBar % 4 === 3 ? 2 : section === 2 ? 1 : 0], n = riff[s16];
      const accent = s16 === 0 || s16 === 6 || s16 === 10;
      // guitars: chugs + open power chords on accents
      if (accent) [0, 7, 12].forEach((iv) => voice({ t, f: mf(root + n + iv), dur: spb * 2.6, a: 0.003, r: 0.15, vol: 0.12, det: [-7, 7], type: 'sawtooth', cut: 5000, out: L.gtrIn }));
      else voice({ t, f: mf(root + n), dur: spb * 0.55, a: 0.002, r: 0.03, vol: 0.11, det: [-5, 5], type: 'sawtooth', cut: 1100, out: L.gtrIn });
      // drums: double kick, backbeat, crashes
      if (mBar > 1) { kick(t, s16 % 2 ? 0.7 : 1); if (s16 === 4 || s16 === 12) snare(t, 1.2); hat(t, 0.6); if (s16 === 0 && mBar % 2 === 1) noise({ t, dur: 1.2, vol: 0.25, type: 'highpass', f: 5000, out: L.drums }); }
      else if (s16 % 4 === 0) hat(t, 1, true);
      // shred solo over the middle section
      if (section === 2 && s16 % 2 === 0) { const sc = [0, 1, 3, 5, 7, 8, 10], k = (s16 / 2 + mBar * 3) % 14; voice({ t, f: mf(root + 24 + sc[k % 7] + 12 * Math.floor(k / 7)), dur: spb * 1.6, a: 0.005, r: 0.1, vol: 0.14, det: [0], type: 'sawtooth', cut: 3500, vib: 9, out: L.lead }); }
      mNext += spb; mStep++;
    }
  }
  Music.stinger = (kind) => {
    if (!A.ready) return;
    const t = ctx.currentTime + 0.02, r = style.root, o = out({ vol: 0.9, dest: musicBus, rev: 0.6 });
    if (kind === 'round') {
      [0, 7, 12, 15].forEach((n) => voice({ t, f: mf(r + 12 + n), dur: 1.8, a: 0.15, r: 1.2, vol: 0.12, det: [-10, 10], cut: 200, cut2: 2400, cutT: 1.2, out: o }));
      [0, 0.45, 0.9].forEach((d, i) => tone({ t: t + d, f: 80 - i * 8, f2: 40, dur: 0.9, vol: 0.9, out: o }));
    } else if (kind === 'survived') {
      [0, 3, 7, 12, 15, 19].forEach((n, i) => tone({ t: t + i * 0.1, type: 'triangle', f: mf(r + 36 + n), dur: 1.4, vol: 0.18, out: o }));
      voice({ t, f: mf(r + 24), dur: 2, a: 0.3, r: 1.5, vol: 0.12, det: [-8, 8], cut: 900, out: o });
    } else if (kind === 'gameover') {
      [12, 10, 8, 7, 3, 0].forEach((n, i) => voice({ t: t + i * 0.55, f: mf(r + 24 + n), dur: 0.6, a: 0.05, r: 0.8, vol: 0.12, det: [-8, 8], type: 'sawtooth', cut: 900, out: o }));
      tone({ t, f: mf(r), dur: 4, vol: 0.5, a: 0.5, out: o });
    } else if (kind === 'boss') {
      tone({ t, f: 60, f2: 25, dur: 2.5, vol: 1, out: o });
      [0, 1, 6].forEach((n) => voice({ t, f: mf(r + 12 + n), dur: 2.5, a: 0.05, r: 1.5, vol: 0.14, det: [-15, 15], cut: 3000, cut2: 300, cutT: 2.5, out: o }));
    } else if (kind === 'swarm') {
      for (let i = 0; i < 8; i++) tone({ t: t + i * 0.12, type: 'square', f: mf(r + 36 + (i % 2 ? 1 : 0)), dur: 0.1, vol: 0.12, out: o });
      tone({ t, f: 70, f2: 30, dur: 1.5, vol: 0.9, out: o });
    }
  };
})();
