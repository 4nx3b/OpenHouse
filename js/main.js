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

  /* ============ CUSTOM CURSOR ============ */
  const cursorDot = $('#cursor-dot');
  const cursorRing = $('#cursor-ring');
  if(!isTouch && cursorDot && cursorRing){
    let mx=innerWidth/2, my=innerHeight/2, rx=mx, ry=my;
    window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
    function loop(){
      cursorDot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      rx += (mx-rx)*0.18; ry += (my-ry)*0.18;
      cursorRing.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    }
    loop();

    $$('[data-cursor="pointer"], a, button').forEach(el => {
      el.addEventListener('mouseenter', () => cursorRing.classList.add('hovered'));
      el.addEventListener('mouseleave', () => cursorRing.classList.remove('hovered'));
    });
    window.addEventListener('pointerdown', (e) => {
      cursorRing.classList.add('clicked');
      if(window.__particleBurst) window.__particleBurst(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', () => cursorRing.classList.remove('clicked'));
  }

  /* ============ MOUSE SPOTLIGHT ============ */
  const spotlight = $('#spotlight');
  if(!isTouch && spotlight){
    window.addEventListener('pointermove', e => {
      spotlight.style.setProperty('--sx', e.clientX + 'px');
      spotlight.style.setProperty('--sy', e.clientY + 'px');
    });
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
  const progressBar = $('#scroll-progress');
  function updateProgress(){
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
    if(progressBar) progressBar.style.width = (scrolled||0) + '%';
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
      const target = id.length > 1 ? $(id) : document.body;
      if(!target) return;
      e.preventDefault();
      if(lenis){ lenis.scrollTo(target, { offset: -10 }); }
      else { target.scrollIntoView({ behavior:'smooth' }); }
    });
  });

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
          else el.textContent = target + suffix;
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
    function setActiveLine(ratio){
      const idx = Math.min(storyLines.length - 1, Math.floor(ratio * storyLines.length));
      storyLines.forEach((line, i) => line.setAttribute('data-active', i === idx ? 'true' : 'false'));
    }
    if(hasGsap && !reduced){
      ScrollTrigger.create({
        trigger: storySection,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: self => setActiveLine(self.progress)
      });
    } else {
      window.addEventListener('scroll', () => {
        const r = storySection.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const progressed = Math.min(Math.max(-r.top, 0), total);
        setActiveLine(total > 0 ? progressed / total : 0);
      }, { passive:true });
    }
  }

  /* ============ COMMAND PALETTE ============ */
  const paletteOverlay = $('#palette-overlay');
  const paletteInput = $('#palette-input');
  const paletteResults = $('#palette-results');
  const paletteItems = $$('#palette-results li');

  function openPalette(){
    paletteOverlay.classList.add('open');
    paletteInput.value = '';
    filterPalette('');
    setTimeout(() => paletteInput.focus(), 60);
  }
  function closePalette(){ paletteOverlay.classList.remove('open'); }
  function filterPalette(q){
    const query = q.trim().toLowerCase();
    paletteItems.forEach(li => {
      const match = li.textContent.toLowerCase().includes(query);
      li.classList.toggle('hidden', !match);
    });
  }
  paletteInput && paletteInput.addEventListener('input', e => filterPalette(e.target.value));
  paletteItems.forEach(li => {
    li.addEventListener('click', () => {
      const href = li.dataset.href;
      closePalette();
      const target = $(href);
      if(target){ if(lenis) lenis.scrollTo(target); else target.scrollIntoView({behavior:'smooth'}); }
    });
  });
  $('#palette-trigger') && $('#palette-trigger').addEventListener('click', openPalette);
  $('#dock-search') && $('#dock-search').addEventListener('click', openPalette);
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
    showToast('Thanks — we\u2019ll take a look at your submission.');
  });

  $$('.card-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showToast('Repo link copied to clipboard.');
    });
  });

})();
