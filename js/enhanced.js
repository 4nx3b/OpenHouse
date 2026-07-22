/**
 * OpenHouse Enhanced Features
 * All additive - does not modify existing functionality
 * No dark mode toggle
 */
(function() {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const $ = (s, ctx) => (ctx || document).querySelector(s);
  const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

  // ===== 1. BACK TO TOP BUTTON =====
  const backToTop = $('.back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      if (typeof Lenis !== 'undefined' && window.OpenhouseLenis) {
        window.OpenhouseLenis.scrollTo(document.body, { offset: 0 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ===== 2. TOAST NOTIFICATIONS =====
  const toastStack = $('#toast-stack');
  function showToast(message) {
    if (!toastStack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="dot"></span><span>' + message + '</span>';
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 400);
    }, 3200);
    return el;
  }
  if (window.showToast) window.showToast = showToast;

  // ===== 3. SCROLL REVEAL ANIMATIONS =====
  if (!reduced) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          if (entry.target.classList.contains('cat-pill')) {
            const index = Array.from(entry.target.parentNode.children).indexOf(entry.target);
            entry.target.style.setProperty('--i', index);
          }
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    $$('.reveal-up, .feature-card, .stat, .cat-pill').forEach(el => revealObserver.observe(el));
  }

  // ===== 4. STATS COUNTER ANIMATION =====
  const stats = $$('.stat-num[data-count]');
  if (stats.length && !reduced) {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    stats.forEach(stat => statsObserver.observe(stat));
  }
  function animateCounter(target) {
    const countTo = parseInt(target.dataset.count) || 0;
    const suffix = target.dataset.suffix || '';
    const duration = 2.5;
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(countTo * easeProgress);
      target.textContent = currentValue + suffix;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        target.classList.add('done');
      }
    }
    requestAnimationFrame(update);
  }

  // ===== 5. TYPEWRITER EFFECT =====
  const typewriteElements = $$('[data-typewrite]');
  if (typewriteElements.length && !reduced) {
    typewriteElements.forEach(el => {
      const text = el.textContent;
      el.innerHTML = '';
      el.style.visibility = 'visible';
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < text.length) { el.textContent += text.charAt(i); i++; }
        else { clearInterval(typeInterval); el.classList.add('done'); }
      }, 50);
    });
  }

  // ===== 6. MAGNETIC BUTTONS =====
  if (!isTouch && !reduced) {
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const relX = e.clientX - (r.left + r.width / 2);
        const relY = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${relX * 0.3}px, ${relY * 0.4}px) scale(1.05)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'translate(0, 0) scale(1)';
      });
    });
  }

  // ===== 7. TILT CARDS (Why Openhouse - true 3D tilt on press) =====
  if (!reduced) {
    $$('.feature-card').forEach(card => {
      let rect = null;
      let raf = null;

      const applyTilt = (clientX, clientY) => {
        if (!rect) rect = card.getBoundingClientRect();

        const px = (clientX - rect.left) / rect.width;
        const py = (clientY - rect.top) / rect.height;

        // Real 3D tilt based on press position
        const rotY = (px - 0.5) * 22;
        const rotX = (0.5 - py) * 18;

        // Lift/bury effect
        const lift = (0.5 - py) * 18;

        card.style.transition = 'transform 80ms cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(${lift}px)`;

        // Only update glow during hover, not during active tilt
        if (!card.classList.contains('tilting')) {
          card.style.setProperty('--mx', (px * 100) + '%');
          card.style.setProperty('--my', (py * 100) + '%');
        }
      };

      const resetTilt = () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transition = 'transform 420ms cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        card.classList.remove('tilting');
      };

      // Desktop mouse tilt
      if (!isTouch) {
        card.addEventListener('mousemove', (e) => {
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => applyTilt(e.clientX, e.clientY));
        });
        card.addEventListener('mouseleave', resetTilt);
      }

      // Mobile touch tilt
      const startTilt = (e) => {
        if (isScrolling) return;
        rect = card.getBoundingClientRect();
        card.classList.add('tilting');
        applyTilt(e.touches[0].clientX, e.touches[0].clientY);
      };

      card.addEventListener('touchstart', startTilt, { passive: true });
      card.addEventListener('touchmove', (e) => {
        if (raf || isScrolling) return;
        raf = requestAnimationFrame(() => applyTilt(e.touches[0].clientX, e.touches[0].clientY));
      }, { passive: true });

      card.addEventListener('touchend', resetTilt);
      card.addEventListener('touchcancel', resetTilt);
    });
  }

  // ===== 8. MARQUEE PAUSE ON HOVER =====
  const marquee = $('.marquee');
  const marqueeTrack = $('.marquee-track');
  if (marquee && marqueeTrack) {
    marquee.addEventListener('mouseenter', () => {
      marqueeTrack.style.animationPlayState = 'paused';
    });
    marquee.addEventListener('mouseleave', () => {
      marqueeTrack.style.animationPlayState = 'running';
    });
  }

  // ===== 9. DOCK NAVIGATION ACTIVE STATE =====
  // Fluid indicator positioning is handled in main.js to avoid double updates;
  // the glow-pulse-on-change effect for it lives in §20 below.

  // ===== 10. KEYBOARD NAVIGATION =====
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';
    if (typing) return;

    if (e.key === 'Escape') {
      $$('.modal-overlay.open').forEach(overlay => {
        overlay.classList.remove('open');
      });
      document.body.style.overflow = '';
    }

    if (e.key === 'g' && !e.target.closest('input')) {
      const appsSection = $('#apps');
      if (appsSection) {
        if (typeof Lenis !== 'undefined' && window.OpenhouseLenis) {
          window.OpenhouseLenis.scrollTo(appsSection, { offset: -20 });
        } else {
          appsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    if (e.key === 'Home') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ===== 11. SCROLL PROGRESS BAR =====
  const progressBar = $('#scroll-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
      progressBar.style.transform = `scaleX(${p || 0})`;
    }, { passive: true });
  }

  // ===== 12. BACK TO TOP VISIBILITY =====
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });
  }

  // ===== 13. SEARCH BAR EXPAND + Keyboard glitch fix =====
  const paletteInput = $('#palette-input');
  if (paletteInput) {
    paletteInput.addEventListener('focus', () => {
      // Scroll palette into view after keyboard appears
      setTimeout(()=>{
        try{
          const overlay = $('#palette-overlay');
          const palette = overlay ? overlay.querySelector('.palette') : null;
          if (palette) {
            palette.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          // Use visualViewport if available to adjust
          if (window.visualViewport) {
            const vv = window.visualViewport;
            const overlayEl = $('#palette-overlay');
            if (overlayEl) {
              overlayEl.style.paddingBottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
            }
          }
        }catch(e){}
      }, 350);
    });
    paletteInput.addEventListener('blur', () => {
      const overlayEl = $('#palette-overlay');
      if (overlayEl) overlayEl.style.paddingBottom = '';
    });

    // Handle visual viewport resize (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', ()=>{
        const overlay = $('#palette-overlay');
        if (!overlay || !overlay.classList.contains('open')) return;
        if (document.activeElement === paletteInput) {
          // Keep input visible
          setTimeout(()=>{
            paletteInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 50);
        }
      });
    }
  }


  // Search results visibility - only show when typing, not full categories list
  if (paletteInput) {
    const resultsEl = document.getElementById('palette-results');
    function updateResultsVisibility(){
      if (!resultsEl) return;
      const hasText = paletteInput.value.trim().length > 0;
      if (hasText) {
        resultsEl.classList.add('has-results');
        resultsEl.style.display = 'block';
      } else {
        resultsEl.classList.remove('has-results');
        resultsEl.style.display = 'none';
      }
    }
    paletteInput.addEventListener('input', updateResultsVisibility);
    // Initial state
    updateResultsVisibility();
    // When palette opens, ensure hidden if empty
    const paletteOverlay = document.getElementById('palette-overlay');
    if (paletteOverlay) {
      const observer = new MutationObserver(()=>{
        if (paletteOverlay.classList.contains('open')) {
          updateResultsVisibility();
        }
      });
      observer.observe(paletteOverlay, { attributes:true, attributeFilter:['class'] });
    }
  }

  // ===== 14. CHANGELOG MODAL =====
  const changelogLink = $('#changelog-link');
  const changelogOverlay = $('#changelog-overlay');
  const changelogClose = $('#changelog-close');

  function openChangelog() {
    if (!changelogOverlay) return;
    const websiteContent = $('#changelog-website');
    const appsContent = $('#changelog-apps');
    const tabs = $$('.changelog-tab');
    
    if (websiteContent && appsContent) {
      websiteContent.hidden = false;
      appsContent.hidden = true;
    }
    
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === 'website') {
        tab.classList.add('active');
      }
    });
    
    changelogOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeChangelog() {
    if (!changelogOverlay) return;
    changelogOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  const changelogTabs = $$('.changelog-tab');
  changelogTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      changelogTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const websiteContent = $('#changelog-website');
      const appsContent = $('#changelog-apps');
      if (targetTab === 'website') {
        if (websiteContent) websiteContent.hidden = false;
        if (appsContent) appsContent.hidden = true;
      } else if (targetTab === 'apps') {
        if (websiteContent) websiteContent.hidden = true;
        if (appsContent) appsContent.hidden = false;
      }
    });
  });

  if (changelogLink) {
    changelogLink.addEventListener('click', (e) => {
      e.preventDefault();
      openChangelog();
    });
  }

  if (changelogClose) {
    changelogClose.addEventListener('click', closeChangelog);
  }

  if (changelogOverlay) {
    changelogOverlay.addEventListener('click', (e) => {
      if (e.target === changelogOverlay) {
        closeChangelog();
      }
    });
  }


  // ===== 15. TAP SOUNDS & CROSS × HIT - FIXED =====
  let audioCtx = null;
  let audioUnlocked = false;

  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  async function unlockAudio() {
    if (audioUnlocked) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      audioUnlocked = true;
      const buf = ctx.createBuffer(1,1,22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      src.stop(0.01);
    } catch(e){ console.warn('Audio unlock failed', e); }
  }

  // Minecraft hit sound from https://youtu.be/OLJbtULNOaM - classic player hurt
  // Using real ogg file + WebAudio buffer for low latency - same sound everywhere
  let mcAudioEl = null;
  let mcBuffer = null;
  let mcAudioReady = false;

  function ensureMcAudio(){
    if (mcAudioEl) return mcAudioEl;
    mcAudioEl = new Audio();
    mcAudioEl.src = 'sounds/minecraft_hit_soundmp3converter.mp3';
    mcAudioEl.preload = 'auto';
    mcAudioEl.volume = 0.18;
    mcAudioEl.addEventListener('canplaythrough', ()=>{ mcAudioReady=true; }, {once:true});
    mcAudioEl.load();
    const ctx = getAudioCtx();
    if (ctx){
      fetch('sounds/minecraft_hit_soundmp3converter.mp3')
        .then(r=>r.arrayBuffer())
        .then(buf=>ctx.decodeAudioData(buf))
        .then(decoded=>{ mcBuffer=decoded; })
        .catch(()=>{});
    }
    return mcAudioEl;
  }

  function playTapSound(type='click'){
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{});
    if (navigator.vibrate) navigator.vibrate(12);

    // Try WebAudio buffer first - lowest latency
    if (ctx && mcBuffer){
      try{
        const src = ctx.createBufferSource();
        src.buffer = mcBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.16;
        src.connect(gain); gain.connect(ctx.destination);
        src.start(0);
        return;
      }catch(e){}
    }

    // Fallback to HTMLAudioElement with real Minecraft ogg (clone for overlapping)
    try{
      const audio = ensureMcAudio();
      const clone = audio.cloneNode();
      clone.volume = 0.20;
      clone.currentTime = 0;
      clone.play().catch(()=>{
        audio.currentTime = 0;
        audio.play().catch(()=>{});
      });
      return;
    }catch(e){}

    // Ultimate fallback synthesized
    if (!ctx) return;
    try{
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type='lowpass'; filt.frequency.value=850;
      osc.type='square';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(82, now+0.19);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now+0.26);
      osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now+0.28);
    }catch(e){}
  }

  function playMinecraftHit(){ playTapSound(); }

  ['touchstart','pointerdown','mousedown'].forEach(ev=>{
    document.addEventListener(ev, ensureMcAudio, {once:true, passive:true});
  });


