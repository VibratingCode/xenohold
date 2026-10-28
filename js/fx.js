'use strict';
// Particles, tracers, decals, dynamic lights, shockwaves, weather, screen shake.
(function () {
  const U = XH.U;
  const FX = XH.fx = { trauma: 0, particleScale: 1 };
  let scene;
  const col = new THREE.Color();

  const VS = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale;
    void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
      vC.a *= smoothstep(0.35, 2.4, -mv.z);
      gl_PointSize=min(aSize*uScale/max(0.05,-mv.z), 360.0); gl_Position=projectionMatrix*mv; }`;
  const FS = `varying vec4 vC; uniform float uHard;
    void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard;
      float soft=pow(1.0-r*2.0,1.6); float hard=smoothstep(0.5,0.32,r);
      gl_FragColor=vec4(vC.rgb, vC.a*mix(soft,hard,uHard)); }`;

  function makeSystem(cap, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3), colr = new Float32Array(cap * 4), size = new Float32Array(cap);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colr, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uHard: { value: additive ? 0 : 1 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = additive ? 20 : 19;
    const F = () => new Float32Array(cap);
    return { pts, geo, pos, colr, size, cap, head: 0, additive, alive: 0,
      px: F(), py: F(), pz: F(), vx: F(), vy: F(), vz: F(), life: F(), max: F(), s0: F(), s1: F(), r: F(), g: F(), b: F(), a: F(), grav: F(), drag: F() };
  }
  const add = makeSystem(3000, true), nrm = makeSystem(2200, false);

  function emit(S, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const i = S.head; S.head = (i + 1) % S.cap;
    S.px[i] = x; S.py[i] = y; S.pz[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz;
    S.life[i] = life; S.max[i] = life; S.s0[i] = s0; S.s1[i] = s1;
    S.r[i] = r; S.g[i] = g; S.b[i] = b; S.a[i] = a; S.grav[i] = grav; S.drag[i] = drag;
  }
  function updSys(S, dt) {
    const { px, py, pz, vx, vy, vz, life, max, pos, colr, size } = S;
    let alive = 0;
    for (let i = 0; i < S.cap; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; continue; }
      alive++;
      const t = 1 - life[i] / max[i];
      vy[i] -= S.grav[i] * dt;
      const d = Math.exp(-S.drag[i] * dt);
      vx[i] *= d; vy[i] *= d; vz[i] *= d;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      if (py[i] < 0.03 && S.grav[i] > 0) { py[i] = 0.03; vy[i] *= -0.25; vx[i] *= 0.5; vz[i] *= 0.5; }
      const k = i * 3; pos[k] = px[i]; pos[k + 1] = py[i]; pos[k + 2] = pz[i];
      size[i] = S.s0[i] + (S.s1[i] - S.s0[i]) * t;
      const c = i * 4; colr[c] = S.r[i]; colr[c + 1] = S.g[i]; colr[c + 2] = S.b[i];
      colr[c + 3] = S.a[i] * (S.additive ? (1 - t) * (1 - t * 0.3) : (t < 0.75 ? 1 : (1 - t) / 0.25));
    }
    S.alive = alive;
    S.geo.attributes.position.needsUpdate = true;
    S.geo.attributes.aColor.needsUpdate = true;
    S.geo.attributes.aSize.needsUpdate = true;
  }

  // ---------- generic burst ----------
  // o: {pos, n, color, color2, speed:[a,b], dir, spread(0..1), life:[a,b], size:[s0,s1], grav, drag, add, alpha, up, jitter}
  const _d = new THREE.Vector3(), _t = new THREE.Vector3();
  FX.burst = (o) => {
    const n = Math.max(1, Math.round((o.n || 10) * FX.particleScale));
    const S = o.add === false ? nrm : add;
    const c1 = col.set(o.color === undefined ? 0xffffff : o.color).clone();
    const c2 = o.color2 !== undefined ? new THREE.Color(o.color2) : c1;
    const sp = o.speed || [1, 4], lf = o.life || [0.3, 0.8], sz = o.size || [0.2, 0.05];
    const spread = o.spread === undefined ? 1 : o.spread, jit = o.jitter || 0;
    for (let i = 0; i < n; i++) {
      _d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      if (o.dir) { _t.copy(o.dir).normalize(); _d.multiplyScalar(spread).add(_t).normalize(); }
      if (o.up) _d.y = Math.abs(_d.y) * o.up;
      const s = U.rand(sp[0], sp[1]), m = Math.random();
      emit(S, o.pos.x + (Math.random() - .5) * jit, o.pos.y + (Math.random() - .5) * jit, o.pos.z + (Math.random() - .5) * jit,
        _d.x * s, _d.y * s, _d.z * s, U.rand(lf[0], lf[1]),
        sz[0] * U.rand(0.7, 1.3), sz[1] * U.rand(0.7, 1.3),
        c1.r + (c2.r - c1.r) * m, c1.g + (c2.g - c1.g) * m, c1.b + (c2.b - c1.b) * m,
        o.alpha === undefined ? 1 : o.alpha, o.grav || 0, o.drag === undefined ? 1 : o.drag);
    }
  };
  FX.one = (x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, grav = 0, drag = 1, additive = true) => {
    col.set(color);
    emit(additive ? add : nrm, x, y, z, vx, vy, vz, life, s0, s1, col.r, col.g, col.b, alpha, grav, drag);
  };

  // ---------- presets ----------
  FX.ichor = (pos, dir, color = 0xb8e04a, amt = 1) => {
    FX.burst({ pos, n: 10 * amt, color, color2: 0x4a7a10, speed: [2, 6], dir, spread: 0.8, life: [0.4, 0.9], size: [0.12, 0.08], grav: 14, drag: 1.5, add: false });
    FX.burst({ pos, n: 3 * amt, color, speed: [0.3, 1], life: [0.2, 0.4], size: [0.3, 0.5], add: false, alpha: 0.3 });
  };
  FX.sparks = (pos, normal) => {
    FX.burst({ pos, n: 7, color: 0xffd080, color2: 0xff7a20, speed: [3, 9], dir: normal, spread: 0.9, life: [0.15, 0.4], size: [0.07, 0.02], grav: 12, drag: 2 });
    FX.burst({ pos, n: 3, color: 0x777777, speed: [0.3, 1.2], dir: normal, spread: 0.6, life: [0.4, 0.9], size: [0.2, 0.5], add: false, alpha: 0.35 });
  };
  FX.dirt = (pos, n = 14, color = 0x3a2f28) => {
    FX.burst({ pos, n, color, color2: 0x1d1612, speed: [2, 6], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [0.5, 1.1], size: [0.18, 0.1], grav: 14, drag: 1, add: false });
    FX.burst({ pos, n: n / 2, color: 0x5a4a40, speed: [0.5, 1.5], up: 1, life: [0.8, 1.5], size: [0.5, 1.2], add: false, alpha: 0.35 });
  };
  FX.explosion = (pos, r = 4, color = 0xff8a2a) => {
    FX.burst({ pos, n: 40, color: 0xfff0b0, color2: color, speed: [2, r * 3], life: [0.25, 0.6], size: [1.2, 0.2] });
    FX.burst({ pos, n: 24, color: 0xffa040, speed: [4, r * 4], life: [0.3, 0.9], size: [0.12, 0.04], grav: 10, drag: 1.2 });
    FX.burst({ pos, n: 18, color: 0x2a2522, color2: 0x55504a, speed: [1, r * 1.2], up: 1, life: [1, 2.2], size: [1, 3], add: false, alpha: 0.5, drag: 1.5 });
    FX.flash(pos, color, 6, 0.35, r * 4);
    FX.ring(pos, r * 1.3, color, 0.4);
    FX.decal(pos, 'scorch', r * 0.5);
    FX.shake(Math.min(1, 0.5 * r / 4));
  };
  FX.acidBurst = (pos, r = 4) => {
    FX.burst({ pos, n: 32, color: 0xc8ff50, color2: 0x50c010, speed: [2, r * 3], life: [0.25, 0.6], size: [0.7, 0.12] });
    FX.burst({ pos, n: 30, color: 0xa0e030, color2: 0x3a7a10, speed: [3, 9], up: 1, life: [0.5, 1.1], size: [0.18, 0.1], grav: 14, add: false });
    FX.burst({ pos, n: 10, color: 0x6a8a30, speed: [0.5, 2], up: 1, life: [0.6, 1.2], size: [1, 2.2], add: false, alpha: 0.18 });
    FX.flash(pos, 0x9dff3a, 5, 0.4, r * 4);
    FX.ring(pos, r * 1.2, 0x9dff3a, 0.35);
  };
  FX.muzzle = (pos, color = 0xffc070) => {
    FX.burst({ pos, n: 4, color, speed: [1, 3], life: [0.03, 0.08], size: [0.25, 0.05] });
  };
  FX.fire = (pos, dir, strong = 1) => {
    FX.burst({ pos, n: 5 * strong, color: 0xffe080, color2: 0xff3a00, speed: [12, 17], dir, spread: 0.12, life: [0.3, 0.55], size: [0.2, 1.4], drag: 2.5 });
    if (Math.random() < 0.4) FX.burst({ pos, n: 1, color: 0x332a24, speed: [6, 9], dir, spread: 0.2, life: [0.6, 1], size: [0.4, 1.6], add: false, alpha: 0.35, drag: 2, grav: -2 });
  };
  FX.frost = (pos, dir) => FX.burst({ pos, n: 4, color: 0xe0f8ff, color2: 0x60c0ff, speed: [8, 14], dir, spread: 0.15, life: [0.25, 0.45], size: [0.15, 0.5], drag: 3 });
  FX.shatter = (pos) => {
    FX.burst({ pos, n: 30, color: 0xe8f8ff, color2: 0x80c8ff, speed: [2, 8], life: [0.4, 1], size: [0.14, 0.05], grav: 14, add: false });
    FX.burst({ pos, n: 16, color: 0xa0e0ff, speed: [1, 4], life: [0.3, 0.6], size: [0.4, 0.1] });
  };
  FX.electric = (pos) => FX.burst({ pos, n: 8, color: 0xc0e0ff, color2: 0x6080ff, speed: [2, 7], life: [0.1, 0.3], size: [0.12, 0.02] });
  FX.embers = (pos, n = 6) => FX.burst({ pos, n, color: 0xffa040, color2: 0xff4010, speed: [0.5, 2], up: 1, life: [0.5, 1.2], size: [0.1, 0.02], grav: -2, jitter: 0.8 });

  // ---------- tracers / bolts ----------
  const TCAP = 400;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(TCAP * 6), tCol = new Float32Array(TCAP * 6);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3).setUsage(THREE.DynamicDrawUsage));
  const tracerLines = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracerLines.frustumCulled = false; tracerLines.renderOrder = 21;
  const tr = { life: new Float32Array(TCAP), max: new Float32Array(TCAP), c: new Float32Array(TCAP * 3), head: 0 };
  FX.tracer = (a, b, color = 0xffe0a0, life = 0.06) => {
    const i = tr.head; tr.head = (i + 1) % TCAP;
    tPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    col.set(color); tr.c[i * 3] = col.r; tr.c[i * 3 + 1] = col.g; tr.c[i * 3 + 2] = col.b;
    tr.life[i] = life; tr.max[i] = life;
  };
  const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
  FX.bolt = (a, b, color = 0x9fc8ff, life = 0.12, segs = 8, jag = 0.5) => {
    _p0.copy(a);
    for (let s = 1; s <= segs; s++) {
      _p1.lerpVectors(a, b, s / segs);
      if (s < segs) _p1.add(_t.set((Math.random() - .5) * jag, (Math.random() - .5) * jag, (Math.random() - .5) * jag));
      FX.tracer(_p0, _p1, color, life);
      _p0.copy(_p1);
    }
  };
  function updTracers(dt) {
    for (let i = 0; i < TCAP; i++) {
      if (tr.life[i] <= 0) { continue; }
      tr.life[i] -= dt;
      const f = Math.max(0, tr.life[i] / tr.max[i]);
      for (let v = 0; v < 2; v++) for (let k = 0; k < 3; k++) tCol[i * 6 + v * 3 + k] = tr.c[i * 3 + k] * f;
      if (tr.life[i] <= 0) tPos.fill(0, i * 6, i * 6 + 6);
    }
    tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true;
  }

  // ---------- decals ----------
  function splatTex(hard) {
    const c = U.canvas(128), x = c.getContext('2d');
    for (let i = 0; i < (hard ? 18 : 1); i++) {
      const r = hard ? U.rand(8, 30) : 60, px = hard ? 64 + U.rand(-30, 30) : 64, py = hard ? 64 + U.rand(-30, 30) : 64;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard ? 0.7 : 0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  const splatT = splatTex(true), softT = splatTex(false);
  FX.softTex = softT;
  const decalMats = {
    ichor: new THREE.MeshBasicMaterial({ map: splatT, color: 0x6a8a18, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    purple: new THREE.MeshBasicMaterial({ map: splatT, color: 0x5a1a4a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    scorch: new THREE.MeshBasicMaterial({ map: splatT, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    hole: new THREE.MeshBasicMaterial({ map: softT, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  };
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  const decals = [], DCAP = 140; let dHead = 0;
  const holes = [], HCAP = 120; let hHead = 0;
  FX.decal = (pos, kind = 'ichor', size = 1) => {
    let m = decals[dHead];
    if (!m) { m = new THREE.Mesh(decalGeo, decalMats[kind]); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; decals[dHead] = m; scene.add(m); }
    dHead = (dHead + 1) % DCAP;
    m.material = decalMats[kind]; m.visible = true;
    m.position.set(pos.x, 0.015 + Math.random() * 0.01, pos.z);
    m.rotation.z = Math.random() * 6.28;
    m.scale.setScalar(size * U.rand(0.8, 1.3));
  };
  const _n = new THREE.Vector3();
  FX.hole = (pos, normal) => {
    let m = holes[hHead];
    if (!m) { m = new THREE.Mesh(decalGeo, decalMats.hole); holes[hHead] = m; scene.add(m); }
    hHead = (hHead + 1) % HCAP;
    m.visible = true;
    m.position.copy(pos).addScaledVector(normal, 0.01);
    _n.copy(pos).add(normal); m.lookAt(_n);
    m.scale.setScalar(U.rand(0.12, 0.2));
  };

  // ---------- dynamic lights ----------
  const lights = [];
  FX.flash = (pos, color, intensity = 3, dur = 0.1, dist = 12) => {
    let best = lights[0];
    for (const l of lights) if (l.t <= 0) { best = l; break; } else if (l.t < best.t) best = l;
    best.light.position.copy(pos); best.light.color.set(color); best.light.distance = dist;
    best.base = intensity; best.t = dur; best.dur = dur;
  };
  function updLights(dt) {
    for (const l of lights) {
      if (l.t > 0) { l.t -= dt; const f = Math.max(0, l.t / l.dur); l.light.intensity = l.base * f * f; }
      else l.light.intensity = 0;
    }
  }

  // ---------- shockwave rings ----------
  const rings = [];
  FX.ring = (pos, radius, color = 0xffffff, dur = 0.4) => {
    let r = rings.find((q) => q.t <= 0) || rings[0];
    r.mesh.position.set(pos.x, Math.max(0.1, pos.y * 0.3), pos.z);
    r.mesh.material.color.set(color); r.t = dur; r.dur = dur; r.radius = radius; r.mesh.visible = true;
  };
  function updRings(dt) {
    for (const r of rings) {
      if (r.t <= 0) { r.mesh.visible = false; continue; }
      r.t -= dt; const f = 1 - r.t / r.dur;
      r.mesh.scale.setScalar(0.2 + r.radius * U.smooth(f));
      r.mesh.material.opacity = (1 - f) * 0.8;
    }
  }

  // ---------- shake ----------
  FX.shake = (a) => { FX.trauma = Math.min(1, FX.trauma + a); };
  FX.shakeOffset = { x: 0, y: 0, r: 0 };
  function updShake(dt, time) {
    FX.trauma = Math.max(0, FX.trauma - dt * 1.6);
    const s = FX.trauma * FX.trauma * (FX.shakeScale === undefined ? 1 : FX.shakeScale);
    FX.shakeOffset.x = s * 0.08 * (U.tnoise(time * 25, 1.3, 256) * 2 - 1);
    FX.shakeOffset.y = s * 0.08 * (U.tnoise(time * 25, 7.1, 256) * 2 - 1);
    FX.shakeOffset.r = s * 0.05 * (U.tnoise(time * 20, 13.7, 256) * 2 - 1);
  }

  // ---------- blob shadow ----------
  const shadowTex = (() => {
    const c = U.canvas(64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  FX.shadow = (r) => { const m = new THREE.Mesh(decalGeo, shadowMat); m.rotation.x = -Math.PI / 2; m.scale.set(r * 2.2, r * 2.2, 1); m.position.y = 0.02; m.renderOrder = 1; return m; };

  // ---------- glow sprite texture (shared) ----------
  FX.glowTex = (() => {
    const c = U.canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.7)'); g.addColorStop(0.5, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  FX.glowSprite = (color, size, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size); return s;
  };

  // ---------- weather ----------
  const W = { type: 'none', obj: null, n: 0 };
  FX.setWeather = (type, color, mul = 1) => {
    if (W.obj) { scene.remove(W.obj); W.obj.geometry.dispose(); W.obj = null; }
    W.type = type;
    if (type === 'none') return;
    if (type === 'rain') {
      const n = Math.round(1400 * mul); W.n = n;
      const g = new THREE.BufferGeometry(), p = new Float32Array(n * 6);
      W.data = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { W.data[i * 3] = U.rand(-30, 30); W.data[i * 3 + 1] = U.rand(0, 16); W.data[i * 3 + 2] = U.rand(-30, 30); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
      W.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color || 0x8aa8c8, transparent: true, opacity: 0.35, depthWrite: false }));
    } else {
      const n = Math.round((type === 'snow' ? 1800 : type === 'ash' ? 1400 : type === 'dust' ? 1600 : type === 'fireflies' ? 260 : type === 'embers' ? 500 : 400) * mul); W.n = n;
      const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 4), s = new Float32Array(n);
      W.data = new Float32Array(n * 4);
      const cc = new THREE.Color(color || (type === 'snow' ? 0xeef6ff : type === 'ash' ? 0x8a8290 : type === 'dust' ? 0xc8a070 : type === 'fireflies' ? 0xd8ff70 : type === 'embers' ? 0xff7a30 : 0xa0ffb0)), ember = new THREE.Color(0xff7a30);
      for (let i = 0; i < n; i++) {
        W.data[i * 4] = U.rand(-30, 30); W.data[i * 4 + 1] = U.rand(0, 14); W.data[i * 4 + 2] = U.rand(-30, 30); W.data[i * 4 + 3] = Math.random() * 100;
        const q = type === 'ash' && Math.random() < 0.06 ? ember : cc;
        c[i * 4] = q.r; c[i * 4 + 1] = q.g; c[i * 4 + 2] = q.b; c[i * 4 + 3] = type === 'snow' ? 0.8 : type === 'ash' ? (q === ember ? 0.95 : 0.5) : type === 'dust' ? 0.42 : 0.9;
        s[i] = type === 'snow' ? U.rand(0.05, 0.12) : type === 'ash' ? U.rand(0.035, 0.085) : type === 'dust' ? U.rand(0.04, 0.1) : type === 'fireflies' ? U.rand(0.05, 0.09) : type === 'embers' ? U.rand(0.04, 0.1) : U.rand(0.03, 0.07);
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aColor', new THREE.BufferAttribute(c, 4));
      g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uScale: add.pts.material.uniforms.uScale, uHard: { value: 0 } },
        vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
        blending: type === 'snow' || type === 'ash' || type === 'dust' ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      W.obj = new THREE.Points(g, mat);
    }
    W.obj.frustumCulled = false;
    scene.add(W.obj);
  };
  function updWeather(dt, cam, time) {
    if (!W.obj) return;
    const cx = cam.position.x, cz = cam.position.z, p = W.obj.geometry.attributes.position.array, d = W.data;
    const wrap = (v, c) => { const r = v - c; return r > 30 ? v - 60 : r < -30 ? v + 60 : v; };
    if (W.type === 'rain') {
      for (let i = 0; i < W.n; i++) {
        let x = d[i * 3] + 2 * dt, y = d[i * 3 + 1] - 22 * dt, z = d[i * 3 + 2] + 0.8 * dt;
        if (y < 0) { y += 16; if (Math.random() < 0.02) FX.one(x, 0.05, z, 0, 1, 0, 0.15, 0.05, 0.15, 0x8aa8c8, 0.4, 0, 1, false); }
        x = wrap(x, cx); z = wrap(z, cz);
        d[i * 3] = x; d[i * 3 + 1] = y; d[i * 3 + 2] = z;
        p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z; p[i * 6 + 3] = x - 0.08; p[i * 6 + 4] = y + 0.7; p[i * 6 + 5] = z - 0.03;
      }
    } else {
      const fall = W.type === 'snow' ? -1.6 : W.type === 'ash' ? -0.6 : W.type === 'dust' ? -0.2 : W.type === 'fireflies' ? 0 : W.type === 'embers' ? 1.1 : 0.15;
      for (let i = 0; i < W.n; i++) {
        const ph = d[i * 4 + 3];
        let x = d[i * 4] + Math.sin(time * 0.7 + ph) * 0.6 * dt + (W.type === 'snow' ? 1.2 * dt : W.type === 'ash' ? 0.9 * dt : W.type === 'dust' ? 7 * dt : 0) + (W.type === 'fireflies' ? Math.sin(time * 2.3 + ph * 3) * 0.8 * dt : 0);
        let y = d[i * 4 + 1] + fall * dt;
        let z = d[i * 4 + 2] + Math.cos(time * 0.6 + ph) * 0.6 * dt;
        if (y < 0) y += 14; if (y > 14) y -= 14;
        x = wrap(x, cx); z = wrap(z, cz);
        d[i * 4] = x; d[i * 4 + 1] = y; d[i * 4 + 2] = z;
        p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      }
    }
    W.obj.geometry.attributes.position.needsUpdate = true;
    if (W.type === 'fireflies') { const ca = W.obj.geometry.attributes.aColor; for (let i = 0; i < W.n; i++) ca.array[i * 4 + 3] = Math.max(0, Math.sin(time * 2.1 + d[i * 4 + 3] * 5)) * 0.95; ca.needsUpdate = true; }
  }

  // ---------- lifecycle ----------
  FX.init = (sc) => {
    scene = sc;
    scene.add(add.pts, nrm.pts, tracerLines);
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 12, 2); scene.add(l); lights.push({ light: l, t: 0, dur: 1, base: 0 }); }
    const rg = new THREE.RingGeometry(0.85, 1, 48); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); rings.push({ mesh: m, t: 0, dur: 1, radius: 1 });
    }
  };
  FX.resize = (h, fov) => {
    const s = h / (2 * Math.tan((fov * Math.PI / 180) / 2));
    add.pts.material.uniforms.uScale.value = s;
    nrm.pts.material.uniforms.uScale.value = s;
  };
  FX.clear = () => {
    for (const S of [add, nrm]) { S.life.fill(0); S.size.fill(0); S.geo.attributes.aSize.needsUpdate = true; }
    tr.life.fill(0); tPos.fill(0);
    for (const m of decals) if (m) m.visible = false;
    for (const m of holes) if (m) m.visible = false;
    for (const r of rings) r.t = 0;
    FX.trauma = 0;
  };
  FX.update = (dt, cam, time) => {
    updSys(add, dt); updSys(nrm, dt); updTracers(dt); updLights(dt); updRings(dt); updShake(dt, time); updWeather(dt, cam, time);
  };
  FX.stats = () => add.alive + nrm.alive;
})();
