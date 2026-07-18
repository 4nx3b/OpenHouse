/* ============================================================
   Openhouse — Category Directory + Owner upload
   - Category pills; each opens a popup with paginated +
     sortable (Newest / Oldest) app listings.
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
  const ORDER = ['Featured','Media','Productivity','Finance','Dev Tools','Notes',
                 'Utilities','Communication','Design','Security','Health','Tools'];

  const GLYPH = {
    'Featured':'✦', 'Media':'♪', 'Productivity':'✓', 'Finance':'$', 'Dev Tools':'◧',
    'Notes':'✎', 'Utilities':'⚙', 'Communication':'✉', 'Design':'◑',
    'Security':'🔒', 'Health':'♥', 'Tools':'🧰'
  };

  // Categories start empty — owners populate them through the upload flow.
  const APPS = [];
  const BY_CAT = {};
  ORDER.forEach(c => BY_CAT[c] = []);

  /* ---------------- PERSISTENCE (owner uploads) ---------------- */
  const LS_KEY = 'openhouse-uploads';
  let UPLOADS = loadUploads();
  function loadUploads(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; } }
  function saveUploads(){ try { localStorage.setItem(LS_KEY, JSON.stringify(UPLOADS)); } catch(e){} }
  function mergeUploads(){
    UPLOADS.forEach(a => {
      BY_CAT[a.cat] = BY_CAT[a.cat] || [];
      if(!ORDER.includes(a.cat)) ORDER.push(a.cat);
      BY_CAT[a.cat].push(a);
    });
  }

  /* ---------------- STATE ---------------- */
  const PAGE_SIZE = 6;
  const cur = { cat:null, sort:'newest', page:1 };

  /* ---------------- DIRECTORY ELEMENTS ---------------- */
  const grid     = $('#cat-grid');
  const overlay  = $('#cat-overlay');
  const titleEl  = $('#cat-title');
  const metaEl   = $('#cat-meta');
  const pagesEl  = $('#cat-pages');
  const sortEl   = $('#cat-sort');
  const listEl   = $('#cat-list');
  const closeBtn = $('#cat-close');

  /* ---------------- CATEGORY PILLS ---------------- */
  function renderGrid(){
    grid.innerHTML = ORDER.map(cat => {
      const n = (BY_CAT[cat] || []).length;
      return `<button class="cat-pill" data-cat="${esc(cat)}" data-cursor="pointer" aria-label="Open ${esc(cat)} category">
        <span class="cat-ico">${GLYPH[cat] || '•'}</span>
        <span class="cat-name">${esc(cat)}</span>
        <span class="cat-count">${n}</span>
      </button>`;
    }).join('');

    $$('.cat-pill', grid).forEach(btn => {
      btn.addEventListener('click', () => openCat(btn.dataset.cat));
    });
  }

  /* ---------------- OPEN / CLOSE (directory popup) ---------------- */
  function openCat(cat){
    closeMenu();
    cur.cat = cat;
    cur.sort = 'newest';
    cur.page = 1;
    titleEl.textContent = cat;
    render();
    overlay.classList.add('open');
  }
  function closeCat(){ overlay.classList.remove('open'); }

  closeBtn.addEventListener('click', closeCat);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeCat(); });

  /* ---------------- RENDER MODAL ---------------- */
  function sortedApps(){
    const arr = (BY_CAT[cur.cat] || []).slice();
    arr.sort((a, b) => cur.sort === 'newest'
      ? (a.added < b.added ? 1 : a.added > b.added ? -1 : 0)
      : (a.added > b.added ? 1 : a.added < b.added ? -1 : 0));
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

    // Sort pill active state
    $$('.sort-opt', sortEl).forEach(b => b.classList.toggle('active', b.dataset.sort === cur.sort));

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
      ? `<img class="cat-thumb" src="${a.thumb}" alt="${esc(a.name)}">`
      : `<span class="app-icon">${a.icon || GLYPH[a.cat] || '•'}</span>`;
    const tags = a.tags.concat([a.license]).map(t => `<span>${esc(t)}</span>`).join('');
    const delBtn = isAdmin ? `<button class="cat-del" data-cursor="pointer" aria-label="Delete app" title="Delete app"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : '';
    return `<article class="cat-app tilt-card" data-cursor="pointer" data-repo="${esc(a.repo || '')}" data-name="${esc(a.name)}" style="animation-delay:${(i*0.05).toFixed(2)}s">
      <div class="card-glow"></div>
      ${delBtn}
      ${media}
      <div class="cat-app-body">
        <h4>${esc(a.name)}</h4>
        <p>${esc(a.desc)}</p>
        <div class="app-tags">${tags}</div>
        <button class="card-link" data-cursor="pointer">Open repo <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </article>`;
  }

  function bindCards(){
    if(!isTouch){
      $$('.cat-app', listEl).forEach(card => {
        card.addEventListener('mousemove', e => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          if(!reduced){
            card.style.transform =
              `perspective(700px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 8}deg) translateZ(4px)`;
          }
          card.style.setProperty('--mx', (px * 100) + '%');
          card.style.setProperty('--my', (py * 100) + '%');
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
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

  sortEl.addEventListener('click', e => {
    const btn = e.target.closest('.sort-opt');
    if(!btn) return;
    cur.sort = btn.dataset.sort;
    cur.page = 1;
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
    try { sessionStorage.removeItem('openhouse-admin'); } catch(e){}
    refreshAdminUI();
    toast('Signed out.');
  });

  $('#login-close').addEventListener('click', closeLogin);
  $('#login-overlay').addEventListener('click', e => { if(e.target === $('#login-overlay')) closeLogin(); });
  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    if(hashStr($('#login-pass').value) === ADMIN_HASH){
      isAdmin = true;
      try { sessionStorage.setItem('openhouse-admin', '1'); } catch(e){}
      refreshAdminUI();
      closeLogin();
      toast('Signed in — you can now upload apps.');
    } else {
      $('#login-error').textContent = 'Incorrect password.';
    }
  });

  /* sign-out handling moved into the overflow menu (see above) */

  /* ---------------- UPLOAD FLOW ---------------- */
  const uploadOverlay = $('#upload-overlay');
  let pickedThumb = null, repoThumb = '';

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

  function openUpload(){
    closeMenu();
    $('#upload-form').reset();
    $('#up-license').value = '';
    $('#up-repo-hint').textContent = 'Paste a GitHub repo URL and we\'ll pull the description automatically.';
    $('#upload-error').textContent = '';
    $('#up-newcat-field').hidden = true;
    $('#up-thumb-preview').hidden = true;
    pickedThumb = null; repoThumb = '';
    populateCategorySelect();
    uploadOverlay.classList.add('open');
  }
  function closeUpload(){ uploadOverlay.classList.remove('open'); }

  $('#upload-close').addEventListener('click', closeUpload);
  $('#upload-cancel').addEventListener('click', closeUpload);
  $('#upload-overlay').addEventListener('click', e => { if(e.target === uploadOverlay) closeUpload(); });

  $('#up-category').addEventListener('change', () => {
    $('#up-newcat-field').hidden = $('#up-category').value !== '__new__';
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

  $('#upload-form').addEventListener('submit', e => {
    e.preventDefault();
    const errEl = $('#upload-error');
    const name = $('#up-name').value.trim();
    let cat = $('#up-category').value;
    if(cat === '__new__') cat = $('#up-newcat').value.trim();
    if(!name){ errEl.textContent = 'App name is required.'; return; }
    if(!cat){ errEl.textContent = 'Choose or create a category.'; return; }

    const obj = {
      name,
      cat,
      icon: GLYPH[cat] || '•',
      desc: $('#up-desc').value.trim() || 'No description provided.',
      tags: [cat],
      license: $('#up-license').value.trim() || 'MIT',
      added: new Date().toISOString().slice(0, 10),
      repo: $('#up-repo').value.trim(),
      thumb: pickedThumb || repoThumb || ''
    };

    BY_CAT[cat] = BY_CAT[cat] || [];
    if(!ORDER.includes(cat)) ORDER.push(cat);
    BY_CAT[cat].push(obj);
    UPLOADS.push(obj);
    saveUploads();
    renderGrid();
    buildPaletteApps();

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
  } else {
    // Fallback: patch the open/close helpers
    const _open = openCat, _close = closeCat;
    // (older browsers) best-effort — leave as-is
  }

  /* ---------------- GLOBAL ESCAPE ---------------- */
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(adminMenu && adminMenu.classList.contains('open')){ closeMenu(); return; }
    if($('#cat-overlay').classList.contains('open')) closeCat();
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
    const results = $('#palette-results');
    if(!results) return;
    results.querySelectorAll('.palette-app').forEach(n => n.remove());
    ORDER.forEach(cat => {
      (BY_CAT[cat] || []).forEach(app => {
        const li = document.createElement('li');
        li.className = 'palette-app';
        li.dataset.href = '#apps';
        li.dataset.cat = cat;
        li.dataset.search = (app.name + ' ' + cat + ' ' + (app.repo || '')).toLowerCase();
        li.innerHTML = `<span>${esc(app.name)} <em>${esc(cat)}</em></span><em>App</em>`;
        li.addEventListener('click', () => {
          const ov = $('#palette-overlay');
          if(ov) ov.classList.remove('open');
          openCat(cat);
        });
        results.appendChild(li);
      });
    });
  }

  function deleteApp(cat, name){
    BY_CAT[cat] = (BY_CAT[cat] || []).filter(a => !(a.cat === cat && a.name === name));
    UPLOADS = UPLOADS.filter(a => !(a.cat === cat && a.name === name));
    saveUploads();
    buildPaletteApps();
    renderGrid();
    render();
    toast('App deleted.');
  }

  /* ---------------- INIT ---------------- */
  mergeUploads();
  renderGrid();
  refreshAdminUI();
  buildPaletteApps();

  const paletteInput = $('#palette-input');
  if(paletteInput){
    paletteInput.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      $$('#palette-results li').forEach(li => {
        const hay = (li.dataset.search || li.textContent || '').toLowerCase();
        li.classList.toggle('hidden', !hay.includes(q));
      });
    });
  }

  // Keep the hero stats in sync with the real (incl. uploaded) totals.
  const statNums = $$('.stats .stat-num');
  const totalApps = Object.keys(BY_CAT).reduce((n, c) => n + BY_CAT[c].length, 0);
  if(statNums[0]) statNums[0].dataset.count = totalApps;
  if(statNums[1]) statNums[1].dataset.count = ORDER.length;
})();
