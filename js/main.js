'use strict';
// Boot, renderer, post-processing, menu backgrounds, bestiary stage, main loop.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, P = XH.player, WP = XH.weapons, E = XH.enemies, Gm = XH.game, W = XH.world, UI = XH.ui, MON = XH.monsters;
  const canvas = U.$('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  // procedural studio environment for reflections (metal guns, glossy chitin)
  // k scales the whole environment: a dim copy is swapped in while a map's power is out
  const makeEnv = (k) => {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 24, 12), col = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10, c = new THREE.Color(0x0c0e12).lerp(new THREE.Color(0x56606c), U.clamp(y * 0.8 + 0.35, 0, 1)).multiplyScalar(k); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    panel(0, 8, 2, 8, 3, 0xd8e4f0); panel(-7, 3, -5, 3, 5, 0x7aa8d0); panel(7, 2, 5, 3, 4, 0xd0a070);
    const t = pm.fromScene(es, 0.03).texture; pm.dispose(); return t;
  };
  const envTex = makeEnv(1), envDark = makeEnv(0.18);
  scene.environment = envTex;
  FX.init(scene); WP.initVM(); WP.vmScene.environment = envTex; WP.initScene(scene); E.init(scene); Gm.init(scene);
  MON.warm();
  P.bindInput(canvas);
  UI.init();

  let bCam = null; // bestiary camera (created below)
  const M = XH.main = { mode: 'menu', paused: false, menuMap: null, creatures: [], orbit: 0, env: { lit: envTex, dark: envDark } };
  let rawUnsupported = false;
  const lockFailed = () => { if (Gm.state === 'playing') { M.paused = true; U.$('clicklock').classList.remove('hidden'); } };
  const lock = () => {
    try {
      const raw = P.settings.rawInput && !rawUnsupported;
      const r = raw ? canvas.requestPointerLock({ unadjustedMovement: true }) : canvas.requestPointerLock();
      if (r && r.catch) r.catch((err) => {
        if (raw && err && err.name === 'NotSupportedError') { rawUnsupported = true; const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(lockFailed); }
        else lockFailed();
      });
    } catch (e) { /* ignore */ }
  };

  // ---------------- post-processing ----------------
  let composer = null, rp = null, vp = null, bloom = null;
  try {
    if (THREE.EffectComposer && THREE.UnrealBloomPass) {
      composer = new THREE.EffectComposer(renderer);
      rp = new THREE.RenderPass(scene, P.cam); composer.addPass(rp);
      vp = new THREE.RenderPass(WP.vmScene, WP.vmCam); vp.clear = false; vp.clearDepth = true; composer.addPass(vp);
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.72); composer.addPass(bloom);
    }
  } catch (e) { console.warn('Post-processing unavailable', e); composer = null; }

  M.applySettings = () => {
    const S = P.settings;
    const pr = ({ low: 0.75, medium: 1, high: Math.min(devicePixelRatio, 1.5) }[S.quality] || 1) * (M.resScale ? M.resScale() : 1);
    if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); if (composer && composer.setPixelRatio) composer.setPixelRatio(pr); resize(); }
    A.vol.master = S.master; A.vol.music = S.music; A.vol.sfx = S.sfx; A.vol.weather = S.weather === undefined ? 1 : S.weather; A.applyVolume();
    A.announcer = S.announcer; A.hiveOn = S.hiveVoice !== false; FX.particleScale = S.particles;
    if (!A.hiveOn) { if (A.hiveSpeaking && window.speechSynthesis) { speechSynthesis.cancel(); A.hiveSpeaking = false; } if (XH.ui && XH.ui.subtitle) XH.ui.subtitle(''); } FX.shakeScale = S.shake;
    U.$('minimap').classList.toggle('hidden', !S.minimap);
    U.$('fps').classList.toggle('hidden', !S.fps);
  };
  M.applySettings();
  M.drawCalls = () => renderer.info.render.calls;
  M.renderer = renderer; // diagnostics

  function resize() {
    const [vw, vh] = M.viewSize ? M.viewSize() : [innerWidth, innerHeight];
    renderer.setSize(vw, vh);
    P.cam.aspect = vw / vh; P.cam.updateProjectionMatrix();
    if (bCam) { bCam.aspect = innerWidth / innerHeight; bCam.updateProjectionMatrix(); }
    WP.updateAspect(innerWidth / innerHeight);
    if (composer) { composer.setSize(vw, vh); }
  }
  addEventListener('resize', resize);

  // ---------------- menu background ----------------
  function clearCreatures() { for (const c of M.creatures) { scene.remove(c.m.root); if (c.m.skeleton) c.m.skeleton.dispose(); c.m.mats.forEach((q) => q.dispose()); } M.creatures = []; }
  M.previewMap = (def) => {
    if (M.menuMap === def.id) return;
    M.menuMap = def.id;
    clearCreatures(); E.clear(); FX.clear();
    if (Gm.box) { scene.remove(Gm.box.group); Gm.box = null; }
    W.build(def, scene);
    if (def.power) W.setPower(true, true); // the menu backdrop shows the arena lit
    FX.setWeather(def.weather, def.weatherColor);
    A.ambience(def.weather);
    const s = W.start;
    const place = [['behemoth', 5, -7, 0.4], ['skitterling', -3, -4, 0], ['skitterling', -1.5, -6, 0], ['skitterling', 2, -4.5, 0], ['lancer', -5, -8, 0], ['burster', 0.5, -3, 0], ['shrieker', 3, -9, 3.4]];
    for (const [t, dx, dz, y] of place) {
      const x = s.x + dx, z = s.z + dz;
      if (W.blockedAt(x, z, 1)) continue;
      const m = MON.create(t); m.root.position.set(x, y, z); m.root.rotation.y = Math.atan2(-dx, -dz) + U.rand(-0.4, 0.4);
      scene.add(m.root);
      M.creatures.push({ t, m, st: { t: Math.random() * 10, phase: Math.random() * 6, move: 0, atk: -1, cast: -1, seed: Math.random() * 9, spit: -1, rollSpeed: 0 }, next: U.rand(2, 5) });
    }
  };
  function updateMenu(dt, t) {
    M.orbit += dt * 0.06;
    const s = W.start || new THREE.Vector3();
    const cx = s.x, cz = s.z - 4;
    P.cam.position.set(cx + Math.sin(M.orbit) * 13, 4.2 + Math.sin(t * 0.2) * 0.5, cz + Math.cos(M.orbit) * 13);
    P.cam.fov = 60; P.cam.updateProjectionMatrix();
    P.cam.lookAt(cx, 1.6, cz);
    for (const c of M.creatures) {
      c.st.t += dt; c.next -= dt;
      if (c.next <= 0) { c.next = U.rand(3, 7); c.attackT = 0; if (Math.random() < 0.5) A.play(E.TYPES[c.t].vocal, { pos: c.m.root.position, vol: 0.25 }); }
      if (c.attackT !== undefined && c.attackT >= 0) { c.attackT += dt; c.st.atk = c.attackT / 1.1; c.st.cast = c.st.atk; if (c.attackT > 1.1) { c.attackT = -1; c.st.atk = -1; c.st.cast = -1; } }
      c.st.phase += dt * 1.5; c.st.move = 0.15; c.st.rollSpeed = 0.5;
      MON.animate(c.t, c.m.rig, c.st, dt);
    }
    A.listener.x = P.cam.position.x; A.listener.z = P.cam.position.z;
  }

  // ---------------- bestiary stage ----------------
  const bScene = new THREE.Scene();
  bScene.background = new THREE.Color(0x06080b); bScene.fog = new THREE.Fog(0x06080b, 14, 45);
  bCam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
  bScene.add(new THREE.HemisphereLight(0x8a9ab8, 0x301020, 0.75));
  const key = new THREE.DirectionalLight(0xffe0c0, 0.6); key.position.set(5, 8, 7); bScene.add(key);
  const rim = new THREE.DirectionalLight(0xb060ff, 0.7); rim.position.set(-6, 4, -8); bScene.add(rim);
  const under = new THREE.PointLight(0x40ff90, 1.2, 12); under.position.set(0, 0.3, 2); bScene.add(under);
  {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x120c16, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; bScene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.5, 64), new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; bScene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.25, 64), new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity: 0.35 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.01; bScene.add(ring2);
  }
  const B = { m: null, t: null, anim: 'move', st: null, size: 3, ang: 0.6 };
  const FRAME = { skitterling: 3.2, lancer: 5, burster: 2.8, shrieker: 5.5, behemoth: 10, broodmother: 8.5, broodling: 1.6, burrower: 6.5, tyrant: 14 };
  M.bestiary = (t) => {
    if (B.m) bScene.remove(B.m.root);
    // variants (map creatures, alternate bosses) animate as their base species and frame by their size
    const vd = E.TYPES[t], base = (vd && vd.base) || t, sc = (vd && vd.base && vd.model && vd.model.scale) || 1;
    B.m = MON.create(t); B.t = base; B.anim = 'move';
    B.st = { t: 0, phase: 0, move: 1, atk: -1, cast: -1, seed: 1, spit: -1, rollSpeed: 0, fuse: 0 };
    if (base === 'shrieker') B.m.root.position.y = 2.2 * sc;
    bScene.add(B.m.root); B.size = (FRAME[base] || 4) * sc;
  };
  M.bestiaryAnim = (a) => { B.anim = a; B.at = 0; };
  function updateBestiary(dt) {
    if (!B.m) return;
    const st = B.st; st.t += dt; B.at = (B.at || 0) + dt;
    B.ang += dt * 0.25;
    const sz = B.size;
    const d = sz * 1.45;
    bCam.position.set(Math.sin(B.ang) * d, sz * 0.4 + 0.5, Math.cos(B.ang) * d);
    bCam.lookAt(0, sz * 0.2, 0);
    // center the projection on the middle stage column
    const r = U.$('bstage').getBoundingClientRect();
    if (r.width > 0) bCam.setViewOffset(innerWidth, innerHeight, innerWidth / 2 - (r.left + r.width / 2), 0, innerWidth, innerHeight);
    st.move = 0; st.atk = -1; st.cast = -1; st.spit = -1; st.act = ''; st.fuse = 0; st.rollSpeed = 0; st.charge = 0; st.fold = false; st.leap = 0; st.leapPitch = 0;
    const cyc = (d) => (B.at % d) / d;
    if (B.anim === 'move') { st.move = 1; st.phase += dt * (B.t === 'behemoth' || B.t === 'tyrant' ? 2.2 : 7); st.rollSpeed = 6; }
    else if (B.anim === 'attack') { st.atk = cyc(1.4); if (B.t === 'burrower') st.atk = cyc(1.6); if (B.t === 'tyrant') { st.act = 'slam'; st.actT = cyc(2); } }
    else if (B.anim === 'special') {
      const k = cyc(2.2);
      if (B.t === 'lancer' || B.t === 'shrieker') st.cast = k;
      else if (B.t === 'broodmother') { st.cast = k; }
      else if (B.t === 'burster') st.fuse = k;
      else if (B.t === 'behemoth') { st.charge = Math.sin(Math.PI * k); st.move = st.charge; st.phase += dt * 6 * st.charge; }
      else if (B.t === 'burrower') st.fold = k < 0.5;
      else if (B.t === 'skitterling') { st.leap = Math.sin(Math.PI * k) * 0.9; st.leapPitch = (0.5 - k) * 0.6; }
      else if (B.t === 'tyrant') { const acts = ['barrage', 'roar', 'slam']; st.act = acts[Math.floor(B.at / 2.2) % 3]; st.actT = k; }
      else { st.atk = k; }
    }
    MON.animate(B.t, B.m.rig, st, dt);
  }

  // ---------------- modes ----------------
  M.setMode = (mode) => {
    M.mode = mode;
    UI.hideHud();
    if (mode === 'menu') {
      if (!M.menuMap) M.previewMap(XH.MAPS[UI.mapSel || 0]);
      A.music.setStyle('menu'); A.music.intensity = 0;
    }
  };
  M.startGame = (def, round, mods) => {
    A.init();
    UI.show(null);
    U.$('loading').classList.remove('hidden'); U.$('ldSub').textContent = def.name.toUpperCase();
    if (!XH.DEBUG && !(XH.gamepad && XH.gamepad.active)) lock();
    setTimeout(() => {
      clearCreatures();
      M.menuMap = null;
      Gm.start(def, round || 1, mods);
      M.warmup();
      M.mode = 'game'; M.paused = false;
      P.cam.fov = P.settings.fov; P.cam.updateProjectionMatrix();
      U.$('loading').classList.add('hidden');
      if (M.afterStart) { const f = M.afterStart; M.afterStart = null; try { f(); } catch (e) { console.warn(e); } }
      if (!XH.DEBUG && !document.pointerLockElement && !(XH.gamepad && XH.gamepad.active)) { M.paused = true; U.$('clicklock').classList.remove('hidden'); }
    }, 60);
  };
  // Compile shaders while the loading screen is up, so the first gun swap, upgrade or wonder weapon does not stutter.
  M.warmup = () => {
    try {
      const g = new THREE.Group();
      for (const [id, up] of [['p9', true], ['pulse', false], ['breacher', true], ['rail', false], ['void', false], ['inferno', false], ['thunderclap', false], ['broodlauncher', false]]) if (WP.DEFS[id]) g.add(WP.model(id, up));
      g.traverse((o) => { o.frustumCulled = false; });
      WP.vmScene.add(g); renderer.compile(WP.vmScene, WP.vmCam); WP.vmScene.remove(g);
      // one of each creature, so the first of each kind to appear does not stall on its shaders
      const crew = Object.keys(MON.DEFS).filter((t) => !MON.DEFS[t].base).map((t) => MON.create(t));
      for (const m of crew) { m.root.traverse((o) => { o.frustumCulled = false; }); scene.add(m.root); }
      renderer.compile(scene, P.cam);
      for (const m of crew) { scene.remove(m.root); m.skeleton.dispose(); m.mats.forEach((q) => q.dispose()); }
    } catch (e) { console.warn('warmup', e); }
  };
  M.pause = () => {
    if (Gm.state !== 'playing' || M.mode !== 'game' || M.paused) return;
    M.paused = true; WP.setTrigger(false); WP.setAds(false); A.stopLoops();
    UI.pauseInfo(); UI.show('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  M.resume = () => {
    U.$('clicklock').classList.add('hidden');
    if (XH.DEBUG || (XH.gamepad && XH.gamepad.active)) { M.paused = false; UI.show(null); U.$('hud').classList.remove('hidden'); return; }
    lock();
  };
  M.quitToMenu = (to = 'main') => {
    Gm.quit(); M.paused = false; M.mode = 'menu'; M.menuMap = null;
    U.$('clicklock').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    UI.show(to);
  };
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      if (Gm.state === 'playing') { M.paused = false; UI.show(null); if (!XH.sys.intro) U.$('hud').classList.remove('hidden'); U.$('clicklock').classList.add('hidden'); }
    } else if (Gm.state === 'playing' && M.mode === 'game') {
      M.paused = true; WP.setTrigger(false); WP.setAds(false); A.stopLoops();
      UI.pauseInfo(); UI.show('pause');
    }
  });
  document.addEventListener('pointerlockerror', () => { if (Gm.state === 'playing' && !(XH.gamepad && XH.gamepad.active)) { M.paused = true; U.$('clicklock').classList.remove('hidden'); UI.show(null); } });
  canvas.addEventListener('click', () => { if (Gm.state === 'playing' && !document.pointerLockElement && !XH.DEBUG && UI.cur === null) lock(); });

  // ---------------- loop ----------------
  let last = performance.now(), simT = 0;
  renderer.info.autoReset = false;
  function simulate(dt) {
    simT += dt;
    if (!M.paused) A.ambientTick(dt);
    const t = simT;
    let cam = P.cam, sc = scene, showVM = false;
    if (M.mode === 'game') {
      if (Gm.state === 'playing' && !M.paused && XH.sys.intro) {
        P.consumeInput();
        XH.sys.updateIntro(dt, P.cam);
        W.update(dt, t); FX.update(dt, P.cam, t);
      } else if (Gm.state === 'playing' && !M.paused) {
        const input = P.consumeInput();
        P.update(dt);
        W.updateNav(P.pos.x, P.pos.z);
        E.update(dt);
        WP.update(dt, input);
        Gm.update(dt);
        W.update(dt, t);
        FX.update(dt, P.cam, t);
        UI.update(dt);
        showVM = !(XH.logic && XH.logic.mounted);
      } else if (Gm.state === 'victory') {
        E.update(dt * 0.3); W.update(dt, t); FX.update(dt * 0.3, P.cam, t);
      } else if (Gm.state === 'gameover') {
        E.update(dt * 0.35); W.update(dt, t); FX.update(dt * 0.35, P.cam, t);
        P.cam.position.y = U.damp(P.cam.position.y, 0.35, 1.5, dt); P.cam.rotation.z = U.damp(P.cam.rotation.z, 0.6, 1.5, dt); P.cam.rotation.x = U.damp(P.cam.rotation.x, 0.25, 1, dt);
      } else if (M.paused) { showVM = true; }
    } else if (M.mode === 'menu') {
      updateMenu(dt, t); W.update(dt, t); FX.update(dt, P.cam, t);
    } else if (M.mode === 'bestiary') {
      updateBestiary(dt); cam = bCam; sc = bScene;
    }
    return { cam, sc, showVM };
  }
  // fast: no bloom (the map editor draws that way while the camera or a piece is moving)
  const _dbs = new THREE.Vector2();
  function render(v, dt, fast) {
    if (W.skyRoot) W.skyRoot.position.copy(P.cam.position);
    FX.resize(renderer.getDrawingBufferSize(_dbs).y, v.cam.fov);
    renderer.info.reset();
    if (M.mode === 'game' && !M.editor && W.cull) W.cull(v.cam, dt || 0.016);
    if (M.mode === 'game' && !M.editor && E.cull) E.cull(v.cam);
    if (composer && P.settings.bloom && !fast) {
      rp.scene = v.sc; rp.camera = v.cam; vp.enabled = v.showVM;
      bloom.threshold = M.mode === 'bestiary' ? 0.88 : (W.def && W.def.bloomT) || 0.72;
      composer.render(dt);
    } else {
      renderer.autoClear = false; renderer.clear();
      renderer.render(v.sc, v.cam);
      if (v.showVM) { renderer.clearDepth(); renderer.render(WP.vmScene, WP.vmCam); }
    }
  }
  // Automatic resolution: below ~45 fps the render resolution steps down (to 55% at most); after a few seconds
  // at full speed it steps back up. Only while playing, so menus and loading do not count.
  const AR = { acc: 0, n: 0, scale: 1, good: 0 };
  M.resScale = () => AR.scale;
  function setScale(s) {
    AR.scale = s;
    const base = { low: 0.75, medium: 1, high: Math.min(devicePixelRatio, 1.5) }[P.settings.quality] || 1;
    renderer.setPixelRatio(base * s); if (composer && composer.setPixelRatio) composer.setPixelRatio(base * s); resize();
  }
  M.setResScale = setScale; M.autoResTick = (dt) => autoRes(dt); // diagnostics
  function autoRes(dt) {
    if (P.settings.autoRes === false) { if (AR.scale !== 1) setScale(1); return; }
    if (M.mode !== 'game' || M.paused || Gm.state !== 'playing' || (XH.sys && XH.sys.intro)) { AR.acc = AR.n = 0; return; }
    AR.acc += dt; AR.n++;
    if (AR.acc < 1.5) return;
    const ms = AR.acc / AR.n * 1000; AR.acc = AR.n = 0;
    if (ms > 22 && AR.scale > 0.56) { setScale(Math.max(0.55, +(AR.scale - 0.1).toFixed(2))); AR.good = 0; }
    else if (ms < 17.8 && AR.scale < 1) { AR.good++; if (AR.good >= 3) { AR.good = 0; setScale(Math.min(1, +(AR.scale + 0.05).toFixed(2))); } }
    else AR.good = 0;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (M.editor) { M.editor.frame(dt); return; }
    if (M.frozen) { render(M.lastV || simulate(0), 0); return; }
    let sdt = dt; if (M.hitstop > 0) { M.hitstop -= dt; sdt = dt * 0.08; } // a split-second freeze on big kills
    autoRes(dt);
    render(simulate(sdt), dt);
  }
  // debug: advance the simulation deterministically (used for automated testing)
  M.render = render; M.renderer = renderer; M.scene = scene; M.resize = resize; M.clearCreatures = clearCreatures;
  M.step = (seconds, dt = 1 / 60) => { let v; for (let i = 0; i < seconds / dt; i++) v = simulate(dt); M.lastV = v || simulate(0); render(M.lastV, dt); return true; };
  resize();

  // ---------------- boot ----------------
  if (!XH.EDITOR) UI.show('main');
  const q = new URLSearchParams(location.search);
  if (q.get('play') && !XH.EDITOR) {
    const def = XH.MAPS.find((m) => m.id === q.get('play'));
    // the map editor's Play from here: a spot, a facing, a round, god mode
    if (q.get('at')) { XH.skipIntro = true; M.afterStart = () => { const [x, , z] = q.get('at').split(',').map(Number); P.pos.set(x, W.floorAt(x, z), z); P.vel.set(0, 0, 0); P.yaw = +q.get('yaw') || 0; P.pitch = 0; }; }
    if (q.get('god')) P.god = true;
    if (def) M.startGame(def, Math.max(1, parseInt(q.get('round') || '1', 10) || 1));
  }
  if (XH.DEBUG && q.get('map')) {
    const def = XH.MAPS.find((m) => m.id === q.get('map')) || XH.MAPS[0];
    M.startGame(def, parseInt(q.get('round') || '1', 10), q.get('mode') ? { mode: q.get('mode') } : undefined);
    if (q.get('god')) P.god = true;
  }
  requestAnimationFrame(frame);
  // first user gesture unlocks audio
  const unlock = () => { A.init(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
})();
