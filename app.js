(() => {
  const D = window.MCH_DATA;
  const $ = (s) => document.querySelector(s);
  const main = $('#main');
  const U = (f) => D.base + f;                                  // file in the GitHub repo
  const VIEW = (f) => 'https://docs.google.com/viewer?url=' + encodeURIComponent(U(f)) + '&embedded=true';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const DAY_SHORT = { day1_maternal: 'Day 1 · Maternal', day1_newborn: 'Day 1 · Newborn & Child', day2_programs: 'Day 2 · Programs', video_gallery: '🎥 Videos' };
  const tabs = D.days.map((d) => ({ id: d.id, label: DAY_SHORT[d.id] || d.label, full: d.label }));

  // ---- viewed topics (stored on this device only) ----
  const store = {
    get() { try { return new Set(JSON.parse(localStorage.getItem('mch-viewed') || '[]')); } catch { return new Set(); } },
    add(id) { try { const s = this.get(); s.add(id); localStorage.setItem('mch-viewed', JSON.stringify([...s])); } catch {} }
  };

  let query = '';

  // ---------- Views ----------
  function homeView(dayId) {
    const tab = tabs.find((t) => t.id === dayId) || tabs[0];
    setBar(false, 'MCH Training Hub', tab.full);
    const tabsHtml = `<div class="tabs" role="tablist">${tabs.map((t) =>
      `<button class="tab" role="tab" aria-selected="${t.id === tab.id && !query}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>`;

    if (tab.id === 'video_gallery' && !query) {
      main.innerHTML = tabsHtml + `<div class="vgrid">${D.videos.map((v, i) => `
        <button class="vcard" data-video="${i}">
          <div class="poster"><img loading="lazy" src="${esc(U(v.cover))}" alt="" onerror="this.style.display='none'"><span class="play"></span></div>
          <div class="vt">${esc(v.title)}</div>
        </button>`).join('')}</div>`;
      return;
    }

    const viewed = store.get();
    const q = query.trim().toLowerCase();
    const list = D.sections.filter((s) => q ? s.title.toLowerCase().includes(q) || String(s.num) === q : s.day === tab.id);
    const done = D.sections.filter((s) => s.day === tab.id && viewed.has(s.id)).length;
    const total = D.sections.filter((s) => s.day === tab.id).length;

    main.innerHTML =
      `<input id="q" class="search" type="search" placeholder="Search all topics…" value="${esc(query)}" autocomplete="off">` + tabsHtml +
      (q ? `<div class="progress">${list.length} result${list.length === 1 ? '' : 's'}</div>` :
        `<div class="progress">${done} of ${total} topics viewed<div class="bar"><i style="width:${total ? done / total * 100 : 0}%"></i></div></div>`) +
      (list.length ? `<div class="grid">${list.map((s) => `
        <button class="card" data-sec="${s.id}">
          <img class="thumb" loading="lazy" src="${esc(U(s.items[0].image))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="meta"><div class="num">TOPIC ${s.num}</div><div class="ttl">${esc(s.title)}</div></div>
          <span class="tick ${viewed.has(s.id) ? 'on' : ''}">✓</span>
        </button>`).join('')}</div>` : `<div class="empty">No topics match “${esc(query)}”.</div>`);

    const q$ = $('#q');
    if (q$) q$.addEventListener('input', (e) => {
      query = e.target.value; const pos = e.target.selectionStart; homeView(dayId);
      const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos);
    });
  }

  function detailView(id) {
    const i = D.sections.findIndex((s) => s.id === id);
    const s = D.sections[i];
    if (!s) return location.hash = '#/';
    store.add(s.id);
    setBar(true, `Topic ${s.num}`, tabs.find((t) => t.id === s.day)?.full || '');
    const prev = D.sections[i - 1], next = D.sections[i + 1];
    main.innerHTML = `<div class="detail">${s.items.map((it) => `
      <article class="doc">
        <img class="hero" src="${esc(U(it.image))}" alt="" onerror="this.style.display='none'">
        <div class="body">
          <h2>${esc(s.items.length > 1 ? it.title : s.title)}</h2>
          ${it.note ? `<p>${esc(it.note)}</p>` : ''}
          <div class="actions">
            ${it.pptx ? `<div class="label">📑 PRESENTATION (PPTX)</div>
              <a class="act fill" target="_blank" rel="noopener" href="${esc(VIEW(it.pptx))}">👁 View</a>
              <a class="act" target="_blank" rel="noopener" href="${esc(U(it.pptx))}" download>⬇ Download</a>` : ''}
            ${it.pdf ? `<div class="label">📄 DOCUMENT (PDF)</div>
              <a class="act fill" target="_blank" rel="noopener" href="${esc(VIEW(it.pdf))}">👁 View</a>
              <a class="act" target="_blank" rel="noopener" href="${esc(U(it.pdf))}" download>⬇ Download</a>` : ''}
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

  main.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-sec],[data-video]');
    if (!t) return;
    if (t.dataset.tab) { query = ''; const h = '#/t/' + t.dataset.tab; if (location.hash === h) route(); else location.hash = h; }
    else if (t.dataset.sec) location.hash = '#/s/' + t.dataset.sec;
    else if (t.dataset.video) openVideo(D.videos[+t.dataset.video]);
  });
  $('#back').addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/')));

  // ---------- Cover / enter ----------
  function enter() {
    $('#cover').hidden = true; $('#app').hidden = false;
    document.querySelector('meta[name=theme-color]').content = '#33402a';
    route();
  }
  function showCover() {
    $('#app').hidden = true; $('#cover').hidden = false;
    document.querySelector('meta[name=theme-color]').content = '#2a2418';
  }
  $('#enter').addEventListener('click', enter);
  $('#home').addEventListener('click', showCover);
  if (/^#\/(s|t)\//.test(location.hash)) enter();          // deep link skips the cover

  // ---------- Video player ----------
  const player = $('#player'), video = $('#video');
  function openVideo(v) {
    $('#playerTitle').textContent = v.title;
    video.poster = U(v.cover); video.src = U(v.file);
    player.hidden = false; video.play().catch(() => {});
  }
  function closeVideo() { video.pause(); video.removeAttribute('src'); video.load(); player.hidden = true; }
  $('#playerClose').addEventListener('click', closeVideo);
  player.addEventListener('click', (e) => { if (e.target === player) closeVideo(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !player.hidden) closeVideo(); });

  // ---------- Install ----------
  let deferred;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
  $('#install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; });
  addEventListener('appinstalled', () => { $('#install').hidden = true; });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  if (ios) $('#iosHint').hidden = false;

  // ---------- Offline badge ----------
  const net = () => ($('#net').hidden = navigator.onLine);
  addEventListener('online', net); addEventListener('offline', net); net();

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
