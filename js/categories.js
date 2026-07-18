/* ============================================================
   Openhouse — Category Directory
   Renders category pills; each opens a popup with
   paginated + sortable (Newest / Oldest) app listings.
   ============================================================ */
(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover:none)').matches;
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

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

  /* ---------------- STATE ---------------- */
  const PAGE_SIZE = 6;
  const cur = { cat:null, sort:'newest', page:1 };

  /* ---------------- ELEMENTS ---------------- */
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
      return `<button class="cat-pill" data-cat="${cat}" data-cursor="pointer" aria-label="Open ${cat} category">
        <span class="cat-ico">${GLYPH[cat] || '•'}</span>
        <span class="cat-name">${cat}</span>
        <span class="cat-count">${n}</span>
      </button>`;
    }).join('');

    $$('.cat-pill', grid).forEach(btn => {
      btn.addEventListener('click', () => openCat(btn.dataset.cat));
    });
  }

  /* ---------------- OPEN / CLOSE ---------------- */
  function openCat(cat){
    cur.cat = cat;
    cur.sort = 'newest';
    cur.page = 1;
    titleEl.textContent = cat;
    render();
    overlay.classList.add('open');
  }
  function closeCat(){
    overlay.classList.remove('open');
  }

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
    const tags = a.tags.concat([a.license]).map(t => `<span>${t}</span>`).join('');
    return `<article class="cat-app tilt-card" data-cursor="pointer">
      <div class="card-glow"></div>
      <span class="app-icon">${a.icon || GLYPH[a.cat] || '•'}</span>
      <div class="cat-app-body">
        <h4>${a.name}</h4>
        <p>${a.desc}</p>
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

  /* ---------------- CLOSE HANDLERS ---------------- */
  closeBtn.addEventListener('click', closeCat);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeCat(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && overlay.classList.contains('open')) closeCat();
  });

  /* ---------------- TOAST ---------------- */
  const toastStack = $('#toast-stack');
  function toast(msg){
    if(!toastStack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="dot"></span><span>${msg}</span>`;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  /* ---------------- INIT ---------------- */
  renderGrid();
})();
