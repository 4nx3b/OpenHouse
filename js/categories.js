/* ============================================================
   Openhouse — Category Directory + Owner upload
   - Category pills; each opens a popup with paginated
     app listings (newest first).
   - Owner login (client-side gate) reveals an Upload flow.
   - Upload auto-extracts description from a GitHub repo.
   ============================================================ */
(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover:none)').matches;
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

  // Escape user-supplied strings before injecting into innerHTML.
  function esc(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // Turn a pasted repo reference into a full https URL we can open.
  function normalizeRepo(url){
    if(!url) return '';
    url = String(url).trim();
    if(/^https?:\/\//i.test(url)) return url;
    if(/^github\.com\//i.test(url)) return 'https://' + url;
    if(/^[\w.-]+\/[\w.-]+$/.test(url)) return 'https://github.com/' + url;
    return url;
  }

  /* ---------------- DATA ---------------- */
  const DEFAULT_ORDER = ['Featured','Media','Productivity','Finance','Dev Tools','Notes',
                         'Utilities','Communication','Design','Security','Health','Tools'];
  let ORDER = DEFAULT_ORDER.slice();

  const GLYPH = {
    'Featured':'✨', 'Media':'♪', 'Productivity':'✓', 'Finance':'$', 'Dev Tools':'◧',
    'Notes':'✎', 'Utilities':'⚙', 'Communication':'✉', 'Design':'◑',
    'Security':'🔒', 'Health':'♥', 'Tools':'🧰'
  };

  /* Custom icons (emoji) + deleted categories — persisted */
  const LS_ICONS  = 'openhouse-cat-icons';
  const LS_HIDDEN = 'openhouse-hidden-cats';
  let CUSTOM_GLYPHS = loadJSON(LS_ICONS, {});
  let HIDDEN_CATS   = loadJSON(LS_HIDDEN, []);
  function loadJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
  }
  function saveJSON(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  // Resolve the icon for a category: custom emoji wins over the built-in glyph.
  function glyphFor(cat){ return CUSTOM_GLYPHS[cat] || GLYPH[cat] || '•'; }

  // Categories start empty — owners populate them through the upload flow.
  // Categories the owner deleted earlier stay hidden until recreated.
  const BY_CAT = {};
  function rebuildData(){
    ORDER = DEFAULT_ORDER.filter(c => !HIDDEN_CATS.includes(c));
    Object.keys(BY_CAT).forEach(k => delete BY_CAT[k]);
    ORDER.forEach(c => BY_CAT[c] = []);
    UPLOADS.forEach(a => {
      BY_CAT[a.cat] = BY_CAT[a.cat] || [];
      if(!ORDER.includes(a.cat)) ORDER.push(a.cat);
      BY_CAT[a.cat].push(a);
      // starred apps also show up in Featured (unless that's their home)
      if(a.starred && a.cat !== 'Featured' && BY_CAT['Featured']){
        BY_CAT['Featured'].push(a);
      }
    });
  }

  function unhideCat(cat){
    const i = HIDDEN_CATS.indexOf(cat);
    if(i > -1){
      HIDDEN_CATS.splice(i, 1);
      if(DB.ready){ DB.setMeta(ownerPass, 'hidden_cats', HIDDEN_CATS).catch(()=>{}); }
      else saveJSON(LS_HIDDEN, HIDDEN_CATS);
    }
  }

  /* ---------------- PERSISTENCE ---------------- */
  // Primary store: Supabase (shared — every visitor sees the same apps).
  // Fallback: localStorage (only until config.js is filled in).
  const DB = window.OpenhouseDB || { ready:false };
  const LS_KEY = 'openhouse-uploads';
  let LOCAL_UPLOADS = loadUploads();               // legacy local-only apps
  let UPLOADS = DB.ready ? [] : LOCAL_UPLOADS;     // live list shown on the site
  function loadUploads(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; } }
  function saveUploads(){ if(DB.ready) return; try { localStorage.setItem(LS_KEY, JSON.stringify(UPLOADS)); } catch(e){} }

  /* ---------------- ACTIVITY LOG ----------------
     Owner actions (add/edit/move/star/delete/tags) recorded to the shared
     site_meta table via the existing owner_set_meta RPC — visible to every
     visitor in the changelog's Apps tab. Capped so it never grows unbounded. */
  const LS_ACT = 'openhouse-activity';
  let ACTIVITY = loadJSON(LS_ACT, []);
  function logActivity(act, name, cat, extra){
    ACTIVITY.unshift(Object.assign({ t: new Date().toISOString(), act, name, cat }, extra || {}));
    if(ACTIVITY.length > 100) ACTIVITY.length = 100;
    if(DB.ready){ DB.setMeta(ownerPass, 'activity', ACTIVITY).catch(() => {}); }
    else saveJSON(LS_ACT, ACTIVITY);
    buildAppLog();
  }

  // Owner password is kept for the session so DB writes can be authorised
  // server-side (Supabase re-checks it on every write).
  let ownerPass = '';
  // Persistent sign-in: survives tab/browser restarts (localStorage).
  // Migrates any old sessionStorage state on first run.
  try {
    ownerPass = localStorage.getItem('openhouse-pass') || sessionStorage.getItem('openhouse-pass') || '';
    if(ownerPass && !localStorage.getItem('openhouse-pass')) localStorage.setItem('openhouse-pass', ownerPass);
  } catch(e){}

  // Build the initial category/app maps (must run AFTER UPLOADS + DB exist).
  rebuildData();

  /* ---------------- SKELETON LOADING ---------------- */
  function renderSkeletonGrid(){
    // shimmer placeholder pills while the database answers
    grid.innerHTML = Array.from({ length: 8 }, (_, i) =>
      `<div class="cat-pill skel" style="--i:${i}"><span class="skel-ico"></span><span class="skel-line" style="width:${60 + (i % 4) * 14}px"></span></div>`
    ).join('');
  }

  /* ---------------- LOAD FROM DATABASE ---------------- */
  async function loadFromDB(){
    if(!DB.ready) return;
    renderSkeletonGrid();
    try {
      const [apps, meta] = await Promise.all([DB.fetchApps(), DB.fetchMeta()]);
      UPLOADS = apps.map(r => ({
        id: r.id, name: r.name, cat: r.cat, icon: r.icon,
        desc: r.description, tags: Array.isArray(r.tags) ? r.tags : [r.cat], license: r.license,
        added: r.created_at || '', repo: r.repo, thumb: r.thumb || '',
        starred: !!r.starred
      }));
      (meta || []).forEach(m => {
        if(m.key === 'hidden_cats' && Array.isArray(m.value)) HIDDEN_CATS = m.value;
        if(m.key === 'cat_icons' && m.value && typeof m.value === 'object') CUSTOM_GLYPHS = m.value;
        if(m.key === 'activity' && Array.isArray(m.value)) ACTIVITY = m.value;
      });
      rebuildData();
      renderGrid();
      buildPaletteApps();
      updateStats();
      if(overlay.classList.contains('open')) render();
    } catch(e){
      toast('Could not load apps from the database.');
    }
  }

  /* ---------------- STATE ---------------- */
  const cur = { cat:null };

  /* ---------------- DIRECTORY ELEMENTS ---------------- */
  const grid     = $('#cat-grid');
  const overlay  = $('#cat-overlay');
  const titleEl  = $('#cat-title');
  const metaEl   = $('#cat-meta');
  const listEl   = $('#cat-list');
  const closeBtn = $('#cat-close');

  /* ---------------- CATEGORY PILLS ---------------- */
  function renderGrid(){
    grid.innerHTML = ORDER.map((cat, idx) => {
      const n = (BY_CAT[cat] || []).length;
      const acts = isAdmin
        ? `<span class="cat-act cat-act-icon" role="button" tabindex="0" data-act="icon" title="Change icon" aria-label="Change icon for ${esc(cat)}">✎</span>
           <span class="cat-act cat-act-del" role="button" tabindex="0" data-act="del" title="Delete category" aria-label="Delete ${esc(cat)} category">✕</span>`
        : '';
      const featured = cat === 'Featured';
      const sub = featured ? `<span class="cat-sub">The best of the best handpicked apps will be shown here.</span>` : '';
      return `<button class="cat-pill${featured ? ' cat-pill-featured' : ''}" data-cat="${esc(cat)}" data-cursor="pointer" aria-label="Open ${esc(cat)} category" style="--i:${idx}">
        ${cat === 'Featured' 
        ? `<span class="cat-ico cat-ico-featured"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5L13.8 8.2H19.7L14.9 11.7L16.7 17.5L12 14.2L7.3 17.5L9.1 11.7L4.3 8.2H10.2L12 2.5Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M19 3.5L19.8 5.5L21.8 6.3L19.8 7.1L19 9.1L18.2 7.1L16.2 6.3L18.2 5.5L19 3.5Z" fill="currentColor"/><path d="M6 15.5L6.6 17L8.1 17.6L6.6 18.2L6 19.7L5.4 18.2L3.9 17.6L5.4 17L6 15.5Z" fill="currentColor"/></svg></span>`
        : `<span class="cat-ico">${esc(glyphFor(cat))}</span>`}
        <span class="cat-pill-body"><span class="cat-name">${esc(cat)}</span>${sub}</span>
        <span class="cat-count">${n}</span>
        ${acts}
      </button>`;
    }).join('');

    $$('.cat-pill', grid).forEach(btn => {
      btn.addEventListener('click', e => {
        const act = e.target.closest('.cat-act');
        if(act){
          e.stopPropagation();
          if(act.dataset.act === 'icon') openIconEditor(btn.dataset.cat);
          else deleteCategory(btn.dataset.cat);
          return;
        }
        openCat(btn.dataset.cat);
      });
    });
  }

  /* ---------------- CONFIRM DIALOG (replaces window.confirm) ---------------- */
  const confirmOverlay = $('#confirm-overlay');
  let confirmResolve = null;
  function askConfirm(msg, okLabel){
    if(!confirmOverlay) return Promise.resolve(window.confirm(msg));
    $('#confirm-msg').textContent = msg;
    $('#confirm-ok').textContent = okLabel || 'Delete';
    confirmOverlay.classList.add('open');
    return new Promise(resolve => { confirmResolve = resolve; });
  }
  function settleConfirm(val){
    if(!confirmOverlay) return;
    confirmOverlay.classList.remove('open');
    if(confirmResolve){ confirmResolve(val); confirmResolve = null; }
  }
  if(confirmOverlay){
    $('#confirm-cancel').addEventListener('click', () => settleConfirm(false));
    $('#confirm-ok').addEventListener('click', () => settleConfirm(true));
    confirmOverlay.addEventListener('click', e => { if(e.target === confirmOverlay) settleConfirm(false); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && confirmOverlay.classList.contains('open')) settleConfirm(false);
    });
  }

  /* ---------------- DELETE CATEGORY (owner only) ---------------- */
  async function deleteCategory(cat){
    if(!isAdmin) return;
    const n = (BY_CAT[cat] || []).length;
    const msg = n
      ? `Delete the "${cat}" category and the ${n} app${n === 1 ? '' : 's'} inside it? This cannot be undone.`
      : `Delete the empty "${cat}" category?`;
    if(!(await askConfirm(msg, 'Delete category'))) return;

    if(!HIDDEN_CATS.includes(cat)) HIDDEN_CATS.push(cat);
    if(CUSTOM_GLYPHS[cat]) delete CUSTOM_GLYPHS[cat];

    if(DB.ready){
      try {
        await DB.deleteCategory(ownerPass, cat);
        await DB.setMeta(ownerPass, 'hidden_cats', HIDDEN_CATS);
        await DB.setMeta(ownerPass, 'cat_icons', CUSTOM_GLYPHS);
      } catch(e){ toast(e.message || 'Delete failed.'); return; }
    } else {
      saveJSON(LS_HIDDEN, HIDDEN_CATS);
      saveJSON(LS_ICONS, CUSTOM_GLYPHS);
    }

    UPLOADS = UPLOADS.filter(a => a.cat !== cat);
    saveUploads();
    delete BY_CAT[cat];
    ORDER = ORDER.filter(c => c !== cat);

    if(cur.cat === cat) closeCat();
    renderGrid();
    buildPaletteApps();
    updateStats();
    toast('Category "' + cat + '" deleted.');
  }

  /* ---------------- ICON / EMOJI EDITOR (owner only) ---------------- */
  const iconOverlay = $('#icon-overlay');
  let iconCat = null;

  // Keep just the first grapheme so multi-codepoint emoji (e.g. 👨‍👩‍👧) survive
  // but longer pasted text doesn't blow the pill layout.
  function firstGrapheme(str){
    str = String(str || '').trim();
    if(!str) return '';
    try {
      if(typeof Intl !== 'undefined' && Intl.Segmenter){
        const seg = new Intl.Segmenter(undefined, { granularity:'grapheme' });
        const it = seg.segment(str)[Symbol.iterator]().next();
        if(!it.done) return it.value.segment;
      }
    } catch(e){}
    return str.slice(0, 8);
  }

  function openIconEditor(cat){
    if(!isAdmin || !iconOverlay) return;
    iconCat = cat;
    $('#icon-cat-name').textContent = cat;
    $('#icon-current').textContent = glyphFor(cat);
    $('#icon-input').value = CUSTOM_GLYPHS[cat] || '';
    $('#icon-reset').hidden = !CUSTOM_GLYPHS[cat];
    iconOverlay.classList.add('open');
    setTimeout(() => { try { $('#icon-input').focus(); } catch(e){} }, 80);
  }
  function closeIconEditor(){ if(iconOverlay) iconOverlay.classList.remove('open'); iconCat = null; }

  if(iconOverlay){
    // live preview while typing / pasting
    $('#icon-input').addEventListener('input', () => {
      const v = firstGrapheme($('#icon-input').value);
      $('#icon-current').textContent = v || glyphFor(iconCat);
    });
    $('#icon-close').addEventListener('click', closeIconEditor);
    iconOverlay.addEventListener('click', e => { if(e.target === iconOverlay) closeIconEditor(); });
    function persistIcons(){
      if(DB.ready) return DB.setMeta(ownerPass, 'cat_icons', CUSTOM_GLYPHS);
      saveJSON(LS_ICONS, CUSTOM_GLYPHS);
      return Promise.resolve();
    }
    $('#icon-reset').addEventListener('click', async () => {
      if(!iconCat) return;
      delete CUSTOM_GLYPHS[iconCat];
      try { await persistIcons(); } catch(e){ toast(e.message || 'Save failed.'); return; }
      renderGrid();
      toast('Icon reset to default.');
      closeIconEditor();
    });
    $('#icon-form').addEventListener('submit', async e => {
      e.preventDefault();
      if(!iconCat) return;
      const v = firstGrapheme($('#icon-input').value);
      if(!v){ $('#icon-error').textContent = 'Type or paste an emoji first.'; return; }
      $('#icon-error').textContent = '';
      CUSTOM_GLYPHS[iconCat] = v;
      try { await persistIcons(); } catch(err){ $('#icon-error').textContent = err.message || 'Save failed.'; return; }
      renderGrid();
      toast('Icon updated for "' + iconCat + '".');
      closeIconEditor();
    });
  }

  /* ---------------- OPEN / CLOSE (directory popup) ---------------- */
  function openCat(cat){
    closeMenu();
    cur.cat = cat;
    titleEl.textContent = cat;
    render();
    overlay.classList.add('open');
  }
  function closeCat(){ overlay.classList.remove('open'); if(typeof closeCardMenu === 'function') closeCardMenu(); if(selectMode) exitSelectMode(); }

  closeBtn.addEventListener('click', closeCat);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeCat(); });

  /* ---------------- RENDER MODAL ---------------- */
  function sortedApps(){
    // Fixed order: newest first (timestamp, then id as tiebreaker).
    const arr = (BY_CAT[cur.cat] || []).slice();
    const key = a => (a.added || '') + '|' + String(a.id != null ? a.id : 0).padStart(12, '0');
    arr.sort((a, b) => key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0);
    return arr;
  }

  function render(){
    const apps = sortedApps();
    metaEl.textContent = apps.length + (apps.length === 1 ? ' app' : ' apps');
    // All apps in one scrollable list (popup size is capped by CSS).
    listEl.innerHTML = apps.length
      ? apps.map((a, i) => cardHTML(a, i)).join('')
      : (cur.cat === 'Featured'
          ? `<p class="cat-empty">Nothing featured right now — check back soon.</p>`
          : `<p class="cat-empty">No apps in this category yet.</p>`);
    listEl.scrollTop = 0;
    bindCards();

    // Dynamic top/bottom fade for category popup
    setupDynamicFade(listEl);
  }

  function cardHTML(a, i){
    const fallbackIcon = esc(a.icon || glyphFor(a.cat));
    const media = a.thumb
      ? `<img class="cat-thumb" src="${a.thumb}" alt="${esc(a.name)}" loading="lazy" decoding="async" data-fallback="${fallbackIcon}">`
      : `<span class="app-icon">${fallbackIcon}</span>`;
    const tags = (a.tags || []).concat([a.license]).map(t => `<span>${esc(t)}</span>`).join('');
    const menuBtn = `<button class="cat-menu-btn" data-cursor="pointer" aria-label="App actions" aria-haspopup="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>`;
    const starBadge = (a.starred && cur.cat !== 'Featured') ? `<span class="cat-star-badge" title="Featured" aria-label="Featured">★</span>` : '';
    return `<article class="cat-app tilt-card" data-cursor="pointer" data-repo="${esc(a.repo || '')}" data-name="${esc(a.name)}" data-cat="${esc(a.cat)}" style="animation-delay:${Math.min(i*0.05, 0.3).toFixed(2)}s">
      <div class="card-glow"></div>
      ${menuBtn}${starBadge}
      ${media}
      <div class="cat-app-body">
        <h4>${esc(a.name)}</h4>
        <p>${esc(a.desc)}</p>
        <div class="app-tags">${tags}</div>
        <span class="cat-updated" data-updated hidden></span>
      </div>
    </article>`;
  }

  // Dynamic scroll fade helper (used by both category + changelog)
  function setupDynamicFade(scrollEl) {
    if (!scrollEl) return;

    function updateFade() {
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight;
      const clientHeight = scrollEl.clientHeight;

      const hasTop = scrollTop > 8;
      const hasBottom = scrollTop + clientHeight < scrollHeight - 8;

      scrollEl.classList.toggle('has-top-fade', hasTop);
      scrollEl.classList.toggle('has-bottom-fade', hasBottom);
    }

    scrollEl.addEventListener('scroll', updateFade, { passive: true });
    // Initial check
    setTimeout(updateFade, 60);
    // Re-check when content changes
    const observer = new ResizeObserver(updateFade);
    observer.observe(scrollEl);
  }

  function bindCards(){
    if(!isTouch){
      // rAF-throttled tilt: layout is read once per hover, painted once per frame
      $$('.cat-app', listEl).forEach(card => {
        let rect = null, raf = null, pending = null;
        card.addEventListener('mouseenter', () => { rect = card.getBoundingClientRect(); });
        card.addEventListener('mousemove', e => {
          pending = e;
          if(raf) return;
          raf = requestAnimationFrame(() => {
            raf = null;
            if(!pending || !rect) return;
            const px = (pending.clientX - rect.left) / rect.width;
            const py = (pending.clientY - rect.top) / rect.height;
            if(!reduced){
              card.style.transform =
                `perspective(700px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 8}deg) translateZ(4px)`;
            }
            card.style.setProperty('--mx', (px * 100) + '%');
            card.style.setProperty('--my', (py * 100) + '%');
          });
        });
        card.addEventListener('mouseleave', () => { rect = null; card.style.transform = ''; });
      });
    }
    $$('.cat-app', listEl).forEach(card => {
      const repo = normalizeRepo(card.dataset.repo);
      card.addEventListener('click', () => {
        if(selectMode){
          const name = card.dataset.name;
          if(selected.has(name)) selected.delete(name); else selected.add(name);
          card.classList.toggle('selected', selected.has(name));
          updateBulkBar();
          return;
        }
        if(!repo){ toast('No repo linked to this app yet.'); return; }
        // Synthetic anchor click — unlike window.open, this is treated as a
        // normal user navigation by every browser (Firefox blocks the former).
        const a = document.createElement('a');
        a.href = repo;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      const menuBtn = card.querySelector('.cat-menu-btn');
      if(menuBtn) menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const cat = card.dataset.cat, name = card.dataset.name;
        const app = (BY_CAT[cat] || []).find(a => a.name === name);
        toggleCardMenu(menuBtn, cat, name, !!(app && app.starred));
      });
      // broken thumbnail → swap in the category glyph
      const thumb = card.querySelector('.cat-thumb');
      if(thumb) thumb.addEventListener('error', () => {
        const span = document.createElement('span');
        span.className = 'app-icon';
        span.textContent = thumb.dataset.fallback || '•';
        thumb.replaceWith(span);
      }, { once:true });
      // "updated x ago" line (fetched lazily, cached)
      fillUpdated(card);
    });
  }

  /* ---------------- GLOBAL CARD MENU ----------------
     One dropdown lives at the top level of the page (never inside a
     scroll container or filtered modal), so backdrop blur works and it
     can never be clipped. Positioned next to whichever ⋮ was tapped. */
  const cardMenu = document.createElement('div');
  cardMenu.className = 'cat-menu';
  cardMenu.setAttribute('role', 'menu');
  cardMenu.innerHTML = `
    <button class="cat-menu-item" data-act="share" role="menuitem" data-cursor="pointer">Share app</button>
    <button class="cat-menu-item owner-only" data-act="edit" role="menuitem" data-cursor="pointer">Edit app</button>
    <button class="cat-menu-item owner-only" data-act="star" role="menuitem" data-cursor="pointer">Star app</button>
    <button class="cat-menu-item owner-only" data-act="tags" role="menuitem" data-cursor="pointer">Edit tags</button>
    <button class="cat-menu-item owner-only" data-act="select" role="menuitem" data-cursor="pointer">Select multiple…</button>
    <button class="cat-menu-item owner-only cat-menu-danger" data-act="delete" role="menuitem" data-cursor="pointer">Delete app</button>`;
  document.body.appendChild(cardMenu);
  let cardMenuCtx = null; // { cat, name }

  function toggleCardMenu(btn, cat, name, starred){
    if(cardMenu.classList.contains('open') && cardMenuCtx && cardMenuCtx.name === name && cardMenuCtx.cat === cat){
      closeCardMenu();
      return;
    }
    cardMenuCtx = { cat, name };
    cardMenu.querySelector('[data-act="star"]').textContent = starred ? 'Unstar' : 'Star app';
    cardMenu.querySelectorAll('.owner-only').forEach(el => { el.hidden = !isAdmin; });
    // position: below the button, right-aligned; flip up if no room
    const r = btn.getBoundingClientRect();
    const menuW = 170, menuH = isAdmin ? 260 : 52, gap = 6, pad = 8;
    let left = Math.min(r.right - menuW + 8, window.innerWidth - menuW - pad);
    left = Math.max(pad, left);
    let top = r.bottom + gap;
    const flipUp = top + menuH > window.innerHeight - pad;
    if(flipUp) top = r.top - gap - menuH;
    cardMenu.style.left = left + 'px';
    cardMenu.style.top = Math.max(pad, top) + 'px';
    cardMenu.classList.toggle('up', flipUp);
    cardMenu.classList.add('open');
  }
  function closeCardMenu(){ cardMenu.classList.remove('open'); cardMenuCtx = null; }

  cardMenu.addEventListener('click', e => e.stopPropagation());
  cardMenu.querySelectorAll('.cat-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const ctx = cardMenuCtx;
      closeCardMenu();
      if(!ctx) return;
      const act = item.dataset.act;
      if(act === 'tags') openTagEditor(ctx.cat, ctx.name);
      else if(act === 'star') toggleStar(ctx.cat, ctx.name);
      else if(act === 'share') shareApp(ctx.cat, ctx.name);
      else if(act === 'select') enterSelectMode();
      else if(act === 'edit'){
        const app = UPLOADS.find(a => a.cat === ctx.cat && a.name === ctx.name);
        if(app) openUpload(app);
      }
      else if(act === 'delete'){
        askConfirm('Delete “' + ctx.name + '”? This cannot be undone.', 'Delete app')
          .then(ok => { if(ok) deleteApp(ctx.cat, ctx.name); });
      }
    });
  });

  /* ---------------- #6 SHARE APP (deep link) ---------------- */
  function shareApp(cat, name){
    const url = location.origin + location.pathname + '#app=' + encodeURIComponent(name);
    const done = () => toast('Link copied — opens straight to this app.');
    if(navigator.share){
      navigator.share({ title: name + ' — Openhouse', url }).catch(() => {});
      return;
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(done).catch(() => prompt('Copy this link:', url));
    } else {
      prompt('Copy this link:', url);
    }
  }

  /* Scroll the popup list to a specific app card and flash it - FIXED v4 (no outline + handle lazy size shift) */
  function scrollToApp(name){
    const MAX_TRIES = 20;
    let tries = 0;
    let observedCard = null;
    let resizeObserver = null;
    let reScrollTimeout = null;

    function cleanup(){
      if(resizeObserver && observedCard){
        try{ resizeObserver.unobserve(observedCard); }catch(e){}
      }
      resizeObserver = null;
      observedCard = null;
      if(reScrollTimeout) clearTimeout(reScrollTimeout);
    }

    function centerCard(card){
      const list = listEl;
      if(!list || !card) return;
      try{
        const cardTop = card.offsetTop;
        const listH = list.clientHeight;
        const cardH = card.offsetHeight;
        let targetTop = cardTop - (listH/2 - cardH/2);
        const maxScroll = list.scrollHeight - listH;
        targetTop = Math.max(0, Math.min(targetTop, maxScroll));
        list.scrollTo({ top: targetTop, behavior: 'smooth' });
      }catch(e){
        try{ card.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(_){}
      }
    }

    function attempt(){
      const list = listEl;
      if(!list){
        if(tries < MAX_TRIES){ tries++; setTimeout(attempt, 100); }
        return;
      }
      let card = null;
      try{
        const escName = (window.CSS && CSS.escape) ? CSS.escape(name) : name.replace(/"/g,'\"');
        card = list.querySelector(`[data-name="${escName}"]`);
      }catch(e){}
      if(!card){
        card = $$('.cat-app', list).find(c => (c.dataset.name||'').toLowerCase() === name.toLowerCase());
      }
      if(!card){
        if(tries < MAX_TRIES){
          tries++;
          setTimeout(attempt, 120);
        }
        return;
      }
      if(list.scrollHeight <= list.clientHeight && tries < MAX_TRIES){
        tries++;
        setTimeout(attempt, 100);
        return;
      }
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          try{ card.style.animation = 'none'; }catch(e){}
          centerCard(card);
          // No outline per user request - do NOT add located class
          // Re-center if lazy-loaded updated timestamp increases card size
          observedCard = card;
          if('ResizeObserver' in window){
            resizeObserver = new ResizeObserver(()=>{
              // Debounce re-center
              if(reScrollTimeout) clearTimeout(reScrollTimeout);
              reScrollTimeout = setTimeout(()=> centerCard(card), 80);
            });
            resizeObserver.observe(card);
            // Stop observing after 4s
            setTimeout(cleanup, 4000);
          } else {
            // Fallback: re-center a few times as lazy data loads
            let count = 0;
            const iv = setInterval(()=>{
              centerCard(card);
              count++;
              if(count > 8){ clearInterval(iv); }
            }, 350);
            setTimeout(()=> clearInterval(iv), 4000);
          }
        });
      });
    }
    setTimeout(attempt, 600);
  }

  // deep link: #app=Name opens that app's category popup on load
  function handleDeepLink(){
    if(typeof location === 'undefined' || !location.hash) return;
    const m = location.hash.match(/^#app=(.+)$/);
    if(!m) return;
    const name = decodeURIComponent(m[1]);
    const app = UPLOADS.find(a => a.name.toLowerCase() === name.toLowerCase());
    if(app) setTimeout(() => { openCat(app.cat); scrollToApp(app.name); }, 400);
  }
  // close on outside tap, scroll inside the list, or popup close
  document.addEventListener('click', closeCardMenu);
  if(listEl) listEl.addEventListener('scroll', closeCardMenu, { passive:true });

  /* ---------------- #8 BULK SELECT MODE (owner) ---------------- */
  let selectMode = false;
  const selected = new Set(); // app names within cur.cat
  const bulkBar = document.createElement('div');
  bulkBar.className = 'bulk-bar';
  bulkBar.innerHTML = `
    <span class="bulk-count">0 selected</span>
    <button class="bulk-btn" data-bulk="star" data-cursor="pointer">Star</button>
    <button class="bulk-btn" data-bulk="move" data-cursor="pointer">Move</button>
    <button class="bulk-btn bulk-danger" data-bulk="delete" data-cursor="pointer">Delete</button>
    <button class="bulk-btn" data-bulk="cancel" data-cursor="pointer">✕</button>`;
  document.body.appendChild(bulkBar);

  function enterSelectMode(){
    selectMode = true;
    selected.clear();
    updateBulkBar();
    bulkBar.classList.add('show');
    render();
  }
  function exitSelectMode(){
    selectMode = false;
    selected.clear();
    bulkBar.classList.remove('show');
    render();
  }
  function updateBulkBar(){
    bulkBar.querySelector('.bulk-count').textContent = selected.size + ' selected';
  }

  bulkBar.addEventListener('click', async e => {
    const btn = e.target.closest('.bulk-btn');
    if(!btn) return;
    const act = btn.dataset.bulk;
    if(act === 'cancel'){ exitSelectMode(); return; }
    if(!selected.size){ toast('Tap cards to select them first.'); return; }
    const names = Array.from(selected);

    if(act === 'star'){
      for(const n of names){
        const app = UPLOADS.find(a => a.cat === cur.cat && a.name === n);
        if(app && !app.starred) await toggleStar(cur.cat, n);
      }
      exitSelectMode();
      toast(names.length + ' app' + (names.length === 1 ? '' : 's') + ' starred.');
    }
    else if(act === 'delete'){
      const ok = await askConfirm('Delete ' + names.length + ' app' + (names.length === 1 ? '' : 's') + '? This cannot be undone.', 'Delete all');
      if(!ok) return;
      for(const n of names) await deleteApp(cur.cat, n, true);
      exitSelectMode();
      toast(names.length + ' app' + (names.length === 1 ? '' : 's') + ' deleted.');
    }
    else if(act === 'move'){
      const target = prompt('Move ' + names.length + ' app(s) to which category?\n' +
        ORDER.filter(c => c !== 'Featured' && c !== cur.cat).join(' · '));
      if(!target) return;
      const cat = target.trim();
      if(!cat || cat === cur.cat) return;
      for(const n of names){
        const app = UPLOADS.find(a => a.cat === cur.cat && a.name === n);
        if(!app) continue;
        if(DB.ready && app.id != null){
          try { await DB.updateApp(ownerPass, app.id, { cat }); } catch(err){ toast(err.message); return; }
        }
        app.cat = cat;
      }
      unhideCat(cat);
      if(!ORDER.includes(cat)) ORDER.push(cat);
      saveUploads();
      rebuildData();
      renderGrid();
      buildPaletteApps();
      updateStats();
      exitSelectMode();
      names.forEach(n => logActivity('moved', n, cat, { from: cur.cat }));
      toast('Moved to “' + cat + '”.');
    }
  });

  /* ---------------- #9 REPO "UPDATED" TRACKING ---------------- */
  // Lazily asks the forge API when each repo last had a push. Cached in
  // localStorage for 24h so browsing stays cheap.
  const UPD_KEY = 'openhouse-updated-cache';
  let updCache = loadJSON(UPD_KEY, {});
  function timeAgo(iso){
    const then = new Date(iso).getTime();
    if(isNaN(then)) return '';
    const days = Math.floor((Date.now() - then) / 86400000);
    if(days <= 0) return 'updated today';
    if(days === 1) return 'updated yesterday';
    if(days < 30) return 'updated ' + days + 'd ago';
    if(days < 365) return 'updated ' + Math.floor(days / 30) + 'mo ago';
    return 'updated ' + Math.floor(days / 365) + 'y ago';
  }
  async function fetchUpdated(repoUrl){
    const p = parseRepoUrl(repoUrl);
    if(!p) return null;
    const { host, owner, repo } = p;
    const o = encodeURIComponent(owner), r = encodeURIComponent(repo);
    try {
      if(host === 'github.com' || host === 'www.github.com'){
        const d = await getJSON('https://api.github.com/repos/' + o + '/' + r);
        return d.pushed_at || d.updated_at || null;
      }
      if(host === 'bitbucket.org'){
        const d = await getJSON('https://api.bitbucket.org/2.0/repositories/' + o + '/' + r);
        return d.updated_on || null;
      }
      if(host === 'gitlab.com' || host.includes('gitlab')){
        const d = await getJSON('https://' + host + '/api/v4/projects/' + encodeURIComponent(owner + '/' + repo));
        return d.last_activity_at || null;
      }
      const d = await getJSON('https://' + host + '/api/v1/repos/' + o + '/' + r);
      return d.updated_at || null;
    } catch(e){ return null; }
  }
  const updInFlight = new Set();
  function fillUpdated(card){
    const el = card.querySelector('[data-updated]');
    const repo = normalizeRepo(card.dataset.repo);
    if(!el || !repo) return;
    const hit = updCache[repo];
    if(hit){
      const maxAge = hit.v ? 86400000 : 900000; // 24h hits, 15min misses
      if(Date.now() - hit.t < maxAge){
        if(hit.v){ el.textContent = timeAgo(hit.v); el.hidden = false; }
        return;
      }
    }
    if(updInFlight.has(repo)) return;
    updInFlight.add(repo);
    fetchUpdated(repo).then(v => {
      updInFlight.delete(repo);
      updCache[repo] = { v, t: Date.now() };
      try { localStorage.setItem(UPD_KEY, JSON.stringify(updCache)); } catch(e){}
      if(v && el.isConnected){ el.textContent = timeAgo(v); el.hidden = false; }
    });
  }

  /* ---------------- STAR / FEATURE (owner only) ---------------- */
  async function toggleStar(cat, name){
    if(!isAdmin) return;
    const app = UPLOADS.find(a => a.cat === cat && a.name === name);
    if(!app) return;
    const next = !app.starred;
    if(DB.ready && app.id != null){
      try { await DB.setStar(ownerPass, app.id, next); }
      catch(e){ toast(e.message || 'Could not update star.'); return; }
    }
    app.starred = next;
    saveUploads();
    rebuildData();
    renderGrid();
    buildPaletteApps();
    updateStats();
    render();
    logActivity(next ? 'starred' : 'unstarred', app.name, app.cat);
    toast(next ? '"' + app.name + '" starred — now in Featured.' : '"' + app.name + '" removed from Featured.');
  }

  /* ---------------- TAG EDITOR (owner only) ---------------- */
  const tagsOverlay = $('#tags-overlay');
  let tagApp = null;      // the app object being edited
  let tagDraft = [];      // working copy of its tags

  function renderTagChips(){
    const wrap = $('#tags-chips');
    wrap.innerHTML = tagDraft.length
      ? tagDraft.map((t, i) =>
          `<span class="tag-chip">${esc(t)}<button type="button" class="tag-chip-x" data-i="${i}" data-cursor="pointer" aria-label="Remove tag ${esc(t)}">✕</button></span>`
        ).join('')
      : `<span class="tags-empty">No tags yet — add one below.</span>`;
    $$('.tag-chip-x', wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        tagDraft.splice(parseInt(btn.dataset.i, 10), 1);
        renderTagChips();
      });
    });
  }

  function addDraftTag(){
    const input = $('#tags-input');
    const v = input.value.trim().replace(/\s+/g, ' ');
    if(!v) return;
    if(v.length > 24){ $('#tags-error').textContent = 'Keep tags under 24 characters.'; return; }
    if(tagDraft.length >= 8){ $('#tags-error').textContent = 'Max 8 tags per app.'; return; }
    if(tagDraft.some(t => t.toLowerCase() === v.toLowerCase())){
      $('#tags-error').textContent = 'That tag is already on this app.'; return;
    }
    $('#tags-error').textContent = '';
    tagDraft.push(v);
    input.value = '';
    renderTagChips();
    input.focus();
  }

  function openTagEditor(cat, name){
    if(!isAdmin || !tagsOverlay) return;
    tagApp = (BY_CAT[cat] || []).find(a => a.name === name);
    if(!tagApp) return;
    tagDraft = (tagApp.tags || []).slice();
    $('#tags-app-name').textContent = tagApp.name;
    $('#tags-input').value = '';
    $('#tags-error').textContent = '';
    renderTagChips();
    tagsOverlay.classList.add('open');
    setTimeout(() => { try { $('#tags-input').focus(); } catch(e){} }, 80);
  }
  function closeTagEditor(){ if(tagsOverlay) tagsOverlay.classList.remove('open'); tagApp = null; }

  if(tagsOverlay){
    $('#tags-close').addEventListener('click', closeTagEditor);
    $('#tags-cancel').addEventListener('click', closeTagEditor);
    tagsOverlay.addEventListener('click', e => { if(e.target === tagsOverlay) closeTagEditor(); });
    $('#tags-add').addEventListener('click', addDraftTag);
    $('#tags-input').addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ','){ e.preventDefault(); addDraftTag(); }
    });
    $('#tags-form').addEventListener('submit', async e => {
      e.preventDefault();
      if(!tagApp) return;
      // fold any half-typed tag still in the input
      if($('#tags-input').value.trim()) addDraftTag();
      const errEl = $('#tags-error');
      if(DB.ready && tagApp.id != null){
        setFormBusy($('#tags-form'), true, 'Saving…');
        try { await DB.setTags(ownerPass, tagApp.id, tagDraft); }
        catch(err){ setFormBusy($('#tags-form'), false); errEl.textContent = err.message || 'Save failed.'; return; }
        setFormBusy($('#tags-form'), false);
      }
      tagApp.tags = tagDraft.slice();
      saveUploads();
      render();
      buildPaletteApps();
      logActivity('retagged', tagApp.name, tagApp.cat);
      toast('Tags updated for "' + tagApp.name + '".');
      closeTagEditor();
    });
  }

  /* ---------------- OWNER AUTH ---------------- */
  // Fallback gate used only when the database isn't configured (local dev).
  // With Supabase active, the password is verified server-side instead.
  const ADMIN_HASH = '8e9d4e65';
  let isAdmin = false;
  try {
    isAdmin = localStorage.getItem('openhouse-admin') === '1' || sessionStorage.getItem('openhouse-admin') === '1';
    if(isAdmin) localStorage.setItem('openhouse-admin', '1');
  } catch(e){}

  function hashStr(str){
    let h = 5381;
    for(let i = 0; i < str.length; i++){ h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; }
    return h.toString(16);
  }

  function refreshAdminUI(){
    $('#admin-signin-item').hidden = isAdmin;
    $('#admin-upload-item').hidden = !isAdmin;
    $('#admin-signout-item').hidden = !isAdmin;
    renderGrid(); // show/hide the per-category edit + delete controls
  }

  function openLogin(){
    closeMenu();
    $('#login-error').textContent = '';
    $('#login-pass').value = '';
    $('#login-overlay').classList.add('open');
    setTimeout(() => { try { $('#login-pass').focus(); } catch(e){} }, 80);
  }
  function closeLogin(){ $('#login-overlay').classList.remove('open'); }

  /* overflow menu (top bar) */
  const adminMenuWrap = $('#admin-menu-wrap');
  const adminMenu = $('#admin-menu');
  const adminMenuTrigger = $('#admin-menu-trigger');
  function openMenu(){ adminMenu.classList.add('open'); adminMenuTrigger.setAttribute('aria-expanded','true'); }
  function closeMenu(){ adminMenu.classList.remove('open'); adminMenuTrigger.setAttribute('aria-expanded','false'); }
  adminMenuTrigger.addEventListener('click', e => { e.stopPropagation(); adminMenu.classList.contains('open') ? closeMenu() : openMenu(); });
  document.addEventListener('click', e => { if(adminMenuWrap && !adminMenuWrap.contains(e.target)) closeMenu(); });
  $('#admin-signin-item').addEventListener('click', () => { closeMenu(); openLogin(); });
  $('#admin-upload-item').addEventListener('click', () => { if(isAdmin){ closeMenu(); openUpload(); } });
  $('#admin-signout-item').addEventListener('click', () => {
    closeMenu();
    isAdmin = false;
    ownerPass = '';
    try {
      localStorage.removeItem('openhouse-admin');
      localStorage.removeItem('openhouse-pass');
      sessionStorage.removeItem('openhouse-admin');
      sessionStorage.removeItem('openhouse-pass');
    } catch(e){}
    refreshAdminUI();
    toast('Signed out.');
  });

  $('#login-close').addEventListener('click', closeLogin);
  $('#login-overlay').addEventListener('click', e => { if(e.target === $('#login-overlay')) closeLogin(); });
  let loginFails = 0, loginLockedUntil = 0;
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pass = $('#login-pass').value;

    // simple brute-force throttle: growing cooldown after failures
    if(Date.now() < loginLockedUntil){
      const secs = Math.ceil((loginLockedUntil - Date.now()) / 1000);
      $('#login-error').textContent = 'Too many attempts — wait ' + secs + 's.';
      return;
    }

    if(DB.ready){
      // Server-side check — the password is verified by the database,
      // not by anything shipped in this file.
      $('#login-error').textContent = 'Checking…';
      try {
        const ok = await DB.checkPass(pass);
        if(!ok){
          loginFails++;
          if(loginFails >= 3) loginLockedUntil = Date.now() + Math.min(60, 5 * Math.pow(2, loginFails - 3)) * 1000;
          $('#login-error').textContent = 'Incorrect password.';
          return;
        }
        loginFails = 0;
      } catch(err){
        $('#login-error').textContent = err.message || 'Could not reach the database.';
        return;
      }
    } else if(hashStr(pass) !== ADMIN_HASH){
      loginFails++;
      if(loginFails >= 3) loginLockedUntil = Date.now() + Math.min(60, 5 * Math.pow(2, loginFails - 3)) * 1000;
      $('#login-error').textContent = 'Incorrect password.';
      return;
    }

    isAdmin = true;
    ownerPass = pass;
    try {
      localStorage.setItem('openhouse-admin', '1');
      localStorage.setItem('openhouse-pass', pass);
    } catch(e2){}
    refreshAdminUI();
    closeLogin();
    toast('Signed in — you can now upload apps.');
    maybeMigrateLocal(); // offer to publish any apps stuck in this browser
  });

  /* sign-out handling moved into the overflow menu (see above) */

  /* ---------------- UPLOAD / EDIT FLOW ---------------- */
  const uploadOverlay = $('#upload-overlay');
  let pickedThumb = null, repoThumb = '';
  let editingApp = null; // set when the form is editing an existing app

  function populateCategorySelect(){
    const sel = $('#up-category');
    // Featured is curated through the star system — not a direct upload target.
    sel.innerHTML = ORDER.filter(c => c !== 'Featured')
      .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
      + `<option value="__new__">＋ Create new category</option>`;
    syncSelectButton();
  }

  /* ---------------- CUSTOM CATEGORY DROPDOWN ----------------
     The native <select> stays in the DOM (hidden) as the source of
     truth — the visible button + blurred menu mirror it, so every
     existing read of $('#up-category').value keeps working. */
  const catSelect = $('#up-category');
  let selectBtn = null, selectMenu = null;

  function syncSelectButton(){
    if(!selectBtn || !catSelect) return;
    const opt = catSelect.options[catSelect.selectedIndex];
    selectBtn.textContent = opt ? opt.textContent : 'Choose a category';
  }

  if(catSelect && catSelect.parentNode){
    catSelect.classList.add('native-hidden');

    selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'select-btn';
    selectBtn.setAttribute('aria-haspopup', 'listbox');
    catSelect.parentNode.insertBefore(selectBtn, catSelect.nextSibling);

    selectMenu = document.createElement('div');
    selectMenu.className = 'select-menu';
    selectMenu.setAttribute('role', 'listbox');
    document.body.appendChild(selectMenu);

    function closeSelectMenu(){ selectMenu.classList.remove('open'); }

    function openSelectMenu(){
      // rebuild items from the native options
      selectMenu.innerHTML = '';
      Array.from(catSelect.options).forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'select-item' + (opt.selected ? ' active' : '');
        b.textContent = opt.textContent;
        b.addEventListener('click', () => {
          catSelect.value = opt.value;
          catSelect.dispatchEvent(new Event('change', { bubbles:true }));
          syncSelectButton();
          closeSelectMenu();
        });
        selectMenu.appendChild(b);
      });
      // position under the button (fixed coords, flip up if needed)
      const r = selectBtn.getBoundingClientRect();
      const pad = 8, gap = 6;
      const menuH = Math.min(window.innerHeight * 0.46, catSelect.options.length * 42 + 10);
      let top = r.bottom + gap;
      const flipUp = top + menuH > window.innerHeight - pad;
      if(flipUp) top = Math.max(pad, r.top - gap - menuH);
      selectMenu.style.left = r.left + 'px';
      selectMenu.style.width = r.width + 'px';
      selectMenu.style.top = top + 'px';
      selectMenu.classList.toggle('up', flipUp);
      selectMenu.classList.add('open');
    }

    selectBtn.addEventListener('click', e => {
      e.stopPropagation();
      selectMenu.classList.contains('open') ? closeSelectMenu() : openSelectMenu();
    });
    selectMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeSelectMenu);
    // close when the upload modal itself scrolls (button moves)
    const uploadModalEl = document.querySelector('.upload-modal');
    if(uploadModalEl) uploadModalEl.addEventListener('scroll', closeSelectMenu, { passive:true });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSelectMenu(); });
    catSelect.addEventListener('change', syncSelectButton);
  }

  function showThumb(src){
    const img = $('#up-thumb-preview');
    img.src = src;
    img.hidden = false;
  }

  function openUpload(editApp){
    closeMenu();
    editingApp = editApp || null;
    $('#upload-form').reset();
    $('#up-license').value = '';
    $('#up-repo-hint').textContent = 'Paste a repo URL and I\'ll pull the description automatically.';
    $('#upload-error').textContent = '';
    $('#up-newcat-field').hidden = true;
    if($('#up-newcat-icon-field')) $('#up-newcat-icon-field').hidden = true;
    $('#up-thumb-preview').hidden = true;
    pickedThumb = null; repoThumb = '';
    populateCategorySelect();

    // adapt the modal chrome for edit vs upload
    const modal = uploadOverlay.querySelector('.upload-modal');
    modal.querySelector('h3').textContent = editingApp ? 'Edit app' : 'Upload an app';
    modal.querySelector('.upload-sub').textContent = editingApp
      ? 'Update the details of this listing.'
      : 'List a new open source app in the directory.';
    $('#upload-form').querySelector('button[type="submit"]').textContent =
      editingApp ? 'Save changes' : 'Publish app';

    if(editingApp){
      $('#up-name').value = editingApp.name;
      $('#up-desc').value = editingApp.desc;
      $('#up-repo').value = editingApp.repo || '';
      $('#up-license').value = editingApp.license || '';
      // legacy apps uploaded straight into Featured keep their option
      if(editingApp.cat === 'Featured'){
        const opt = document.createElement('option');
        opt.value = 'Featured'; opt.textContent = 'Featured';
        $('#up-category').insertBefore(opt, $('#up-category').firstChild);
      }
      if(ORDER.includes(editingApp.cat)){ $('#up-category').value = editingApp.cat; syncSelectButton(); }
      if(editingApp.thumb){ repoThumb = editingApp.thumb; showThumb(editingApp.thumb); }
    }
    uploadOverlay.classList.add('open');
  }
  function closeUpload(){ uploadOverlay.classList.remove('open'); }

  $('#upload-close').addEventListener('click', closeUpload);
  $('#upload-cancel').addEventListener('click', closeUpload);
  $('#upload-overlay').addEventListener('click', e => { if(e.target === uploadOverlay) closeUpload(); });

  $('#up-category').addEventListener('change', () => {
    const isNew = $('#up-category').value === '__new__';
    $('#up-newcat-field').hidden = !isNew;
    if($('#up-newcat-icon-field')) $('#up-newcat-icon-field').hidden = !isNew;
  });

  $('#up-thumb').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = () => { pickedThumb = r.result; showThumb(pickedThumb); };
    r.readAsDataURL(file);
  });

  /* Fetch repo metadata from GitHub, GitLab, Gitea/Forgejo (incl. Codeberg),
     or Bitbucket — self-hosted instances included. Returns a normalized
     { name, desc, license, topics, avatar, source } object. */
  function parseRepoUrl(url){
    url = String(url || '').trim();
    let m = url.match(/^https?:\/\/([^\/\s]+)\/([^\/\s]+)\/([^\/\s?#]+)/i);
    if(m) return { host: m[1].toLowerCase(), owner: m[2], repo: m[3].replace(/\.git$/, '') };
    m = url.match(/^([\w.-]+\.[a-z]{2,})\/([^\/\s]+)\/([^\/\s?#]+)/i);
    if(m) return { host: m[1].toLowerCase(), owner: m[2], repo: m[3].replace(/\.git$/, '') };
    m = url.match(/^([\w.-]+)\/([\w.-]+)$/); // bare owner/repo → GitHub
    if(m) return { host: 'github.com', owner: m[1], repo: m[2].replace(/\.git$/, '') };
    return null;
  }

  function fetchTimed(u, opts, ms){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 6000);
    return fetch(u, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }

  async function getJSON(u, headers){
    // 1) direct (6s cap) — hosts with CORS headers answer here
    try {
      const res = await fetchTimed(u, headers ? { headers } : undefined, 6000);
      if(res.ok) return res.json();
      if(res.status === 404) throw new Error('http 404');
      // 403 (e.g. GitHub rate limit) falls through to the proxies below
    } catch(e){
      if(e.message === 'http 404') throw e; // real "not found" — stop here
    }
    // 2) CORS-blocked (typical for self-hosted forges) → proxy fallbacks.
    //    First our own Vercel function (fast + reliable), then public ones.
    const proxies = [
      x => '/api/repo-proxy?url=' + encodeURIComponent(x),
      x => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(x),
      x => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(x)
    ];
    for(const wrap of proxies){
      try {
        const res = await fetchTimed(wrap(u), undefined, 6000);
        if(res.ok) return res.json();
      } catch(e){ /* next proxy */ }
    }
    throw new Error('unreachable');
  }

  async function fetchRepo(url){
    const p = parseRepoUrl(url);
    if(!p) throw new Error('bad url');
    const { host, owner, repo } = p;
    const o = encodeURIComponent(owner), r = encodeURIComponent(repo);

    if(host === 'github.com' || host === 'www.github.com'){
      const d = await getJSON('https://api.github.com/repos/' + o + '/' + r,
        { 'Accept': 'application/vnd.github+json' });
      return {
        name: d.name, desc: d.description || '',
        license: (d.license && d.license.spdx_id && d.license.spdx_id !== 'NOASSERTION') ? d.license.spdx_id : '',
        topics: d.topics || [], avatar: (d.owner && d.owner.avatar_url) || '', source: 'GitHub'
      };
    }

    if(host === 'bitbucket.org'){
      const d = await getJSON('https://api.bitbucket.org/2.0/repositories/' + o + '/' + r);
      return {
        name: d.name, desc: d.description || '', license: '',
        topics: [], avatar: (d.links && d.links.avatar && d.links.avatar.href) || '', source: 'Bitbucket'
      };
    }

    const isGitlab = host === 'gitlab.com' || host.includes('gitlab');
    const gitlabFetch = async () => {
      const d = await getJSON('https://' + host + '/api/v4/projects/' + encodeURIComponent(owner + '/' + repo) + '?license=true');
      return {
        name: d.name, desc: d.description || '',
        license: (d.license && (d.license.nickname || d.license.key || d.license.name)) || '',
        topics: d.topics || d.tag_list || [],
        avatar: d.avatar_url || (d.namespace && d.namespace.avatar_url) || '', source: 'GitLab'
      };
    };
    const giteaFetch = async () => {
      const d = await getJSON('https://' + host + '/api/v1/repos/' + o + '/' + r);
      const lic = Array.isArray(d.licenses) && d.licenses.length ? d.licenses[0] : '';
      return {
        name: d.name, desc: d.description || '', license: lic,
        topics: d.topics || [], avatar: d.avatar_url || (d.owner && d.owner.avatar_url) || '',
        source: host === 'codeberg.org' ? 'Codeberg' : 'Gitea'
      };
    };

    // Known GitLab hosts go straight to the GitLab API. Unknown hosts
    // probe both APIs in parallel — first success wins, so a slow or
    // failing probe never blocks the other.
    if(isGitlab) return gitlabFetch();
    if(typeof Promise.any === 'function'){
      return Promise.any([giteaFetch(), gitlabFetch()]);
    }
    try { return await giteaFetch(); }
    catch(e){ return gitlabFetch(); }
  }


  async function autoFillFromRepo(){
    const url = $('#up-repo').value.trim();
    const hint = $('#up-repo-hint');
    const errEl = $('#upload-error');
    if(!url){ hint.textContent = 'Enter a repository URL first.'; return; }
    hint.textContent = 'Fetching repo info…';
    errEl.textContent = '';
    try {
      const d = await fetchRepo(url);
      if(d.desc) $('#up-desc').value = d.desc;
      if(!$('#up-name').value.trim() && d.name) $('#up-name').value = d.name;
      $('#up-license').value = d.license || '';
      if(d.topics && d.topics.length){
        const lower = ORDER.map(x => x.toLowerCase());
        const match = d.topics.find(t => lower.includes(String(t).toLowerCase()));
        if(match){ $('#up-category').value = match; $('#up-newcat-field').hidden = true; syncSelectButton(); }
      }
      repoThumb = d.avatar || '';
      if(!pickedThumb && repoThumb) showThumb(repoThumb);
      hint.textContent = 'Pulled from ' + d.source + ' — edit the description if you like.';
    } catch(e){
      hint.textContent = 'Could not read that repo. You can type the description manually.';
    }
  }

  $('#up-fetch').addEventListener('click', autoFillFromRepo);
  $('#up-repo').addEventListener('blur', autoFillFromRepo);

  function setFormBusy(form, busy, label){
    const btn = form.querySelector('button[type="submit"]');
    if(!btn) return;
    if(busy){
      btn.dataset.label = btn.textContent;
      // lock current width so the shorter/longer label can't resize the pill
      btn.style.width = btn.getBoundingClientRect().width + 'px';
      btn.textContent = label || 'Working…';
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.style.width = '';
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }

  $('#upload-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#upload-error');
    const name = $('#up-name').value.trim();
    let cat = $('#up-category').value;
    if(cat === '__new__') cat = $('#up-newcat').value.trim();
    if(!name){ errEl.textContent = 'App name is required.'; return; }
    if(!cat){ errEl.textContent = 'Choose or create a category.'; return; }

    // Duplicate check (skipped for the app being edited): same name
    // anywhere, or same repo anywhere.
    const repoNorm = normalizeRepo($('#up-repo').value.trim()).toLowerCase().replace(/\/+$/, '');
    const dupe = UPLOADS.find(a => {
      if(editingApp && a === editingApp) return false;
      if(a.name.trim().toLowerCase() === name.toLowerCase()) return true;
      if(repoNorm && a.repo && normalizeRepo(a.repo).toLowerCase().replace(/\/+$/, '') === repoNorm) return true;
      return false;
    });
    if(dupe){
      errEl.textContent = '“' + dupe.name + '” is already listed' +
        (dupe.cat ? ' in ' + dupe.cat : '') + ' — no duplicates allowed.';
      return;
    }

    // Optional emoji chosen while creating a new category
    const newIconRaw = $('#up-newcat-icon') ? $('#up-newcat-icon').value : '';
    const newIcon = firstGrapheme(newIconRaw);
    if($('#up-category').value === '__new__' && newIcon){
      CUSTOM_GLYPHS[cat] = newIcon;
      if(DB.ready){ DB.setMeta(ownerPass, 'cat_icons', CUSTOM_GLYPHS).catch(()=>{}); }
      else saveJSON(LS_ICONS, CUSTOM_GLYPHS);
    }

    const obj = {
      name,
      cat,
      icon: glyphFor(cat),
      desc: $('#up-desc').value.trim() || 'No description provided.',
      tags: [cat],
      license: $('#up-license').value.trim() || 'MIT',
      added: new Date().toISOString().slice(0, 10),
      repo: $('#up-repo').value.trim(),
      thumb: pickedThumb || repoThumb || '',
      starred: false
    };

    /* ----- EDIT MODE: update the existing app in place ----- */
    if(editingApp){
      const app = editingApp;
      const prevCat = app.cat;
      const patch = {
        name, cat, icon: glyphFor(cat),
        description: obj.desc, license: obj.license,
        repo: obj.repo,
        thumb: pickedThumb || app.thumb || repoThumb || ''
      };
      if(DB.ready && app.id != null){
        setFormBusy($('#upload-form'), true, 'Saving…');
        try { await DB.updateApp(ownerPass, app.id, patch); }
        catch(err){ setFormBusy($('#upload-form'), false); errEl.textContent = err.message || 'Save failed.'; return; }
        setFormBusy($('#upload-form'), false);
      }
      app.name = name;
      app.cat = cat;
      app.icon = patch.icon;
      app.desc = obj.desc;
      app.license = obj.license;
      app.repo = obj.repo;
      app.thumb = patch.thumb;
      unhideCat(cat);
      saveUploads();
      rebuildData();
      renderGrid();
      buildPaletteApps();
      updateStats();
      render();
      errEl.textContent = '';
      editingApp = null;
      closeUpload();
      if(prevCat !== cat) logActivity('moved', name, cat, { from: prevCat });
      else logActivity('edited', name, cat);
      toast('“' + name + '” updated.');
      return;
    }

    if(DB.ready){
      setFormBusy($('#upload-form'), true, 'Publishing…');
      try {
        const id = await DB.addApp(ownerPass, {
          name: obj.name, cat: obj.cat, icon: obj.icon, description: obj.desc,
          tags: obj.tags, license: obj.license, repo: obj.repo, thumb: obj.thumb
        });
        obj.id = id;
      } catch(err){
        setFormBusy($('#upload-form'), false);
        errEl.textContent = err.message || 'Publish failed — check your connection.';
        return;
      }
      setFormBusy($('#upload-form'), false);
    }

    unhideCat(cat);
    BY_CAT[cat] = BY_CAT[cat] || [];
    if(!ORDER.includes(cat)) ORDER.push(cat);
    BY_CAT[cat].push(obj);
    UPLOADS.push(obj);
    saveUploads();
    renderGrid();
    buildPaletteApps();
    updateStats();

    errEl.textContent = '';
    closeUpload();
    logActivity('added', name, cat);
    toast('App published to “' + cat + '”.');
    openCat(cat);
  });

  /* ---------------- BACKGROUND INTERACTION LOCK ---------------- */
  // When ANY .modal-overlay is open, disable pointer events + scroll on the
  // page behind it. Covers the welcome, shortcuts, category, login and
  // upload popups automatically.
  const overlays = $$('.modal-overlay');
  if('MutationObserver' in window){
    const obs = new MutationObserver(() => {
      const anyOpen = $$('.modal-overlay.open').length > 0;
      document.body.classList.toggle('modal-open', anyOpen);
    });
    overlays.forEach(o => obs.observe(o, { attributes: true, attributeFilter: ['class'] }));
  }

  /* ---------------- GLOBAL ESCAPE ---------------- */
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(adminMenu && adminMenu.classList.contains('open')){ closeMenu(); return; }
    if(iconOverlay && iconOverlay.classList.contains('open')) closeIconEditor();
    else if(tagsOverlay && tagsOverlay.classList.contains('open')) closeTagEditor();
    else if($('#cat-overlay').classList.contains('open')) closeCat();
    else if(uploadOverlay.classList.contains('open')) closeUpload();
    else if($('#login-overlay').classList.contains('open')) closeLogin();
  });

  /* ---------------- TOAST ---------------- */
  const toastStack = $('#toast-stack');
  function toast(msg){
    if(!toastStack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="dot"></span><span>${esc(msg)}</span>`;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  /* ---------------- PALETTE APPS + DELETE ---------------- */
  /* ---------------- CHANGELOG: APPS PANE ----------------
     Newest first, grouped by month, using each app's added date. */
  function buildAppLog(){
    const appsPane = $('#changelog-apps');
    const sitePane = $('#changelog-website');

    // Apply dynamic fade to both changelog sections
    if(appsPane) setupDynamicFade(appsPane);
    if(sitePane) setupDynamicFade(sitePane);

    // Merge the live activity feed with an "added" event per app (covers
    // apps published before activity logging existed). Deduplicate adds.
    const events = [];
    const seenAdd = new Set();
    ACTIVITY.forEach(ev => {
      if(ev.act === 'added') seenAdd.add(ev.name.toLowerCase());
      events.push(ev);
    });
    UPLOADS.forEach(a => {
      if(!seenAdd.has(a.name.toLowerCase())){
        events.push({ t: a.added || '', act: 'added', name: a.name, cat: a.cat });
      }
    });
    events.sort((a, b) => (a.t || '') < (b.t || '') ? 1 : -1);

    if(!events.length){
      if (appsPane) appsPane.innerHTML = '<p class="log-empty">No activity yet.</p>';
      if (sitePane) sitePane.innerHTML = '<p class="log-empty">No activity yet.</p>'; 
      return;
    }

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const VERB = {
      added:     a => `added to <em>${esc(a.cat)}</em>`,
      edited:    a => `was edited`,
      moved:     a => `moved ${a.from ? 'from <em>' + esc(a.from) + '</em> ' : ''}to <em>${esc(a.cat)}</em>`,
      starred:   a => `starred — now in <em>Featured</em>`,
      unstarred: a => `removed from <em>Featured</em>`,
      retagged:  a => `got new tags`,
      deleted:   a => `deleted from <em>${esc(a.cat)}</em>`
    };
    const groups = [];
    events.slice(0, 80).forEach(ev => {
      const d = new Date(ev.t || Date.now());
      const label = isNaN(d) ? 'Earlier' : MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      let g = groups[groups.length - 1];
      if(!g || g.label !== label){ g = { label, items: [] }; groups.push(g); }
      const day = isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()].slice(0, 3);
      g.items.push({ ev, day });
    });
    pane.innerHTML = groups.map(g => `
      <div class="log-entry">
        <span class="log-date">${esc(g.label)}</span>
        <ul class="info-list log-apps">
          ${g.items.map(({ ev, day }) => `
            <li class="log-act log-act-${esc(ev.act)}"><strong>${esc(ev.name)}</strong> ${(VERB[ev.act] || VERB.edited)(ev)}${day ? ` <span class="log-day">· ${esc(day)}</span>` : ''}</li>`).join('')}
        </ul>
      </div>`).join('');
  }

  function buildPaletteApps(){
    buildAppLog(); // keep the changelog's Apps pane in sync with the data
    // Search results: categories + apps only.
    const results = $('#palette-results');
    if(!results) return;
    results.innerHTML = '';
    function addItem(searchText, html, cat, appName){
      const li = document.createElement('li');
      li.className = 'palette-app';
      li.dataset.search = searchText.toLowerCase();
      li.innerHTML = html;
      li.addEventListener('click', () => {
        const ov = $('#palette-overlay');
        if(ov) ov.classList.remove('open');
        openCat(cat);
        if(appName) scrollToApp(appName);
      });
      results.appendChild(li);
    }
    ORDER.forEach(cat => {
      const n = (BY_CAT[cat] || []).length;
      addItem(cat, `<span>${esc(glyphFor(cat))} ${esc(cat)}</span><em>Category · ${n}</em>`, cat);
    });
    ORDER.forEach(cat => {
      (BY_CAT[cat] || []).forEach(app => {
        addItem(app.name + ' ' + cat + ' ' + (app.repo || ''),
          `<span>${esc(app.name)} <em>${esc(cat)}</em></span><em>App</em>`, cat, app.name);
      });
    });
  }

  async function deleteApp(cat, name, silent){
    if(DB.ready){
      const app = (BY_CAT[cat] || []).find(a => a.name === name);
      if(app && app.id != null){
        try { await DB.deleteApp(ownerPass, app.id); }
        catch(e){ toast(e.message || 'Delete failed.'); return; }
      }
    }
    BY_CAT[cat] = (BY_CAT[cat] || []).filter(a => !(a.cat === cat && a.name === name));
    UPLOADS = UPLOADS.filter(a => !(a.cat === cat && a.name === name));
    saveUploads();
    buildPaletteApps();
    renderGrid();
    render();
    updateStats();
    logActivity('deleted', name, cat);
    if(!silent) toast('App deleted.');
  }

  /* ---------------- MIGRATION (local → database, one-time) ----------------
     If you added apps before the database was set up, they only lived in
     this browser's localStorage. Once signed in (with the DB configured),
     this offers to push those local apps to the shared database. */
  async function maybeMigrateLocal(){
    if(!DB.ready || !isAdmin || !LOCAL_UPLOADS.length) return;
    let done = false;
    try { done = localStorage.getItem('openhouse-migrated') === '1'; } catch(e){}
    if(done) return;
    const n = LOCAL_UPLOADS.length;
    if(!(await askConfirm(n + ' app' + (n === 1 ? '' : 's') + ' from this browser haven\'t been published to the shared database yet. Publish them now so everyone can see them?', 'Publish'))) return;
    let ok = 0, fail = 0;
    for(const a of LOCAL_UPLOADS){
      try {
        await DB.addApp(ownerPass, {
          name: a.name, cat: a.cat, icon: a.icon || '•', description: a.desc,
          tags: a.tags || [a.cat], license: a.license || 'MIT',
          repo: a.repo || '', thumb: a.thumb || ''
        });
        ok++;
      } catch(e){ fail++; }
    }
    try { localStorage.setItem('openhouse-migrated', '1'); } catch(e){}
    toast('Published ' + ok + ' local app' + (ok === 1 ? '' : 's') + (fail ? ' (' + fail + ' failed)' : '') + '.');
    loadFromDB();
  }

  /* ---------------- INIT ---------------- */
  renderGrid();
  refreshAdminUI();
  buildPaletteApps();
  if(DB.ready){
    loadFromDB().then(() => { handleDeepLink(); maybeMigrateLocal(); });
  } else {
    handleDeepLink();
  }
  window.addEventListener('hashchange', handleDeepLink);

  // Keep the hero stats in sync with the real (incl. uploaded) totals.
  function updateStats(){
    const statNums = $$('.stats .stat-num');
    const totalApps = UPLOADS.length;
    if(statNums[0]) statNums[0].dataset.count = totalApps;
    if(statNums[1]) statNums[1].dataset.count = ORDER.length;
    // keep hero + CTA copy in sync with the real count
    const hero = $('#hero-app-count');
    if(hero && totalApps) hero.textContent = totalApps + '+';
    const cta = $('#cta-app-count');
    if(cta && totalApps) cta.textContent = totalApps + ' apps and counting ·';
  }
  updateStats();
})();
