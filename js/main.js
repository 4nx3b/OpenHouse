(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover:none)').matches;
  const $ = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

  /* ============ LOADER ============ */
  const loader = $('#loader');
  const loaderFill = $('#loader-fill');
  const loaderPct = $('#loader-pct');
  let pct = 0;
  const loadTimer = setInterval(() => {
    pct += Math.random() * 18;
    if(pct >= 100){
      pct = 100;
      clearInterval(loadTimer);
      loaderFill.style.width = '100%';
      loaderPct.textContent = '100%';
      setTimeout(finishLoad, 280);
      return;
    }
    loaderFill.style.width = pct + '%';
    loaderPct.textContent = Math.floor(pct) + '%';
  }, 140);

  function finishLoad(){
    loader.classList.add('hide');
    document.body.classList.add('loaded');
    animateHeroTitle();
    initReveals();
    setTimeout(maybeShowWelcome, 900);
  }

  /* ============ SPLIT-LETTER TITLE ============ */
  function animateHeroTitle(){
    const el = $('#hero-title');
    if(!el) return;
    const lines = el.innerHTML.split('<br>');
    el.innerHTML = lines.map(line =>
      `<span class="line">${ line.split(' ').map(word =>
          `<span class="word">${ word.split('').map(ch =>
            `<span class="char" style="opacity:0;transform:translateY(28px) rotate(4deg)">${ch === ' ' ? '&nbsp;' : ch}</span>`
          ).join('') }</span>`
        ).join(' ') }</span>${lines.length>1?'<br>':''}`
    ).join('');
    const chars = $$('.char', el);
    if(reduced || typeof gsap === 'undefined'){
      chars.forEach(c => { c.style.opacity = 1; c.style.transform = 'none'; });
      return;
    }
    gsap.to(chars, {
      opacity: 1, y: 0, rotate: 0,
      duration: 0.9, ease: 'power3.out',
      stagger: 0.022
    });
  }

  /* ============ CHARACTER SCRAMBLE (brand hover) ============ */
  function scrambleText(el){
    if(reduced) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#/_';
    const original = el.dataset.original || el.textContent;
    el.dataset.original = original;
    let frame = 0;
    const totalFrames = 14;
    if(el._scrambling) return;
    el._scrambling = true;
    const iv = setInterval(() => {
      el.textContent = original.split('').map((ch, i) => {
        if(ch === ' ') return ' ';
        if(i < frame) return original[i];
        return chars[Math.floor(Math.random()*chars.length)];
      }).join('');
      frame += 1;
      if(frame > original.length){
        clearInterval(iv);
        el.textContent = original;
        el._scrambling = false;
      }
    }, totalFrames);
  }
  $$('.brand span').forEach(span => {
    span.closest('.brand').addEventListener('mouseenter', () => scrambleText(span));
  });

  /* ============ CLICK PARTICLE BURSTS ============ */
  if(!isTouch){
    window.addEventListener('pointerdown', (e) => {
      if(window.__particleBurst) window.__particleBurst(e.clientX, e.clientY);
    });
  }

  /* ============ MOUSE SPOTLIGHT ============ */
  // rAF-throttled: paints at most once per frame instead of per pointer event
  const spotlight = $('#spotlight');
  if(!isTouch && spotlight){
    let sx = 0, sy = 0, spotRaf = null;
    window.addEventListener('pointermove', e => {
      sx = e.clientX; sy = e.clientY;
      if(spotRaf) return;
      spotRaf = requestAnimationFrame(() => {
        spotRaf = null;
        spotlight.style.setProperty('--sx', sx + 'px');
        spotlight.style.setProperty('--sy', sy + 'px');
      });
    }, { passive:true });
  }

  /* ============ MAGNETIC BUTTONS ============ */
  if(!isTouch){
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const relX = e.clientX - (r.left + r.width/2);
        const relY = e.clientY - (r.top + r.height/2);
        el.style.transform = `translate(${relX*0.25}px, ${relY*0.35}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
    });
  }

  /* ============ TILT CARDS + GLOW ============ */
  if(!isTouch){
    $$('.tilt-card').forEach(card => {
      let rect = null;
      let raf = null;
      let pending = null;

      card.addEventListener('mouseenter', () => { rect = card.getBoundingClientRect(); });

      card.addEventListener('mousemove', e => {
        if(!rect) rect = card.getBoundingClientRect();
        pending = e;
        if(raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          if(!pending) return;
          const px = (pending.clientX - rect.left) / rect.width;
          const py = (pending.clientY - rect.top) / rect.height;
          const rotY = (px - 0.5) * 10;
          const rotX = (0.5 - py) * 10;
          card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
          card.style.setProperty('--mx', (px*100) + '%');
          card.style.setProperty('--my', (py*100) + '%');
        });
      });
      card.addEventListener('mouseleave', () => {
        rect = null;
        card.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateZ(0)';
      });
    });
  }

  /* ============ SCROLL PROGRESS ============ */
  // rAF-throttled + transform-based: no layout work, runs at most once a frame
  const progressBar = $('#scroll-progress');
  let progressTicking = false;
  function updateProgress(){
    if(progressTicking) return;
    progressTicking = true;
    requestAnimationFrame(() => {
      progressTicking = false;
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
      if(progressBar) progressBar.style.transform = 'scaleX(' + (p || 0) + ')';
    });
  }
  document.addEventListener('scroll', updateProgress, { passive:true });

  /* ============ LENIS SMOOTH SCROLL + GSAP SCROLLTRIGGER ============ */
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if(hasGsap) gsap.registerPlugin(ScrollTrigger);

  let lenis;
  if(typeof Lenis !== 'undefined' && !reduced && !isTouch){
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', updateProgress);
    if(hasGsap){
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time){ lenis.raf(time); requestAnimationFrame(raf); })();
    }
  }

  /* ============ PARALLAX (ScrollTrigger) ============ */
  if(hasGsap && !reduced && !isTouch){
    gsap.to('.grid-overlay', { yPercent: 18, ease:'none', scrollTrigger:{ trigger:'.hero', start:'top top', end:'bottom top', scrub:true }});
    gsap.to('.fog', { yPercent: -12, ease:'none', scrollTrigger:{ trigger:'.hero', start:'top top', end:'bottom top', scrub:true }});
  }

  // intercept in-page anchor links to use lenis (falls back to native smooth scroll)
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if(id === '#'){ e.preventDefault(); return; } // popup links handle themselves
      const target = $(id);
      if(!target) return;
      e.preventDefault();
      if(lenis){ lenis.scrollTo(target, { offset: -10 }); }
      else { target.scrollIntoView({ behavior:'smooth' }); }
    });
  });

  /* ============ DOCK: ACTIVE SECTION (filled icon) ============ */
  const dockLinks = $$('.dock a[href^="#"]');
  if(dockLinks.length && 'IntersectionObserver' in window){
    const hrefFor = new Map(); // section element -> dock href
    dockLinks.forEach(a => {
      const href = a.getAttribute('href');
      // '#top' is the whole <main>; represent it by the hero section instead
      const target = href === '#top' ? $('.hero') : $(href);
      if(target) hrefFor.set(target, href);
    });
    const dockIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        const href = hrefFor.get(entry.target);
        dockLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === href));
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    hrefFor.forEach((href, sec) => dockIo.observe(sec));
  }

  /* ============ REVEAL ON SCROLL ============ */
  function initReveals(){
    const els = $$('.reveal-up');
    if(!('IntersectionObserver' in window)){
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
  }

  /* ============ TYPEWRITER HEADINGS ============ */
  // Section headings type themselves out (mono font + caret) when scrolled
  // into view. Falls back to instant text when reduced-motion is on.
  const typeEls = $$('[data-typewrite]');
  if(typeEls.length && !reduced){
    typeEls.forEach(el => {
      const text = el.textContent.trim();
      el.dataset.text = text;
      // ghost keeps the layout height; live gets typed over it
      el.innerHTML = '<span class="tw-ghost" aria-hidden="true">' + el.innerHTML.trim() + '</span>'
                   + '<span class="tw-live" aria-hidden="true"></span>';
      el.setAttribute('aria-label', text);
    });
    if('IntersectionObserver' in window){
      const twIo = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if(!entry.isIntersecting) return;
          twIo.unobserve(entry.target);
          typewrite(entry.target);
        });
      }, { threshold: 0.6 });
      typeEls.forEach(el => twIo.observe(el));
    } else {
      typeEls.forEach(typewrite);
    }
  }
  function typewrite(el){
    const text = el.dataset.text;
    const live = el.querySelector('.tw-live');
    if(!live) return;
    el.classList.add('tw-typing');
    let i = 0;
    (function tick(){
      i++;
      live.textContent = text.slice(0, i);
      if(i < text.length){
        // slight human jitter; brief pause after punctuation
        const ch = text[i - 1];
        const delay = /[.,!?]/.test(ch) ? 220 : 26 + Math.random() * 40;
        setTimeout(tick, delay);
      } else {
        // keep the caret blinking briefly, then settle
        setTimeout(() => el.classList.remove('tw-typing'), 1600);
      }
    })();
  }

  /* ============ FOOTER REVEAL ============ */
  const footerEl = $('.footer');
  if(footerEl && 'IntersectionObserver' in window){
    const fio = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ footerEl.classList.add('in-view'); fio.disconnect(); }
      });
    }, { threshold: 0.15 });
    fio.observe(footerEl);
  } else if(footerEl){
    footerEl.classList.add('in-view');
  }

  /* ============ STATS COUNT-UP ============ */
  const statEls = $$('.stat-num');
  if(statEls.length && 'IntersectionObserver' in window){
    const statIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10) || 0;
        const suffix = el.dataset.suffix || '';
        const dur = 1200;
        const start = performance.now();
        function tick(now){
          const p = Math.min((now-start)/dur, 1);
          const eased = 1 - Math.pow(1-p, 3);
          el.textContent = Math.floor(eased * target) + suffix;
          if(p < 1) requestAnimationFrame(tick);
          else { el.textContent = target + suffix; el.classList.add('done'); }
        }
        requestAnimationFrame(tick);
        statIo.unobserve(el);
      });
    }, { threshold: 0.5 });
    statEls.forEach(el => statIo.observe(el));
  }

  /* ============ STORY STICKY LINES ============ */
  const storySection = $('#story');
  const storyLines = $$('.story-line');
  if(storySection && storyLines.length){
    // typewriter treatment: each line types itself out when it becomes active
    storyLines.forEach(line => { line.dataset.text = line.textContent.trim(); });
    let activeIdx = -1;
    const timers = new Map();
    function typeLine(line){
      const text = line.dataset.text;
      if(reduced){ line.textContent = text; return; }
      clearInterval(timers.get(line));
      let i = 0;
      line.textContent = '';
      line.classList.add('tw-typing-line');
      const iv = setInterval(() => {
        i++;
        line.textContent = text.slice(0, i);
        if(i >= text.length){
          clearInterval(iv);
          setTimeout(() => line.classList.remove('tw-typing-line'), 900);
        }
      }, 30);
      timers.set(line, iv);
    }
    const storyImgs = $$('.story-img');
    function setActiveLine(ratio){
      const idx = Math.min(storyLines.length - 1, Math.floor(ratio * storyLines.length));
      if(idx === activeIdx) return;
      activeIdx = idx;
      storyLines.forEach((line, i) => {
        const on = i === idx;
        line.setAttribute('data-active', on ? 'true' : 'false');
        if(on) typeLine(line);
      });
      // swap the backdrop image with the line
      storyImgs.forEach((img, i) => img.classList.toggle('on', i === idx));
    }
    // show the first image immediately (first line starts active)
    if(storyImgs[0]) storyImgs[0].classList.add('on');
    if(hasGsap && !reduced){
      ScrollTrigger.create({
        trigger: storySection,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: self => setActiveLine(self.progress)
      });
    } else {
      // rAF-throttled so getBoundingClientRect runs at most once per frame
      let storyTicking = false;
      window.addEventListener('scroll', () => {
        if(storyTicking) return;
        storyTicking = true;
        requestAnimationFrame(() => {
          storyTicking = false;
          const r = storySection.getBoundingClientRect();
          const total = r.height - window.innerHeight;
          const progressed = Math.min(Math.max(-r.top, 0), total);
          setActiveLine(total > 0 ? progressed / total : 0);
        });
      }, { passive:true });
    }
  }

  /* ============ COMMAND PALETTE ============ */
  const paletteOverlay = $('#palette-overlay');
  const paletteInput = $('#palette-input');

  function openPalette(){
    paletteOverlay.classList.add('open');
    paletteInput.value = '';
    filterPalette('');
    // Only auto-focus (and pop the keyboard) on devices with a physical
    // keyboard — on phones the on-screen keyboard covering the list is worse.
    if(!isTouch) setTimeout(() => paletteInput.focus(), 60);
  }
  function closePalette(){ paletteOverlay.classList.remove('open'); }
  function filterPalette(q){
    const query = q.trim().toLowerCase();
    $$('#palette-results li').forEach(li => {
      const hay = (li.dataset.search || li.textContent || '').toLowerCase();
      li.classList.toggle('hidden', !hay.includes(query));
    });
  }
  paletteInput && paletteInput.addEventListener('input', e => filterPalette(e.target.value));
  $('#palette-trigger') && $('#palette-trigger').addEventListener('click', openPalette);
  paletteOverlay && paletteOverlay.addEventListener('click', e => { if(e.target === paletteOverlay) closePalette(); });

  /* ============ MODALS ============ */
  function openModal(overlay){ overlay.classList.add('open'); }
  function closeModal(overlay){ overlay.classList.remove('open'); }

  const welcomeOverlay = $('#welcome-overlay');
  $('#welcome-close') && $('#welcome-close').addEventListener('click', () => closeModal(welcomeOverlay));
  $('#welcome-dismiss') && $('#welcome-dismiss').addEventListener('click', () => {
    closeModal(welcomeOverlay);
    try{ sessionStorage.setItem('openhouse-welcomed', '1'); }catch(e){}
  });
  welcomeOverlay && welcomeOverlay.addEventListener('click', e => { if(e.target === welcomeOverlay) closeModal(welcomeOverlay); });
  function maybeShowWelcome(){
    let seen = false;
    try{ seen = sessionStorage.getItem('openhouse-welcomed') === '1'; }catch(e){}
    if(!seen) openModal(welcomeOverlay);
  }

  const shortcutsOverlay = $('#shortcuts-overlay');
  $('#shortcuts-trigger') && $('#shortcuts-trigger').addEventListener('click', () => openModal(shortcutsOverlay));
  $('#shortcuts-close') && $('#shortcuts-close').addEventListener('click', () => closeModal(shortcutsOverlay));
  shortcutsOverlay && shortcutsOverlay.addEventListener('click', e => { if(e.target === shortcutsOverlay) closeModal(shortcutsOverlay); });

  /* ============ CHANGELOG POPUP ============ */
  const changelogOverlay = $('#changelog-overlay');
  const changelogLink = $('#changelog-link');
  if(changelogLink && changelogOverlay){
    changelogLink.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openModal(changelogOverlay); });
  }
  $('#changelog-close') && $('#changelog-close').addEventListener('click', () => closeModal(changelogOverlay));
  changelogOverlay && changelogOverlay.addEventListener('click', e => { if(e.target === changelogOverlay) closeModal(changelogOverlay); });

  /* ============ KEYBOARD SHORTCUTS ============ */
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';

    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      paletteOverlay.classList.contains('open') ? closePalette() : openPalette();
      return;
    }
    if(e.key === 'Escape'){
      closePalette();
      closeModal(welcomeOverlay);
      closeModal(shortcutsOverlay);
      changelogOverlay && closeModal(changelogOverlay);
      return;
    }
    if(!typing && e.key === '?'){
      openModal(shortcutsOverlay);
    }
  });

  /* ============ TOASTS ============ */
  const toastStack = $('#toast-stack');
  function showToast(message){
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="dot"></span><span>${message}</span>`;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  $('#submit-btn') && $('#submit-btn').addEventListener('click', () => {
    window.open('https://t.me/therealreze', '_blank', 'noopener');
    showToast('Opening Telegram…');
  });

  // App "Open repo" behaviour is now handled in js/categories.js

})();