// Crosshair DOM - fixed × shape
  let crossEl = document.getElementById('touch-crosshair');
  if (!crossEl){
    crossEl = document.createElement('div');
    crossEl.id='touch-crosshair';
    crossEl.innerHTML='<div class="ch-cross"></div><div class="ch-dot"></div><div class="ch-ring"></div>';
    document.body.appendChild(crossEl);
  }
  let crossTimer=null;
  let isScrolling = false;
  let scrollTimeout = null;

  function showCrosshair(x,y,variant=''){
    if (reduced || isScrolling) return;
    crossEl.style.left=x+'px'; crossEl.style.top=y+'px';
    crossEl.className=''; if(variant) crossEl.classList.add(variant);
    void crossEl.offsetWidth;
    crossEl.classList.add('active');
    clearTimeout(crossTimer);
    crossTimer=setTimeout(()=>{ crossEl.classList.remove('active'); }, 520);
  }

  // Detect active scrolling
  window.addEventListener('scroll', () => {
    isScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 180);
  }, { passive: true });

  const interactiveSel='button, a, [data-cursor], .cat-pill, .feature-card, .download-card, .cat-app, .modal-close, .changelog-tab, .palette-trigger, .icon-btn, .admin-menu-item, .btn, .btn-primary, .btn-outline, .brand, .footer-col a';
  // Only these should play the Minecraft damage sound
  const SOUND_ALLOWED_SEL='.modal-close, #welcome-dismiss, #upload-form button[type="submit"], #login-form button[type="submit"], #icon-form button[type="submit"], #tags-form button[type="submit"], #confirm-ok, #upload-cancel, #confirm-cancel, #tags-cancel, #icon-close, #icon-reset';
  let lastTouchTs = 0;
  let lastSoundTs = 0;

  function handleInteraction(e){
    // Explicitly block crosshair on navigation dock
    if (e.target.closest('#dock')) return;

    // still show crosshair for all interactive (visual feedback)
    const t=e.target.closest(interactiveSel);
    if(t){
      const x=e.touches?e.touches[0].clientX:e.clientX;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const isPill=t.classList.contains('cat-pill');
      const isBtn=t.classList.contains('btn')||t.classList.contains('btn-primary');
      // crosshair only tiny X for pill clicks? user wants tiny X, keep.
      showCrosshair(x,y,isPill?'is-pill':isBtn?'is-btn':'');
    }

    // Sound only on specific triggers
    if (e.type === 'touchstart') {
      lastTouchTs = Date.now();
    }
    if (e.type === 'mousedown' && Date.now() - lastTouchTs < 450) {
      return; // synthetic mouse after touch
    }
    if (Date.now() - lastSoundTs < 110) return;

    const st = e.target.closest(SOUND_ALLOWED_SEL);
    if(!st) return;

    // Check type - only allow:
    // - .modal-close (dismiss X in any popup)
    // - #welcome-dismiss
    // - publish button: #upload-form button[type="submit"]
    // - login button: #login-form button[type="submit"]
    // For safety also allow cancel/dismiss buttons inside modals
    lastSoundTs = Date.now();
    playTapSound();
  }

  // unlock
  ['touchstart','touchend','mousedown','keydown','pointerdown'].forEach(ev=>{
    document.addEventListener(ev, unlockAudio, {once:true, passive:true});
  });
  // Visual crosshair + sound listeners
  document.addEventListener('pointerdown', handleInteraction, {passive:true});
  document.addEventListener('touchstart', handleInteraction, {passive:true});
  document.addEventListener('mousedown', handleInteraction, {passive:true});

  // pill glow follow (desktop hover only — on touch this leaves a stuck glow
  // at the tap point because mobile browsers keep :hover active after a tap)
  if (!isTouch) {
    document.addEventListener('mousemove', (e)=>{
      $$('.cat-pill').forEach(pill=>{
        const r=pill.getBoundingClientRect();
        const mx=((e.clientX-r.left)/r.width)*100;
        const my=((e.clientY-r.top)/r.height)*100;
        pill.style.setProperty('--mx', mx+'%');
        pill.style.setProperty('--my', my+'%');
      });
    }, {passive:true});
  }


  // ===== 16. GLOBAL CLICK RIPPLE =====
  // Ink-drop from the exact pointer position on buttons, pills, cards, tabs.
  if (!reduced) {
    const RIPPLE_SEL = '.btn, .btn-primary, .btn-outline, .cat-pill, .icon-btn, .changelog-tab, .cat-app, .feature-card, .download-card, .modal-close';
    document.addEventListener('pointerdown', (e) => {
      const host = e.target.closest(RIPPLE_SEL);
      if (!host) return;
      const cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
      host.classList.add('ripple-host');
      const r = host.getBoundingClientRect();
      const x = (e.clientX ?? (e.touches && e.touches[0].clientX)) - r.left;
      const y = (e.clientY ?? (e.touches && e.touches[0].clientY)) - r.top;
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.setProperty('--rx', x + 'px');
      ink.style.setProperty('--ry', y + 'px');
      host.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    }, { passive: true });
  }

  // ===== 17. CURSOR GLOW TRAIL (desktop only) =====
  if (!isTouch && !reduced) {
    let trailEl = document.getElementById('cursor-trail');
    if (!trailEl) {
      trailEl = document.createElement('div');
      trailEl.id = 'cursor-trail';
      document.body.appendChild(trailEl);
    }
    let tx = 0, ty = 0, cx = 0, cy = 0, trailRaf = null;
    function trailLoop() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      trailEl.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      trailRaf = requestAnimationFrame(trailLoop);
    }
    document.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      trailEl.classList.add('show');
      if (!trailRaf) trailLoop();
      const overPointer = e.target.closest('a, button, [data-cursor="pointer"]');
      trailEl.classList.toggle('pointer-active', !!overPointer);
    }, { passive: true });
    document.addEventListener('mouseleave', () => trailEl.classList.remove('show'));
  }

  // ===== 18. HERO AURORA + FLOATING ORBS =====
  if (!reduced) {
    const hero = $('.hero');
    if (hero && !$('.hero-aurora', hero)) {
      const aurora = document.createElement('div');
      aurora.className = 'hero-aurora';
      aurora.setAttribute('aria-hidden', 'true');
      hero.insertBefore(aurora, hero.firstChild);

      const orbCount = 5;
      for (let i = 0; i < orbCount; i++) {
        const orb = document.createElement('div');
        orb.className = 'hero-orb';
        orb.setAttribute('aria-hidden', 'true');
        const size = 40 + Math.random() * 70;
        orb.style.width = size + 'px';
        orb.style.height = size + 'px';
        orb.style.left = (5 + Math.random() * 85) + '%';
        orb.style.top = (8 + Math.random() * 70) + '%';
        orb.style.animationDuration = (10 + Math.random() * 10) + 's';
        orb.style.animationDelay = (Math.random() * -8) + 's';
        hero.insertBefore(orb, hero.firstChild.nextSibling);
      }
    }
  }

  // ===== 19. TOPBAR + SCROLL PROGRESS GLOW =====
  (function () {
    const topbar = $('.topbar');
    const progress = $('#scroll-progress');
    function onScrollGlow() {
      const scrolled = window.scrollY > 8;
      if (topbar) topbar.classList.toggle('scrolled', scrolled);
      if (progress) progress.classList.toggle('active', window.scrollY > 24);
    }
    window.addEventListener('scroll', onScrollGlow, { passive: true });
    onScrollGlow();
  })();

  // ===== 20. DOCK GLOW PULSE ON SECTION CHANGE =====
  (function () {
    const indicator = $('#dock-indicator');
    if (!indicator) return;
    let lastLeft = null;
    const dockObserver = new MutationObserver(() => {
      if (indicator.style.left !== lastLeft) {
        lastLeft = indicator.style.left;
        indicator.classList.remove('pulse');
        void indicator.offsetWidth;
        indicator.classList.add('pulse');
      }
    });
    dockObserver.observe(indicator, { attributes: true, attributeFilter: ['style', 'class'] });
  })();

  // ===== 21. APP CATEGORY POPUP — ENHANCED CARD ENTRANCE =====
  (function () {
    const catList = $('#cat-list');
    const catMeta = $('#cat-meta');
    if (!catList) return;

    function stagger(children) {
      children.forEach((child, i) => {
        if (!child.classList || !child.classList.contains('cat-app')) return;
        child.style.setProperty('--i', i);
        child.classList.remove('pop-in');
        void child.offsetWidth;
        child.classList.add('pop-in');
      });
    }

    let metaTickTimer = null;
    let listDebounce = null;
    const listObserver = new MutationObserver((mutations) => {
      const changed = mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length));
      if (!changed) return;
      clearTimeout(listDebounce);
      listDebounce = setTimeout(() => {
        if (!reduced) {
          stagger(Array.from(catList.children));
          catList.classList.remove('cat-list-fade');
          void catList.offsetWidth;
          catList.classList.add('cat-list-fade');
        }
        if (catMeta) {
          clearTimeout(metaTickTimer);
          catMeta.classList.remove('tick');
          void catMeta.offsetWidth;
          catMeta.classList.add('tick');
          metaTickTimer = setTimeout(() => catMeta.classList.remove('tick'), 400);
        }
      }, 60);
    });
    listObserver.observe(catList, { childList: true });
  })();

  // ===== 22. EASTER EGGS =====
  const EGG = {};

  // -- Confetti burst (canvas, lightweight, auto-cleans up) --
  EGG.confetti = function (originX, originY) {
    if (reduced) return;
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.scale(dpr, dpr);
    const colors = ['#ffb454', '#ff8ac9', '#7ea8ff', '#7dffb0', '#fff3c4'];
    const ox = originX ?? innerWidth / 2;
    const oy = originY ?? innerHeight / 3;
    const pieces = Array.from({ length: 90 }, () => ({
      x: ox, y: oy,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 3,
      size: 4 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0
    }));
    const gravity = 0.28;
    let raf;
    function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      for (const p of pieces) {
        p.life++;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const fade = Math.max(0, 1 - p.life / 130);
        if (fade > 0 && p.y < innerHeight + 30) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      }
      if (alive) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    frame();
  };

  // -- Matrix rain overlay toggle --
  EGG.matrixTimer = null;
  EGG.toggleMatrix = function (durationMs = 5000) {
    if (reduced) return;
    let canvas = document.getElementById('matrix-rain-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'matrix-rain-canvas';
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const cols = Math.floor(innerWidth / 16);
    const drops = new Array(cols).fill(0);
    const chars = '01アイウエオカキクケコ<>/{}[]';
    canvas.classList.add('show');
    clearTimeout(EGG.matrixTimer);
    if (EGG._matrixRaf) cancelAnimationFrame(EGG._matrixRaf);
    function draw() {
      ctx.fillStyle = 'rgba(3,3,5,0.08)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = '#8effb0';
      ctx.font = '14px monospace';
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > innerHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      EGG._matrixRaf = requestAnimationFrame(draw);
    }
    draw();
    EGG.matrixTimer = setTimeout(() => {
      canvas.classList.remove('show');
      cancelAnimationFrame(EGG._matrixRaf);
      setTimeout(() => ctx.clearRect(0, 0, innerWidth, innerHeight), 650);
    }, durationMs);
  };

  function eggToast(msg) {
    const el = showToast(msg);
    if (el) el.classList.add('egg-toast');
  }

  // -- (a) Konami code: ↑ ↑ ↓ ↓ ← → ← → B A --
  (function () {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    document.addEventListener('keydown', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = (key === seq[pos]) ? pos + 1 : (key === seq[0] ? 1 : 0);
      if (pos === seq.length) {
        pos = 0;
        EGG.confetti();
        document.body.classList.add('egg-rainbow');
        setTimeout(() => document.body.classList.remove('egg-rainbow'), 4800);
        eggToast('🎮 Konami code unlocked!');
      }
    });
  })();

  // -- (b) & (c) Typed-word eggs: "openhouse" and "matrix" --
  (function () {
    let buf = '';
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-12);
      if (buf.endsWith('openhouse')) {
        buf = '';
        EGG.confetti();
        eggToast('🏠 You spelled it out. Nice.');
      }
      if (buf.endsWith('matrix')) {
        buf = '';
        EGG.toggleMatrix(5000);
        eggToast('💊 Wake up, Neo…');
      }
    });
  })();

  // -- (d) Logo rapid-click x5 → spin --
  (function () {
    const brand = $('.topbar .brand');
    if (!brand) return;
    let clicks = 0, clickTimer = null;
    brand.addEventListener('click', (e) => {
      clicks++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clicks = 0; }, 900);
      if (clicks >= 5) {
        clicks = 0;
        e.preventDefault();
        brand.classList.remove('egg-spin');
        void brand.offsetWidth;
        brand.classList.add('egg-spin');
        eggToast('🌀 Dizzy yet?');
      }
    });
  })();

  // -- (e) Long-press a stat number → fun fact bubble --
  (function () {
    const facts = [
      'Every one of these apps got a human reading its source before it made the list.',
      "Zero of Openhouse's categories are sponsored placements.",
      'The directory only grows by submissions and stars — no scraping bots involved.',
      "100% source available means you could fork the whole list tomorrow."
    ];
    let bubble = null;
    function showBubble(x, y, text) {
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'fun-fact-bubble';
        document.body.appendChild(bubble);
      }
      bubble.textContent = text;
      bubble.style.left = x + 'px';
      bubble.style.top = y + 'px';
      bubble.classList.add('show');
      clearTimeout(bubble._t);
      bubble._t = setTimeout(() => bubble.classList.remove('show'), 2600);
    }
    $$('.stat-num').forEach((el, i) => {
      let pressTimer = null;
      const start = (e) => {
        const pt = e.touches ? e.touches[0] : e;
        pressTimer = setTimeout(() => {
          showBubble(pt.clientX, pt.clientY - 12, facts[i % facts.length]);
          if (navigator.vibrate) navigator.vibrate(10);
        }, 550);
      };
      const cancel = () => clearTimeout(pressTimer);
      el.addEventListener('mousedown', start);
      el.addEventListener('touchstart', start, { passive: true });
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => el.addEventListener(ev, cancel));
    });
  })();

  // -- (f) Triple-click the footer credit → sparkle burst --
  (function () {
    const credit = $('.credit-link');
    if (!credit) return;
    let clicks = 0, timer = null;
    credit.addEventListener('click', (e) => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 700);
      if (clicks >= 3) {
        clicks = 0;
        e.preventDefault();
        const r = credit.getBoundingClientRect();
        for (let i = 0; i < 16; i++) {
          const s = document.createElement('span');
          s.className = 'sparkle-burst';
          const angle = (Math.PI * 2 * i) / 16;
          const dist = 40 + Math.random() * 40;
          s.style.left = (r.left + r.width / 2) + 'px';
          s.style.top = (r.top + r.height / 2) + 'px';
          s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
          s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
          document.body.appendChild(s);
          setTimeout(() => s.remove(), 750);
        }
        eggToast('✨ made with reze love');
      }
    });
  })();

  // -- (g) Shake device (mobile) → confetti --
  (function () {
    if (typeof DeviceMotionEvent === 'undefined') return;
    let lastShake = 0;
    let lastX = null, lastY = null, lastZ = null;
    function onMotion(e) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      if (lastX === null) { lastX = a.x; lastY = a.y; lastZ = a.z; return; }
      const delta = Math.abs(a.x - lastX) + Math.abs(a.y - lastY) + Math.abs(a.z - lastZ);
      lastX = a.x; lastY = a.y; lastZ = a.z;
      const now = Date.now();
      if (delta > 32 && now - lastShake > 2500) {
        lastShake = now;
        EGG.confetti();
        eggToast('📳 Shake detected!');
      }
    }
    function enableShake() {
      window.addEventListener('devicemotion', onMotion, { passive: true });
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      // iOS requires a user gesture to grant motion permission — request on first tap.
      document.addEventListener('touchend', function grantOnce() {
        DeviceMotionEvent.requestPermission().then(state => {
          if (state === 'granted') enableShake();
        }).catch(() => {});
        document.removeEventListener('touchend', grantOnce);
      }, { once: true });
    } else {
      enableShake();
    }
  })();

  // -- (h) Console art, for the curious dev --
  console.log('%c◧ Openhouse', 'color:#ffb454;font-size:20px;font-weight:700;font-family:monospace');
  console.log('%cPoking around? Try the Konami code, or type "matrix" or "openhouse" anywhere on the page.', 'color:#8a8a92;font-family:monospace;font-size:11px');

  window.OpenHouseEggs = EGG;

  // ===== INITIALIZATION =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    document.body.classList.add('enhanced-loaded');
    console.log('✨ OpenHouse Enhanced Features Loaded');
  }

  // Export for external use
  window.OpenHouseEnhanced = { showToast, init, playTapSound, showCrosshair, unlockAudio };
})();
