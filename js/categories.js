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
    'Featured':'✦', 'Media':'♪', 'Productivity':'✓', 'Finance':'$', 'Dev Tools':'◧',
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

  // Owner password is kept for the session so DB writes can be authorised
  // server-side (Supabase re-checks it on every write).
  let ownerPass = '';
  try { ownerPass = sessionStorage.getItem('openhouse-pass') || ''; } catch(e){}

  // Build the initial category/app maps (must run AFTER UPLOADS + DB exist).
  rebuildData();

  /* ---------------- LOAD FROM DATABASE ---------------- */
  async function loadFromDB(){
    if(!DB.ready) return;
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
  const PAGE_SIZE = 3; // 3 apps per page; new apps flow onto the next page
  const cur = { cat:null, page:1 };

  /* ---------------- DIRECTORY ELEMENTS ---------------- */
  const grid     = $('#cat-grid');
  const overlay  = $('#cat-overlay');
  const titleEl  = $('#cat-title');
  const metaEl   = $('#cat-meta');
  const pagesEl  = $('#cat-pages');
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
      return `<button class="cat-pill" data-cat="${esc(cat)}" data-cursor="pointer" aria-label="Open ${esc(cat)} category" style="--i:${idx}">
        <span class="cat-ico">${esc(glyphFor(cat))}</span>
        <span class="cat-name">${esc(cat)}</span>
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

  /* ---------------- DELETE CATEGORY (owner only) ---------------- */
  async function deleteCategory(cat){
    if(!isAdmin) return;
    const n = (BY_CAT[cat] || []).length;
    const msg = n
      ? `Delete the "${cat}" category and the ${n} app${n === 1 ? '' : 's'} inside it? This cannot be undone.`
      : `Delete the empty "${cat}" category?`;
    if(!window.confirm(msg)) return;

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
    cur.page = 1;
    titleEl.textContent = cat;
    render();
    overlay.classList.add('open');
  }
  function closeCat(){ overlay.classList.remove('open'); if(typeof closeCardMenu === 'function') closeCardMenu(); }

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
    const total = Math.max(1, Math.ceil(apps.length / PAGE_SIZE));
    cur.page = Math.min(Math.max(cur.page, 1), total);

    metaEl.textContent = apps.length + (apps.length === 1 ? ' app' : ' apps');

    // Pages pill
    let pg = `<button class="pg prev" data-pg="prev" ${cur.page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
    for(let p = 1; p <= total; p++){
      pg += `<button class="pg ${p === cur.page ? 'active' : ''}" data-pg="${p}" aria-label="Page ${p}">${p}</button>`;
    }
    pg += `<button class="pg next" data-pg="next" ${cur.page === total ? 'disabled' : ''} aria-label="Next page">›</button>`;
    pagesEl.innerHTML = pg;


    // List
    const start = (cur.page - 1) * PAGE_SIZE;
    const slice = apps.slice(start, start + PAGE_SIZE);
    listEl.innerHTML = slice.length
      ? slice.map((a, i) => cardHTML(a, i)).join('')
      : `<p class="cat-empty">No apps in this category yet.</p>`;
    bindCards();
  }

  function cardHTML(a, i){
    const media = a.thumb
      ? `<img class="cat-thumb" src="${a.thumb}" alt="${esc(a.name)}" loading="lazy" decoding="async">`
      : `<span class="app-icon">${esc(a.icon || glyphFor(a.cat))}</span>`;
    const tags = (a.tags || []).concat([a.license]).map(t => `<span>${esc(t)}</span>`).join('');
    const delBtn = isAdmin ? `<button class="cat-del" data-cursor="pointer" aria-label="Delete app" title="Delete app"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : '';
    const menuBtn = isAdmin ? `<button class="cat-menu-btn" data-cursor="pointer" aria-label="App actions" aria-haspopup="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>` : '';
    const starBadge = a.starred ? `<span class="cat-star-badge" title="Featured" aria-label="Featured">★</span>` : '';
    return `<article class="cat-app tilt-card" data-cursor="pointer" data-repo="${esc(a.repo || '')}" data-name="${esc(a.name)}" data-cat="${esc(a.cat)}" style="animation-delay:${(i*0.05).toFixed(2)}s">
      <div class="card-glow"></div>
      ${delBtn}${menuBtn}${starBadge}
      ${media}
      <div class="cat-app-body">
        <h4>${esc(a.name)}</h4>
        <p>${esc(a.desc)}</p>
        <div class="app-tags">${tags}</div>
      </div>
    </article>`;
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
        if(repo) window.open(repo, '_blank', 'noopener');
        else toast('No repo linked to this app yet.');
      });
      const del = card.querySelector('.cat-del');
      if(del) del.addEventListener('click', e => {
        e.stopPropagation();
        const name = card.dataset.name;
        if(name && window.confirm('Delete "' + name + '"? This cannot be undone.')){
          deleteApp(card.dataset.cat, name);
        }
      });
      const menuBtn = card.querySelector('.cat-menu-btn');
      if(menuBtn) menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const cat = card.dataset.cat, name = card.dataset.name;
        const app = (BY_CAT[cat] || []).find(a => a.name === name);
        toggleCardMenu(menuBtn, cat, name, !!(app && app.starred));
      });
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
    <button class="cat-menu-item" data-act="edit" role="menuitem" data-cursor="pointer">Edit app</button>
    <button class="cat-menu-item" data-act="star" role="menuitem" data-cursor="pointer">Star app</button>
    <button class="cat-menu-item" data-act="tags" role="menuitem" data-cursor="pointer">Edit tags</button>`;
  document.body.appendChild(cardMenu);
  let cardMenuCtx = null; // { cat, name }

  function toggleCardMenu(btn, cat, name, starred){
    if(cardMenu.classList.contains('open') && cardMenuCtx && cardMenuCtx.name === name && cardMenuCtx.cat === cat){
      closeCardMenu();
      return;
    }
    cardMenuCtx = { cat, name };
    cardMenu.querySelector('[data-act="star"]').textContent = starred ? 'Unstar' : 'Star app';
    // position: below the button, right-aligned; flip up if no room
    const r = btn.getBoundingClientRect();
    const menuW = 150, menuH = 130, gap = 6, pad = 8;
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
      else if(act === 'edit'){
        const app = UPLOADS.find(a => a.cat === ctx.cat && a.name === ctx.name);
        if(app) openUpload(app);
      }
    });
  });
  // close on outside tap, scroll inside the list, or popup close
  document.addEventListener('click', closeCardMenu);
  if(listEl) listEl.addEventListener('scroll', closeCardMenu, { passive:true });

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
        errEl.textContent = 'Saving…';
        try { await DB.setTags(ownerPass, tagApp.id, tagDraft); }
        catch(err){ errEl.textContent = err.message || 'Save failed.'; return; }
      }
      tagApp.tags = tagDraft.slice();
      saveUploads();
      render();
      buildPaletteApps();
      toast('Tags updated for "' + tagApp.name + '".');
      closeTagEditor();
    });
  }

  /* ---------------- PAGINATION + SORT ---------------- */
  pagesEl.addEventListener('click', e => {
    const btn = e.target.closest('.pg');
    if(!btn || btn.disabled) return;
    const total = Math.max(1, Math.ceil(((BY_CAT[cur.cat] || []).length) / PAGE_SIZE));
    const v = btn.dataset.pg;
    if(v === 'prev')      cur.page = Math.max(1, cur.page - 1);
    else if(v === 'next') cur.page = Math.min(total, cur.page + 1);
    else                  cur.page = parseInt(v, 10);
    render();
  });

  /* ---------------- OWNER AUTH ---------------- */
  // NOTE: This is a client-side gate. The password hash lives in the
  // shipped JS, so it is NOT a substitute for a real server. It keeps the
  // upload UI out of casual view on a personal site. To change the password:
  //   node -e "let h=5381;for(const c of 'YOURPASSWORD')h=((h<<5)+h+c.charCodeAt(0))>>>0;console.log(h.toString(16))"
  // then replace ADMIN_HASH below.
  const ADMIN_HASH = '8e9d4e65'; // password: #Kshitij@2131
  let isAdmin = false;
  try { isAdmin = sessionStorage.getItem('openhouse-admin') === '1'; } catch(e){}

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
      sessionStorage.removeItem('openhouse-admin');
      sessionStorage.removeItem('openhouse-pass');
    } catch(e){}
    refreshAdminUI();
    toast('Signed out.');
  });

  $('#login-close').addEventListener('click', closeLogin);
  $('#login-overlay').addEventListener('click', e => { if(e.target === $('#login-overlay')) closeLogin(); });
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pass = $('#login-pass').value;

    if(DB.ready){
      // Server-side check — the password is verified by the database,
      // not by anything shipped in this file.
      $('#login-error').textContent = 'Checking…';
      try {
        const ok = await DB.checkPass(pass);
        if(!ok){ $('#login-error').textContent = 'Incorrect password.'; return; }
      } catch(err){
        $('#login-error').textContent = err.message || 'Could not reach the database.';
        return;
      }
    } else if(hashStr(pass) !== ADMIN_HASH){
      $('#login-error').textContent = 'Incorrect password.';
      return;
    }

    isAdmin = true;
    ownerPass = pass;
    try {
      sessionStorage.setItem('openhouse-admin', '1');
      sessionStorage.setItem('openhouse-pass', pass);
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
    sel.innerHTML = ORDER.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
      + `<option value="__new__">＋ Create new category</option>`;
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
    $('#up-repo-hint').textContent = 'Paste a GitHub repo URL and we\'ll pull the description automatically.';
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
      if(ORDER.includes(editingApp.cat)) $('#up-category').value = editingApp.cat;
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

  async function fetchRepo(url){
    const m = url.match(/github\.com\/([^\/\s]+)\/([^\/\s?#]+)/i) || url.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    if(!m) throw new Error('bad url');
    const owner = encodeURIComponent(m[1]);
    const repo  = encodeURIComponent(m[2].replace(/\.git$/, ''));
    const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if(!res.ok) throw new Error('not found');
    return res.json();
  }

  async function autoFillFromRepo(){
    const url = $('#up-repo').value.trim();
    const hint = $('#up-repo-hint');
    const errEl = $('#upload-error');
    if(!url){ hint.textContent = 'Enter a GitHub repo URL first.'; return; }
    hint.textContent = 'Fetching repo info…';
    errEl.textContent = '';
    try {
      const d = await fetchRepo(url);
      if(d.description) $('#up-desc').value = d.description;
      if(!$('#up-name').value.trim() && d.name) $('#up-name').value = d.name;
      const lic = (d.license && d.license.spdx_id && d.license.spdx_id !== 'NOASSERTION') ? d.license.spdx_id : '';
      $('#up-license').value = lic;
      if(d.topics && d.topics.length){
        const lower = ORDER.map(x => x.toLowerCase());
        const match = d.topics.find(t => lower.includes(t.toLowerCase()));
        if(match){ $('#up-category').value = match; $('#up-newcat-field').hidden = true; }
      }
      repoThumb = (d.owner && d.owner.avatar_url) || '';
      if(!pickedThumb && repoThumb) showThumb(repoThumb);
      hint.textContent = 'Pulled from GitHub — edit the description if you like.';
    } catch(e){
      hint.textContent = 'Could not read that repo. You can type the description manually.';
    }
  }

  $('#up-fetch').addEventListener('click', autoFillFromRepo);
  $('#up-repo').addEventListener('blur', autoFillFromRepo);

  $('#upload-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#upload-error');
    const name = $('#up-name').value.trim();
    let cat = $('#up-category').value;
    if(cat === '__new__') cat = $('#up-newcat').value.trim();
    if(!name){ errEl.textContent = 'App name is required.'; return; }
    if(!cat){ errEl.textContent = 'Choose or create a category.'; return; }

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
      const patch = {
        name, cat, icon: glyphFor(cat),
        description: obj.desc, license: obj.license,
        repo: obj.repo,
        thumb: pickedThumb || app.thumb || repoThumb || ''
      };
      if(DB.ready && app.id != null){
        errEl.textContent = 'Saving…';
        try { await DB.updateApp(ownerPass, app.id, patch); }
        catch(err){ errEl.textContent = err.message || 'Save failed.'; return; }
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
      toast('“' + name + '” updated.');
      return;
    }

    if(DB.ready){
      errEl.textContent = 'Publishing…';
      try {
        const id = await DB.addApp(ownerPass, {
          name: obj.name, cat: obj.cat, icon: obj.icon, description: obj.desc,
          tags: obj.tags, license: obj.license, repo: obj.repo, thumb: obj.thumb
        });
        obj.id = id;
      } catch(err){
        errEl.textContent = err.message || 'Publish failed — check your connection.';
        return;
      }
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
  function buildPaletteApps(){
    // Search results: categories + apps only.
    const results = $('#palette-results');
    if(!results) return;
    results.innerHTML = '';
    function addItem(searchText, html, cat){
      const li = document.createElement('li');
      li.className = 'palette-app';
      li.dataset.search = searchText.toLowerCase();
      li.innerHTML = html;
      li.addEventListener('click', () => {
        const ov = $('#palette-overlay');
        if(ov) ov.classList.remove('open');
        openCat(cat);
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
          `<span>${esc(app.name)} <em>${esc(cat)}</em></span><em>App</em>`, cat);
      });
    });
  }

  async function deleteApp(cat, name){
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
    toast('App deleted.');
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
    if(!window.confirm(n + ' app' + (n === 1 ? '' : 's') + ' from this browser haven\'t been published to the shared database yet. Publish them now so everyone can see them?')) return;
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
    loadFromDB().then(maybeMigrateLocal);
  }

  // Keep the hero stats in sync with the real (incl. uploaded) totals.
  function updateStats(){
    const statNums = $$('.stats .stat-num');
    const totalApps = Object.keys(BY_CAT).reduce((n, c) => n + BY_CAT[c].length, 0);
    if(statNums[0]) statNums[0].dataset.count = totalApps;
    if(statNums[1]) statNums[1].dataset.count = ORDER.length;
  }
  updateStats();
})();
