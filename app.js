(() => {
  const D = window.MCH_DATA;
  const $ = (s) => document.querySelector(s);
  const main = $('#main');
  const U = (f) => D.base + f;                                  // file in the GitHub repo
  const VIEW = (f) => 'https://docs.google.com/viewer?url=' + encodeURIComponent(U(f)) + '&embedded=true';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const base = (f) => f.split('/').pop();
  const MIME = { pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', mp4: 'video/mp4' };
  const mime = (f) => MIME[f.split('.').pop().toLowerCase()] || 'application/octet-stream';
  const fmt = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';

  const DAY_SHORT = { day1_maternal: 'Maternal', day1_newborn: 'Newborn', day2_programs: 'Programs', video_gallery: 'Videos' };
  const DAY_ICON = { day1_maternal: '🤱', day1_newborn: '👶', day2_programs: '📋', video_gallery: '🎬' };
  const DAY_SUB = { day1_maternal: 'Day 1', day1_newborn: 'Day 1', day2_programs: 'Day 2', video_gallery: 'Gallery' };
  const tabs = D.days.map((d) => ({ id: d.id, label: DAY_SHORT[d.id], full: d.label }));

  // ---- viewed topics (stored on this device only) ----
  const store = {
    get() { try { return new Set(JSON.parse(localStorage.getItem('mch-viewed') || '[]')); } catch { return new Set(); } },
    add(id) { try { const s = this.get(); s.add(id); localStorage.setItem('mch-viewed', JSON.stringify([...s])); } catch {} }
  };

  // ---- toast ----
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }

  // =====================================================================
  //  OFFLINE STORAGE  (Cache API; files are served back by sw.js)
  // =====================================================================
  const OFF = {
    name: 'mch-offline-v1',
    sizes: new Map(),                 // saved file -> bytes
    busy: new Map(),                  // unit -> percent while saving
    get ok() { return 'caches' in window && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller; },
    key: (f) => new URL('offline-file/' + f, document.baseURI).href,
    has: (f) => OFF.sizes.has(f),
    async init() {
      if (!('caches' in window)) return;
      try {
        const c = await caches.open(this.name);
        for (const rq of await c.keys()) {
          const f = decodeURIComponent(rq.url.split('/offline-file/')[1] || '');
          const r = await c.match(rq);
          if (f && r) this.sizes.set(f, +r.headers.get('content-length') || 0);
        }
      } catch {}
    }
  };

  // unit = 's:<sectionId>' (all PPTX/PDF of a topic)  or  'v:<videoIndex>'
  function unitFiles(u) {
    if (u[0] === 'v') return [D.videos[+u.slice(2)].file];
    const s = D.sections.find((x) => x.id === u.slice(2));
    return s.items.flatMap((i) => [i.pptx, i.pdf]).filter(Boolean);
  }
  function unitCovers(u) {
    if (u[0] === 'v') return [D.videos[+u.slice(2)].cover];
    return D.sections.find((x) => x.id === u.slice(2)).items.map((i) => i.image);
  }
  const unitState = (u) => {
    const f = unitFiles(u), n = f.filter(OFF.has).length;
    return n === 0 ? 'none' : n === f.length ? 'saved' : 'partial';
  };

  async function fetchBlob(f, onp) {
    let lastErr;
    for (const url of [U(f), (D.cdn || D.base) + f]) {              // GitHub raw first, jsDelivr as backup
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const total = +r.headers.get('content-length') || 0;
        if (!r.body) return await r.blob();
        const rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onp(got, total); }
        return new Blob(parts);
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  function unitBtn(u, mini) {
    const st = unitState(u), busy = OFF.busy.get(u);
    let txt, cls = 'save' + (mini ? ' mini' : '');
    if (busy !== undefined) { txt = mini ? busy + '%' : `Saving… ${busy}%`; cls += ' busy'; }
    else if (st === 'saved') { txt = mini ? '✓' : '✓ Saved offline · tap to remove'; cls += ' done'; }
    else { txt = mini ? '⬇' : st === 'partial' ? '⬇ Finish saving offline' : '⬇ Save for offline'; }
    return `<button class="${cls}" data-unit="${u}" aria-label="Save offline">${txt}</button>`;
  }
  const paint = (u) => document.querySelectorAll(`[data-unit="${u}"]`).forEach((el) => (el.outerHTML = unitBtn(u, el.classList.contains('mini'))));
  function afterChange() { const y = scrollY; route(); scrollTo(0, y); }

  async function saveUnit(u, quiet) {
    if (!OFF.ok) return toast('Offline saving is not ready yet — reload the app once and try again.');
    if (OFF.busy.has(u)) return;
    const files = unitFiles(u).filter((f) => !OFF.has(f));
    if (!files.length) return;
    if (!navigator.onLine) return toast('You are offline — connect to the internet to save this.');
    OFF.busy.set(u, 0); paint(u);
    try {
      navigator.storage?.persist?.();
      const c = await caches.open(OFF.name);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const blob = await fetchBlob(f, (g, t) => { OFF.busy.set(u, Math.min(99, Math.round((i + (t ? g / t : .5)) / files.length * 100))); paint(u); });
        await c.put(OFF.key(f), new Response(blob, { headers: { 'Content-Type': mime(f), 'Content-Length': String(blob.size) } }));
        OFF.sizes.set(f, blob.size);
      }
      unitCovers(u).forEach((src) => { const im = new Image(); im.src = U(src); });   // warm the image cache
      if (!quiet) toast('Saved — available offline');
    } catch (e) {
      toast(e && e.name === 'QuotaExceededError' ? 'Not enough storage on this device.' : 'Could not save. Check your connection and try again.');
      throw e;
    } finally { OFF.busy.delete(u); paint(u); if (!quiet) afterChange(); }
  }

  async function removeUnit(u, quiet) {
    const c = await caches.open(OFF.name);
    for (const f of unitFiles(u)) { await c.delete(OFF.key(f)); OFF.sizes.delete(f); }
    if (!quiet) { toast('Removed from offline storage'); afterChange(); }
  }

  // ---------- Views ----------
  let query = '';

  function homeView(dayId) {
    const isOff = dayId === 'offline';
    const tab = tabs.find((t) => t.id === dayId) || tabs[0];
    setBar(false, 'MCH Training Hub', isOff ? 'Saved on this device' : tab.full);
    const nav = $('#bnav'); nav.hidden = false;
    nav.innerHTML = tabs.map((t) =>
      `<button role="tab" aria-selected="${!isOff && t.id === tab.id && !query}" data-tab="${t.id}"><span class="ni">${DAY_ICON[t.id]}</span><span class="nt">${esc(DAY_SHORT[t.id])}</span><span class="ns">${DAY_SUB[t.id]}</span></button>`).join('');

    if (isOff) return offlineView();

    if (tab.id === 'video_gallery' && !query) {
      const us = D.videos.map((_, i) => 'v:' + i);
      main.innerHTML = `<div class="vgrid">${D.videos.map((v, i) => `
        <div class="vcard">
          <button class="poster" data-video="${i}" aria-label="Play ${esc(v.title)}"><img loading="lazy" src="${esc(U(v.cover))}" alt="" onerror="this.style.display='none'"><span class="play"></span></button>
          <div class="vfoot"><span class="vt">${esc(v.title)}</span>${OFF.ok ? unitBtn('v:' + i, true) : ''}</div>
        </div>`).join('')}</div>`;
      return;
    }

    const viewed = store.get();
    const q = query.trim().toLowerCase();
    const list = D.sections.filter((s) => q ? s.title.toLowerCase().includes(q) || String(s.num) === q : s.day === tab.id);
    const mine = D.sections.filter((s) => s.day === tab.id);
    const done = mine.filter((s) => viewed.has(s.id)).length;

    main.innerHTML =
      `<input id="q" class="search" type="search" placeholder="Search all topics…" value="${esc(query)}" autocomplete="off">` +
      (q ? `<div class="progress">${list.length} result${list.length === 1 ? '' : 's'}</div>` :
        `<div class="progress">${done} of ${mine.length} topics viewed<div class="bar"><i style="width:${mine.length ? done / mine.length * 100 : 0}%"></i></div></div>`) +
      (list.length ? `<div class="grid">${list.map((s) => cardHtml(s, viewed)).join('')}</div>` : `<div class="empty">No topics match “${esc(query)}”.</div>`);

    const q$ = $('#q');
    if (q$) q$.addEventListener('input', (e) => {
      query = e.target.value; const pos = e.target.selectionStart; homeView(dayId);
      const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos);
    });
  }

  function cardHtml(s, viewed) {
    const saved = unitState('s:' + s.id) === 'saved';
    return `<button class="card" data-sec="${s.id}">
      <img class="thumb" loading="lazy" src="${esc(U(s.items[0].image))}" alt="" onerror="this.style.visibility='hidden'">
      <div class="meta"><div class="num">TOPIC ${s.num}${saved ? ' <span class="chip">⬇ OFFLINE</span>' : ''}</div><div class="ttl">${esc(s.title)}</div></div>
      <span class="tick ${viewed.has(s.id) ? 'on' : ''}">✓</span>
    </button>`;
  }

  function offlineView() {
    const viewed = store.get();
    const secs = D.sections.filter((s) => unitFiles('s:' + s.id).some(OFF.has));
    const vids = D.videos.map((v, i) => ({ v, i })).filter((x) => OFF.has(x.v.file));
    const total = [...OFF.sizes.values()].reduce((a, b) => a + b, 0);
    const empty = !secs.length && !vids.length;
    main.innerHTML =
      `<div class="offsum"><div><b>${empty ? 'Nothing saved yet' : fmt(total) + ' saved on this device'}</b>
         <small>${OFF.sizes.size} file${OFF.sizes.size === 1 ? '' : 's'} · <span id="quota"></span></small></div>
         ${empty ? '' : '<button class="rm wide" data-clearall="1">Remove all</button>'}</div>` +
      (OFF.ok ? '' : `<div class="note">Offline saving becomes available after the app has loaded once with internet. Reload the app to enable it.</div>`) +
      (empty ? `<div class="empty">Open any topic or video and tap <b>⬇ Save for offline</b>.<br>Saved items open without internet.</div>` : '') +
      (secs.length ? `<h3 class="sub">Topics</h3><div class="grid">${secs.map((s) => `
        <div class="row">${cardHtml(s, viewed)}<button class="rm" data-remove="s:${s.id}" aria-label="Remove">🗑</button></div>`).join('')}</div>` : '') +
      (vids.length ? `<h3 class="sub">Videos</h3><div class="vgrid">${vids.map(({ v, i }) => `
        <div class="vcard">
          <button class="poster" data-video="${i}" aria-label="Play ${esc(v.title)}"><img loading="lazy" src="${esc(U(v.cover))}" alt="" onerror="this.style.display='none'"><span class="play"></span></button>
          <div class="vfoot"><span class="vt">${esc(v.title)}<small> · ${fmt(OFF.sizes.get(v.file) || 0)}</small></span><button class="rm" data-remove="v:${i}" aria-label="Remove">🗑</button></div>
        </div>`).join('')}</div>` : '');
    navigator.storage?.estimate?.().then((e) => { const q = $('#quota'); if (q && e.quota) q.textContent = `${fmt(e.usage)} of ${fmt(e.quota)} storage used`; });
  }

  function detailView(id) {
    const i = D.sections.findIndex((s) => s.id === id);
    const s = D.sections[i];
    if (!s) return (location.hash = '#/');
    $('#bnav').hidden = true;
    store.add(s.id);
    setBar(true, `Topic ${s.num}`, tabs.find((t) => t.id === s.day)?.full || '');
    const prev = D.sections[i - 1], next = D.sections[i + 1];
    const file = (f, label, view) => {
      const saved = OFF.has(f), local = 'offline-file/' + f;
      if (saved) return `<div class="label">${label} · ⬇ saved</div>
        <a class="act fill" target="_blank" rel="noopener" href="${esc(local)}">📂 Open</a>
        <a class="act" href="${esc(local)}" download="${esc(base(f))}">⬇ Download</a>`;
      return `<div class="label">${label}</div>
        <a class="act fill" data-online target="_blank" rel="noopener" href="${esc(VIEW(f))}">👁 View</a>
        <a class="act" data-online target="_blank" rel="noopener" href="${esc(U(f))}" download>⬇ Download</a>`;
    };
    main.innerHTML = `<div class="detail">
      ${OFF.ok ? unitBtn('s:' + s.id) : ''}
      ${s.items.map((it) => `
      <article class="doc">
        <img class="hero" src="${esc(U(it.image))}" alt="" onerror="this.style.display='none'">
        <div class="body">
          <h2>${esc(s.items.length > 1 ? it.title : s.title)}</h2>
          ${it.note ? `<p>${esc(it.note)}</p>` : ''}
          <div class="actions">
            ${it.pptx ? file(it.pptx, '📑 PRESENTATION (PPTX)') : ''}
            ${it.pdf ? file(it.pdf, '📄 DOCUMENT (PDF)') : ''}
          </div>
        </div>
      </article>`).join('')}
      <div class="pager">
        <button ${prev ? `data-sec="${prev.id}"` : 'disabled'}>← Previous</button>
        <button ${next ? `data-sec="${next.id}"` : 'disabled'}>Next →</button>
      </div></div>`;
    scrollTo(0, 0);
  }

  function setBar(back, title, sub) {
    $('#back').hidden = !back;
    $('#title').textContent = title;
    $('#subtitle').textContent = sub;
  }

  // ---------- Routing ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [kind, arg] = h.split('/');
    if (kind === 's') detailView(arg); else homeView(kind === 't' ? arg : tabs[0].id);
  }
  addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });
  const goTab = (id) => { query = ''; const h = '#/t/' + id; if (location.hash === h) route(); else location.hash = h; scrollTo(0, 0); };

  main.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sec],[data-video],[data-unit],[data-remove],[data-clearall]');
    if (!t) return;
    const d = t.dataset;
    if (d.sec) location.hash = '#/s/' + d.sec;
    else if (d.video) openVideo(D.videos[+d.video], +d.video);
    else if (d.unit) {
      if (OFF.busy.has(d.unit)) return;
      if (unitState(d.unit) === 'saved') { if (confirm('Remove this from offline storage?')) removeUnit(d.unit); }
      else saveUnit(d.unit).catch(() => {});
    }
    else if (d.remove) { if (confirm('Remove this from offline storage?')) removeUnit(d.remove); }
    else if (d.clearall) { if (confirm('Remove everything saved for offline use?')) caches.delete(OFF.name).then(() => { OFF.sizes.clear(); toast('Offline storage cleared'); afterChange(); }); }
  });
  $('#bnav').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) goTab(t.dataset.tab); });
  $('#back').addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/')));

  // Online-only links (Google viewer / GitHub) while offline
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-online]');
    if (a && !navigator.onLine) { e.preventDefault(); toast('You are offline. Save this topic first to open it without internet.'); }
  });

  // ---------- Cover / enter ----------
  function enter() {
    $('#cover').hidden = true; $('#app').hidden = false;
    document.querySelector('meta[name=theme-color]').content = '#33402a';
    route();
  }
  function showCover() {
    $('#app').hidden = true; $('#cover').hidden = false; $('#bnav').hidden = true;
    document.querySelector('meta[name=theme-color]').content = '#2a2418';
  }
  $('#enter').addEventListener('click', enter);
  $('#home').addEventListener('click', showCover);
  $('#offbtn').addEventListener('click', () => goTab('offline'));
  if (/^#\/(s|t)\//.test(location.hash)) enter();          // deep link skips the cover

  // ---------- Video player ----------
  const player = $('#player'), video = $('#video'), perr = $('#playerErr');
  function openVideo(v, idx) {
    $('#playerTitle').textContent = v.title;
    perr.hidden = true;
    const direct = U(v.file), local = 'offline-file/' + v.file;
    perr.querySelector('a').href = direct;
    video.poster = U(v.cover);
    const srcs = (OFF.has(v.file) ? [local] : []).concat([direct, (D.cdn || D.base) + v.file]);
    video.innerHTML = srcs.map((s) => `<source src="${esc(s)}" type="video/mp4">`).join('');
    video.querySelectorAll('source').forEach((s) => s.addEventListener('error', () => { if (!s.nextElementSibling) perr.hidden = false; }));
    video.load();
    player.hidden = false; video.play().catch(() => {});
  }
  function closeVideo() { video.pause(); video.innerHTML = ''; video.removeAttribute('src'); video.load(); player.hidden = true; }
  $('#playerClose').addEventListener('click', closeVideo);
  player.addEventListener('click', (e) => { if (e.target === player) closeVideo(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !player.hidden) closeVideo(); });

  // ---------- Swipe between sections ----------
  let sx = 0, sy = 0, st = 0, tracking = false;
  document.addEventListener('touchstart', (e) => {
    tracking = !$('#app').hidden && player.hidden && !location.hash.startsWith('#/s/') && e.touches.length === 1 && !(e.target.closest && e.target.closest('input,video'));
    if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - st > 700) return;
    const cur = location.hash.startsWith('#/t/') ? location.hash.slice(4) : tabs[0].id;
    if (cur === 'offline') return;
    const i = tabs.findIndex((t) => t.id === cur) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < tabs.length) goTab(tabs[i].id);
  }, { passive: true });

  // ---------- Install ----------
  let deferred;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
  $('#install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; });
  addEventListener('appinstalled', () => { $('#install').hidden = true; });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) $('#iosHint').hidden = false;

  // ---------- Offline badge ----------
  const net = () => ($('#net').hidden = navigator.onLine);
  addEventListener('online', net); addEventListener('offline', net); net();

  // ---------- Service worker + offline index ----------
  OFF.init().then(() => { if (!$('#app').hidden) afterChange(); });
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!$('#app').hidden) afterChange(); });
  }
})();
