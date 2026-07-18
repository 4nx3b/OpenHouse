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

  /* ---------------- DATA ---------------- */
  const ORDER = ['Featured','Media','Productivity','Finance','Dev Tools','Notes',
                 'Utilities','Communication','Design','Security','Health','Tools'];

  const GLYPH = {
    'Featured':'✦', 'Media':'♪', 'Productivity':'✓', 'Finance':'$', 'Dev Tools':'◧',
    'Notes':'✎', 'Utilities':'⚙', 'Communication':'✉', 'Design':'◑',
    'Security':'🔒', 'Health':'♥', 'Tools':'🧰'
  };

  const DESC = {
    'Media':'Open-source media for your library — players, editors, and streamers.',
    'Productivity':'Plan, track, and ship your work without the lock-in.',
    'Finance':'Privacy-first money tools. Your numbers stay yours.',
    'Dev Tools':'The utilities developers actually live in, built in the open.',
    'Notes':'Capture and connect your thinking, synced your way.',
    'Utilities':'System and file tools that respect your machine.',
    'Communication':'Chat, mail, and calls that don\'t mine your data.',
    'Design':'Create freely with open design and illustration tools.',
    'Security':'Lock it down — passwords, encryption, and network privacy.',
    'Health':'Own your health data with open tracking tools.',
    'Tools':'Handy command-line and desktop utilities, no strings attached.'
  };

  // The original six sample apps now live in the Featured popup.
  const FEATURED = [
    { name:'Waveline',    icon:'♪', desc:'Ad-free Android music player with synced lyrics and offline caching.', tags:['Media','Android'],        license:'MIT',        added:'2025-08-14' },
    { name:'Ledgerly',    icon:'▤', desc:'Local-first budgeting app. Your numbers never leave your device.',        tags:['Finance','Desktop'],      license:'GPL-3.0',    added:'2025-05-02' },
    { name:'Splitscreen', icon:'◧', desc:'A tiling window manager for people who live in the terminal.',            tags:['Dev tools','Linux'],      license:'MIT',        added:'2024-11-19' },
    { name:'Marginal',    icon:'✎', desc:'Markdown notes with backlinks, synced over your own git remote.',         tags:['Notes','Cross-platform'], license:'Apache-2.0', added:'2026-01-27' },
    { name:'Reelhouse',   icon:'▶', desc:'A minimal video player built around subtitles and playback speed.',       tags:['Media','Android'],        license:'GPL-3.0',    added:'2024-07-08' },
    { name:'Rootkit',     icon:'⌘', desc:'Android root utilities and module manager, no ads, no bloat.',            tags:['Utilities','Android'],    license:'MIT',        added:'2025-12-03' }
  ];

  const POOLS = {
    'Media':        ['Audacious','Celluloid','mpv','Strawberry','Kodi','Jellyfin','Navidrome','Spotube','Rhythmbox','Elisa','MuseScore','OBS Studio'],
    'Productivity': ['Super-productivity','Taskwarrior','Getting Things GNOME','Emacs Org','Logseq','Anytype','AppFlowy','Planner','Kanboard','Wekan','Vikunja','Nextcloud Tasks'],
    'Finance':      ['Ledger','hledger','Firefly III','Actual','GnuCash','Beancount','Skrooge','KMyMoney','BTCPay Server','Electrum','Fava','CoinOS'],
    'Dev Tools':    ['Neovim','VS Codium','GitKraken','Lazygit','Starship','Tmux','WezTerm','Bottom','Bat','Ripgrep','Fd','Zellij'],
    'Notes':        ['Joplin','Trilium','Standard Notes','Notable','MarkText','Zettlr','SiYuan','Foam','Obsidian','Notebook','Membrane','Bangle'],
    'Utilities':    ['Files','BleachBit','Stacer','Czkawka','KDE Connect','Syncthing','Ventoy','Rclone','PeaZip','BalenaEtcher','GParted','Neofetch'],
    'Communication':['Element','Signal','Session','Briar','Jitsi','Mattermost','Revolution IRC','Thunderbird','Delta Chat','Tox','Quassel','Gajim'],
    'Design':       ['Inkscape','GIMP','Krita','Blender','Penpot','Excalidraw','Pencil','Darktable','Scribus','Gravit','Akira','Glimpse'],
    'Security':     ['Bitwarden','KeePassXC','VeraCrypt','KeePass','Proton Pass','Pass','Age','YubiKey Manager','WireGuard','Pi-hole','Fail2Ban','OnionShare'],
    'Health':       ['wger','Open Food Facts','FitoTrack','Pedometer','Loop','Nightscout','Calorie','Workout Logger','Sleep Tracker','Meditation','OpenScale','Nutritionix'],
    'Tools':        ['yt-dlp','fzf','ripgrep','jq','fd','bat','eza','zoxide','tldr','httpie','curl','wget']
  };

  const LICENSES  = ['MIT','GPL-3.0','Apache-2.0','AGPL-3.0','BSD-3'];
  const PLATFORMS = ['Android','Desktop','Linux','Cross-platform','Web','iOS','Windows','macOS'];

  function buildApps(){
    const apps = FEATURED.map(a => Object.assign({ cat:'Featured' }, a));
    const base = new Date('2026-07-01T00:00:00Z');
    ORDER.forEach((cat, ci) => {
      if(cat === 'Featured') return;
      (POOLS[cat] || []).forEach((nm, i) => {
        const off = ci*41 + i*29 + (i % 7)*13;
        const d = new Date(base); d.setUTCDate(d.getUTCDate() - off);
        apps.push({
          name: nm,
          cat,
          icon: GLYPH[cat],
          desc: DESC[cat] || ('Open-source ' + cat.toLowerCase() + ' software.'),
          tags: [cat, PLATFORMS[(ci + i) % PLATFORMS.length]],
          license: LICENSES[(ci + i) % LICENSES.length],
          added: d.toISOString().slice(0,10)
        });
      });
    });
    return apps;
  }

  const APPS  = buildApps();
  const BY_CAT = {};
  ORDER.forEach(c => BY_CAT[c] = []);
  APPS.forEach(a => { (BY_CAT[a.cat] = BY_CAT[a.cat] || []).push(a); });

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
    cur.cat = cat;
    cur.sort = 'newest';
    cur.page = 1;
    titleEl.textContent = cat;
    render();
    overlay.classList.add('open');
  }
  function closeCat(){ overlay.classList.remove('open'); }

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
      ? slice.map(cardHTML).join('')
      : `<p class="cat-empty">No apps in this category yet.</p>`;
    bindCards();
  }

  function cardHTML(a){
    const media = a.thumb
      ? `<img class="cat-thumb" src="${a.thumb}" alt="${esc(a.name)}">`
      : `<span class="app-icon">${a.icon || GLYPH[a.cat] || '•'}</span>`;
    const tags = a.tags.concat([a.license]).map(t => `<span>${esc(t)}</span>`).join('');
    return `<article class="cat-app tilt-card" data-cursor="pointer">
      <div class="card-glow"></div>
      ${media}
      <div class="cat-app-body">
        <h4>${esc(a.name)}</h4>
        <p>${esc(a.desc)}</p>
        <div class="app-tags">${tags}</div>
        <button class="card-link" data-cursor="pointer">View repo <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
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
    $$('.card-link', listEl).forEach(b =>
      b.addEventListener('click', e => { e.preventDefault(); toast('Repo link copied to clipboard.'); })
    );
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
  const ADMIN_HASH = 'c6c69433'; // default password: "openhouse-owner"
  let isAdmin = false;
  try { isAdmin = sessionStorage.getItem('openhouse-admin') === '1'; } catch(e){}

  function hashStr(str){
    let h = 5381;
    for(let i = 0; i < str.length; i++){ h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; }
    return h.toString(16);
  }

  function refreshAdminUI(){
    $('#admin-login-trigger').hidden = isAdmin;
    $('#admin-actions').hidden = !isAdmin;
  }

  function openLogin(){
    $('#login-error').textContent = '';
    $('#login-pass').value = '';
    $('#login-overlay').classList.add('open');
    setTimeout(() => { try { $('#login-pass').focus(); } catch(e){} }, 80);
  }
  function closeLogin(){ $('#login-overlay').classList.remove('open'); }

  $('#admin-login-trigger').addEventListener('click', openLogin);
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

  $('#admin-logout-trigger').addEventListener('click', () => {
    isAdmin = false;
    try { sessionStorage.removeItem('openhouse-admin'); } catch(e){}
    refreshAdminUI();
    toast('Signed out.');
  });

  /* ---------------- UPLOAD FLOW ---------------- */
  const loginTrigger = $('#admin-login-trigger');
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

  $('#admin-upload-trigger').addEventListener('click', () => { if(isAdmin) openUpload(); });
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

  /* ---------------- INIT ---------------- */
  mergeUploads();
  renderGrid();
  refreshAdminUI();

  // Keep the hero stats in sync with the real (incl. uploaded) totals.
  const statNums = $$('.stats .stat-num');
  const totalApps = Object.keys(BY_CAT).reduce((n, c) => n + BY_CAT[c].length, 0);
  if(statNums[0]) statNums[0].dataset.count = totalApps;
  if(statNums[1]) statNums[1].dataset.count = ORDER.length;
})();
