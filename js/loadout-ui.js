'use strict';
// Menus for class building and the Gunsmith.
(function () {
  const U = XH.U, $ = U.$, UI = XH.ui, WP = XH.weapons, PR = XH.progress, CLS = XH.classes;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let edit = null, slotSel = -1;

  // ======================= Classes =======================
  UI.renderClasses = () => {
    const d = PR.data, list = CLS.list();
    if (edit === null) edit = d.classSel || 0;
    const nSlots = CLS.slots();
    $('clsSlotsInfo').textContent = `${nSlots} trait slot${nSlots > 1 ? 's' : ''} · more at rank ${CLS.slotLevels.find((l) => l > d.level) || 'max'}`;
    // class list
    $('clsList').innerHTML = list.map((c, i) => `<div class="clscard ${i === edit ? 'sel' : ''}" data-i="${i}">
      <div class="cn">${esc(c.name)}${i === d.classSel ? '<span class="eq">EQUIPPED</span>' : ''}</div>
      <div class="cs">${esc(WP.DEFS[c.sidearm] ? WP.DEFS[c.sidearm].name : 'P-9 Sidearm')}</div>
      <div class="ct">${CLS.active(c).map((t) => esc(XH.CLASS_TRAITS.find((q) => q.id === t).name)).join(' · ') || '<i>No traits</i>'}</div></div>`).join('');
    $('clsList').querySelectorAll('.clscard').forEach((el) => el.addEventListener('click', () => { edit = +el.dataset.i; slotSel = -1; XH.audio.play('uiClick'); UI.renderClasses(); }));
    // editor
    const c = list[edit];
    const sidearms = XH.SIDEARMS.map(([id, lv]) => { const ok = CLS.sidearmOk(id); return `<button class="sa ${c.sidearm === id ? 'on' : ''} ${ok ? '' : 'locked'}" data-id="${id}" ${ok ? '' : 'disabled'}>${esc(WP.DEFS[id].name)}<small>${ok ? esc(WP.DEFS[id].role || '') : 'Rank ' + lv}</small></button>`; }).join('');
    const slots = [0, 1, 2, 3].map((k) => {
      if (k >= nSlots) return `<div class="tslot locked">Slot ${k + 1}<small>Unlocks at rank ${CLS.slotLevels[k]}</small></div>`;
      const t = c.traits[k] && XH.CLASS_TRAITS.find((q) => q.id === c.traits[k]);
      return `<div class="tslot ${slotSel === k ? 'sel' : ''}" data-k="${k}">${t ? `<b>${esc(t.name)}</b><small>${esc(t.desc)}</small>` : `Empty slot<small>${slotSel === k ? 'Now pick a trait on the right →' : 'Click, then pick a trait'}</small>`}</div>`;
    }).join('');
    const LO = XH.loadout, fk = PR.data.fragKills || 0, curL = c.lethal || 'frag', curT = c.tactical || 'none';
    const lethals = LO.LETHALS.map((l) => { const ok = LO.lethalOk(l.id); return `<button class="sa lt ${curL === l.id ? 'on' : ''} ${ok ? '' : 'locked'}" data-l="${l.id}" ${ok ? '' : 'disabled'}>${l.name}<small>${ok ? l.desc : `🔒 ${Math.min(fk, l.frags)}/${l.frags} frag kills`}</small></button>`; }).join('');
    const tacticals = LO.TACTICALS.map((t) => { const ok = LO.tacticalOk(t.id); return `<button class="sa tc ${curT === t.id ? 'on' : ''} ${ok ? '' : 'locked'}" data-t="${t.id}" ${ok ? '' : 'disabled'}>${t.name}<small>${ok ? t.desc : `🔒 Rank ${t.rank}`}</small></button>`; }).join('');
    $('clsEdit').innerHTML = `<label class="cname">Class name <input id="clsName" maxlength="18" value="${esc(c.name)}"></label>
      <h4>Starting sidearm</h4><div class="sagrid">${sidearms}</div>
      <h4>Lethal (G)</h4><div class="sagrid">${lethals}</div>
      <h4>Tactical (T)</h4><div class="sagrid">${tacticals}</div>
      <h4>Traits</h4><div class="tslots">${slots}</div>
      <button id="clsEquip" class="primary">${edit === d.classSel ? 'Equipped' : 'Equip this class'}</button>`;
    $('clsName').addEventListener('change', (e) => { c.name = e.target.value.trim().slice(0, 18) || c.name; CLS.save(); UI.renderClasses(); });
    $('clsEdit').querySelectorAll('.tc:not(.locked)').forEach((b) => b.addEventListener('click', () => { c.tactical = b.dataset.t; CLS.save(); XH.audio.play('uiClick'); UI.renderClasses(); }));
    $('clsEdit').querySelectorAll('.sa:not(.locked):not(.lt):not(.tc)').forEach((b) => b.addEventListener('click', () => { c.sidearm = b.dataset.id; CLS.save(); XH.audio.play('uiClick'); UI.renderClasses(); }));
    $('clsEdit').querySelectorAll('.lt:not(.locked)').forEach((b) => b.addEventListener('click', () => { c.lethal = b.dataset.l; CLS.save(); XH.audio.play('uiClick'); UI.renderClasses(); }));
    $('clsEdit').querySelectorAll('.tslot:not(.locked)').forEach((el) => el.addEventListener('click', () => {
      const k = +el.dataset.k;
      if (slotSel === k && c.traits[k]) { c.traits.splice(k, 1); slotSel = -1; CLS.save(); } else slotSel = k;
      XH.audio.play('uiClick'); UI.renderClasses();
    }));
    $('clsEquip').addEventListener('click', () => { CLS.select(edit); XH.audio.play('buy'); UI.renderClasses(); });
    // trait catalogue
    $('clsTraits').innerHTML = '<h4>Traits</h4>' + XH.CLASS_TRAITS.map((t) => {
      const ok = CLS.unlocked(t.id), used = c.traits.includes(t.id);
      return `<div class="trait ${ok ? '' : 'locked'} ${used ? 'used' : ''}" data-id="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span><small>${ok ? (used ? 'In this class' : slotSel >= 0 ? 'Click to equip' : 'Unlocked') : `🔒 ${esc(t.text)}: ${CLS.progressText(t)}`}</small></div>`;
    }).join('');
    $('clsTraits').querySelectorAll('.trait:not(.locked)').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (c.traits.includes(id)) return;
      let k = slotSel >= 0 ? slotSel : c.traits.length;
      if (k >= nSlots) { XH.audio.play('deny'); return; }
      if (k >= c.traits.length) c.traits.push(id); else c.traits[k] = id;
      c.traits = c.traits.slice(0, nSlots); slotSel = -1; CLS.save(); XH.audio.play('buy'); UI.renderClasses();
    }));
  };
  UI.classChip = () => { const c = CLS.cur(), el = $('classChip'); if (el) el.querySelector('#classSummary').textContent = c.name; };

  // ======================= Gunsmith =======================
  const STAT_ROWS = [
    ['Damage', (s) => s.dmg * (s.pellets || 1), (v) => Math.round(v), 1],
    ['Fire rate', (s) => 60 / s.rate, (v) => Math.round(v) + ' rpm', 1],
    ['Magazine', (s) => s.mag, (v) => Math.round(v), 1],
    ['Reload', (s) => s.reload, (v) => v.toFixed(2) + ' s', -1],
    ['Recoil', (s) => s.recoil, (v) => (v * 100).toFixed(1), -1],
    ['Hip spread', (s) => s.spread, (v) => (v * 100).toFixed(1), -1],
    ['Aim time', (s) => s.adsTime, (v) => Math.round(v * 1000) + ' ms', -1],
    ['Move speed', (s) => s.move || 1, (v) => Math.round(v * 100) + '%', 1],
  ];
  UI.openGunsmith = (id) => { UI.gsWeapon = id; UI.show('gunsmith'); };
  UI.renderGunsmith = () => {
    const id = UI.gsWeapon, d = WP.DEFS[id]; if (!d) return;
    $('gsTitle').textContent = 'Gunsmith · ' + d.name;
    $('gsImg').src = UI.weaponThumb(id, PR.camoFor(id));
    $('gsRole').innerHTML = `<div class="role">${esc(d.role || d.cls)}</div>` + (d.traits || []).map((t) => XH.WTRAITS[t] ? `<div class="wt"><b>${esc(XH.WTRAITS[t][0])}</b> ${esc(XH.WTRAITS[t][1])}</div>` : '').join('');
    // stats: with attachments vs. bare
    const cur = WP.slot(id).s, saved = PR.data.gs[id]; delete PR.data.gs[id]; const base = WP.slot(id).s; if (saved) PR.data.gs[id] = saved;
    $('gsStats').innerHTML = STAT_ROWS.map(([n, f, fmt, good]) => {
      const a = f(cur), b = f(base), dlt = b ? (a - b) / b : 0, cls = Math.abs(dlt) < 0.005 ? '' : (dlt * good > 0 ? 'up' : 'down');
      return `<div class="gsrow"><span>${n}</span><b class="${cls}">${fmt(a)}</b></div>`;
    }).join('');
    const allowed = WP.attAllowed(id), sel = PR.attFor(id) || {}, kills = PR.killsWith(id);
    const cats = Object.keys(XH.ATTACH).filter((c) => allowed[c] && allowed[c].length);
    $('gsSlots').innerHTML = cats.length ? cats.map((cat) => {
      const A = XH.ATTACH[cat], ok = PR.attUnlocked(id, cat);
      const opts = ['default'].concat(allowed[cat]).map((o) => {
        const info = o === 'default' ? { name: 'As designed', desc: 'The factory setup' } : A.opts[o];
        const on = (sel[cat] || 'default') === o;
        return `<button class="att ${on ? 'on' : ''}" data-cat="${cat}" data-o="${o}" ${ok ? '' : 'disabled'}>${esc(info.name)}<small>${esc(info.desc)}</small></button>`;
      }).join('');
      return `<div class="gscat ${ok ? '' : 'locked'}"><h4>${A.name}${ok ? '' : `<span>🔒 ${Math.min(kills, A.kills)}/${A.kills} kills with this weapon</span>`}</h4><div class="attrow">${opts}</div></div>`;
    }).join('') : '<p class="dim">This weapon cannot take attachments. Camos are set in the Armory.</p>';
    $('gsSlots').querySelectorAll('.att:not([disabled])').forEach((b) => b.addEventListener('click', () => { PR.setAtt(id, b.dataset.cat, b.dataset.o); XH.audio.play('uiClick'); UI.renderGunsmith(); }));
  };

  // ======================= Tailored Loadout =======================
  let loTab = 'primary';
  const G = () => XH.game;
  UI.renderLoadout = () => {
    const LO = XH.loadout, L = LO.data(), perks = Object.values(XH.PERKS);
    const nm = (id) => (id && WP.DEFS[id] ? WP.DEFS[id].name : 'None');
    $('loSummary').innerHTML = `<b>${esc(nm(L.primary))}</b> · ${esc(nm(L.secondary))} · ${L.perks.length ? L.perks.map((id) => esc((perks.find((p) => p.id === id) || {}).name || id)).join(', ') : 'no perks'} · ${L.lethal === 'turret' ? 'Turret' : 'Frags'} <button id="loUse" class="${UI.mods && UI.mods.loadout ? 'primary' : ''}">${UI.mods && UI.mods.loadout ? 'In use ✓' : 'Use this loadout'}</button>`;
    $('loUse').addEventListener('click', () => { UI.setMod('loadout', !(UI.mods && UI.mods.loadout)); XH.audio.play('uiClick'); UI.renderLoadout(); });
    $('loTabs').innerHTML = [['primary', 'Primary'], ['secondary', 'Secondary'], ['perks', 'Perks'], ['lethal', 'Lethal']].map(([k, n]) => `<button class="${loTab === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('');
    $('loTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { loTab = b.dataset.t; XH.audio.play('uiClick'); UI.renderLoadout(); }));
    const bar = (v, n) => `<div class="lobar"><i style="width:${Math.min(100, (v / Math.max(1, n)) * 100)}%"></i></div>`;
    let html = '';
    if (loTab === 'primary' || loTab === 'secondary') {
      const byCls = {};
      for (const id of LO.weapons()) (byCls[WP.DEFS[id].cls] = byCls[WP.DEFS[id].cls] || []).push(id);
      if (loTab === 'secondary') html += `<div class="logrid"><div class="lotile ${!L.secondary ? 'sel' : ''}" data-w=""><b>None</b><small>Start with one gun</small></div></div>`;
      for (const cls of Object.keys(byCls)) {
        html += `<h4 class="locls">${esc(cls)} <small>${U.fmt(LO.WEAPON_KILLS[cls] || 1500)} kills with a gun unlocks it</small></h4><div class="logrid">`;
        for (const id of byCls[cls]) {
          const ok = LO.weaponOk(id), k = PR.killsWith(id), need = LO.weaponNeed(id), sel = L[loTab] === id;
          html += `<div class="lotile ${ok ? '' : 'locked'} ${sel ? 'sel' : ''}" data-w="${id}"><b>${esc(WP.DEFS[id].name)}</b><small>${ok ? esc(WP.DEFS[id].role || cls) : `🔒 ${U.fmt(Math.min(k, need))} / ${U.fmt(need)} kills`}</small>${ok ? '' : bar(k, need)}</div>`;
        }
        html += '</div>';
      }
    } else if (loTab === 'perks') {
      html += `<h4 class="locls">Up to 4 perks <small>Buy a perk ${LO.PERK_BUYS} times to unlock it</small></h4><div class="logrid">`;
      for (const p of perks) {
        const ok = LO.perkOk(p.id), n = LO.perkBuys(p.id), sel = L.perks.includes(p.id);
        html += `<div class="lotile ${ok ? '' : 'locked'} ${sel ? 'sel' : ''}" data-p="${p.id}"><b style="color:${p.css}">${p.icon} ${esc(p.name)}</b><small>${ok ? esc(p.desc) : `🔒 bought ${Math.min(n, LO.PERK_BUYS)} / ${LO.PERK_BUYS}`}</small>${ok ? '' : bar(n, LO.PERK_BUYS)}</div>`;
      }
      html += '</div>';
    } else {
      const fk = PR.data.fragKills || 0;
      html += '<div class="logrid">' + LO.LETHALS.map((l) => { const ok = LO.lethalOk(l.id); return `<div class="lotile ${ok ? '' : 'locked'} ${(L.lethal || 'frag') === l.id ? 'sel' : ''}" data-l="${l.id}"><b>${l.name}</b><small>${ok ? l.desc : `🔒 ${Math.min(fk, l.frags)} / ${l.frags} frag grenade kills`}</small>${ok ? '' : bar(fk, l.frags)}</div>`; }).join('') + '</div>';
    }
    $('loBody').innerHTML = html;
    $('loBody').querySelectorAll('.lotile:not(.locked)').forEach((el) => el.addEventListener('click', () => {
      if (el.dataset.w !== undefined) {
        const id = el.dataset.w || null;
        if (loTab === 'primary' && id) { if (L.secondary === id) L.secondary = L.primary; L.primary = id; }
        else if (loTab === 'secondary') L.secondary = id && id === L.primary ? null : id;
      } else if (el.dataset.p) {
        const i = L.perks.indexOf(el.dataset.p);
        if (i >= 0) L.perks.splice(i, 1); else if (L.perks.length < 4) L.perks.push(el.dataset.p); else { XH.audio.play('deny'); return; }
      } else if (el.dataset.l) L.lethal = el.dataset.l;
      LO.save(); XH.audio.play('uiClick'); UI.renderLoadout();
    }));
  };
})();
