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

        // Depth shadow that shifts opposite the raised edge, selling the 3D lift
        const shadowX = -rotY * 1.1;
        const shadowY = 10 - rotX * 0.6;
        const shadowBlur = 24 + Math.abs(lift) * 0.9;
        card.style.boxShadow = `${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0,0,0,.34)`;

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
        card.style.boxShadow = '';
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
        if (navigator.vibrate) navigator.vibrate(8);
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
  // Dock fluid indicator is handled in main.js to avoid double updates and glitch
  // This block intentionally left minimal to prevent conflict
  const dock = $('#dock');


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
      setTimeout(()=>{
        try{
          const overlay = $('#palette-overlay');
          const palette = overlay ? overlay.querySelector('.palette') : null;
          if (palette) {
            palette.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }catch(e){}
      }, 350);
    });
  }

  // ---- Global: keep popups visible when keyboard opens ----
  if (window.visualViewport) {
    const adjustModalsForKeyboard = () => {
      const vv = window.visualViewport;
      const keyboardOpen = vv.height < window.innerHeight - 60;
      const modalOverlays = $$('.modal-overlay.open');
      modalOverlays.forEach(overlay => {
        if (keyboardOpen) {
          // Shift the modal up so it stays visible above keyboard
          const modal = overlay.querySelector('.modal, .palette');
          if (modal) {
            const shift = (window.innerHeight - vv.height - vv.offsetTop) * 0.7;
            modal.style.transform = 'translateY(-' + Math.max(0, shift) + 'px) scale(1)';
            modal.style.transition = 'transform 0.25s ease-out';
          }
        } else {
          const modal = overlay.querySelector('.modal, .palette');
          if (modal) {
            modal.style.transform = '';
            modal.style.transition = 'transform 0.25s ease-out';
          }
        }
      });
    };

    window.visualViewport.addEventListener('resize', adjustModalsForKeyboard);
    window.visualViewport.addEventListener('scroll', adjustModalsForKeyboard);

    // Also hook into modal opens to ensure proper positioning
    const modalObserver = new MutationObserver(() => {
      setTimeout(adjustModalsForKeyboard, 100);
    });
    $$('.modal-overlay').forEach(o => {
      modalObserver.observe(o, { attributes: true, attributeFilter: ['class'] });
    });
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

  // pill glow follow
  document.addEventListener('mousemove', (e)=>{
    $$('.cat-pill').forEach(pill=>{
      const r=pill.getBoundingClientRect();
      const mx=((e.clientX-r.left)/r.width)*100;
      const my=((e.clientY-r.top)/r.height)*100;
      pill.style.setProperty('--mx', mx+'%');
      pill.style.setProperty('--my', my+'%');
    });
  }, {passive:true});


  // ===== 16. MOTION BLUR WHILE SCROLLING INSIDE POPUPS =====
  // Removed: this applied a velocity-based blur() filter to popup content
  // while scrolling, which made popups look blurry/out of focus during use.

  // ===== 17. SMOOTH INERTIA SCROLLING (Lenis) =====
  // Only initializes if nothing else in the page has already set up Lenis,
  // so this stays additive and won't create a competing scroll instance.
  if (!reduced && typeof Lenis !== 'undefined' && !window.OpenhouseLenis) {
    try {
      const lenis = new Lenis({
        duration: 1.15,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false, // keep native touch feel on mobile; inertia is for wheel/trackpad
        wheelMultiplier: 1,
        touchMultiplier: 1.5
      });
      window.OpenhouseLenis = lenis;

      if (typeof gsap !== 'undefined' && gsap.ticker) {
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        if (typeof ScrollTrigger !== 'undefined') {
          lenis.on('scroll', ScrollTrigger.update);
        }
      } else {
        const lenisRaf = (time) => {
          lenis.raf(time);
          requestAnimationFrame(lenisRaf);
        };
        requestAnimationFrame(lenisRaf);
      }
    } catch (e) { console.warn('Lenis init failed', e); }
  }

  // ===== 18. SOFT VIBRATION ON POPUP OPEN (where supported) =====
  if ('vibrate' in navigator) {
    $$('.modal-overlay').forEach(overlay => {
      const mo = new MutationObserver((muts) => {
        muts.forEach(m => {
          if (m.attributeName === 'class' && overlay.classList.contains('open')) {
            navigator.vibrate(10);
          }
        });
      });
      mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ===== 19. STRETCH / BOUNCE ON PULL (top & bottom rubber-band) =====
  if (!reduced) {
    const stretchEl = $('main#top') || document.body;
    let pullStartY = 0;
    let isPulling = false;
    let boundary = null; // 'top' | 'bottom' | null

    const scrollTop = () => window.scrollY || document.documentElement.scrollTop;
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    function onPullStart(e) {
      if (e.touches.length !== 1) return;
      pullStartY = e.touches[0].clientY;
      const top = scrollTop();
      if (top <= 0) boundary = 'top';
      else if (top >= maxScroll() - 1) boundary = 'bottom';
      else boundary = null;
      isPulling = false;
    }

    function onPullMove(e) {
      if (!boundary) return;
      const dy = e.touches[0].clientY - pullStartY;
      if (boundary === 'top' && dy > 0) {
        isPulling = true;
        const stretch = Math.min(dy * 0.35, 70);
        stretchEl.style.transition = 'transform 0ms linear';
        stretchEl.style.transformOrigin = 'top center';
        stretchEl.style.transform = `translateY(${stretch}px) scaleY(${1 + stretch / 900})`;
      } else if (boundary === 'bottom' && dy < 0) {
        isPulling = true;
        const stretch = Math.min(Math.abs(dy) * 0.35, 70);
        stretchEl.style.transition = 'transform 0ms linear';
        stretchEl.style.transformOrigin = 'bottom center';
        stretchEl.style.transform = `translateY(-${stretch}px) scaleY(${1 + stretch / 900})`;
      }
    }

    function onPullEnd() {
      if (isPulling) {
        stretchEl.style.transition = 'transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        stretchEl.style.transform = '';
        if (navigator.vibrate) navigator.vibrate(6);
      }
      isPulling = false;
      boundary = null;
    }

    document.addEventListener('touchstart', onPullStart, { passive: true });
    document.addEventListener('touchmove', onPullMove, { passive: true });
    document.addEventListener('touchend', onPullEnd, { passive: true });
    document.addEventListener('touchcancel', onPullEnd, { passive: true });
  }

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

  /* ============================================================
     EASTER EGGS — secret features hidden in plain sight
     ============================================================ */

  // ---- Easter Egg 1: Konami Code (↑ ↑ ↓ ↓ ← → ← → B A) ----
  // Activates a confetti rain + hidden message
  (function(){
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let konamiIdx = 0;
    let konamiTimer = null;
    document.addEventListener('keydown', function(e){
      if(e.key === KONAMI[konamiIdx]){
        konamiIdx++;
        if(konamiTimer) clearTimeout(konamiTimer);
        konamiTimer = setTimeout(() => { konamiIdx = 0; }, 3000);
        if(konamiIdx === KONAMI.length){
          konamiIdx = 0;
          triggerKonami();
        }
      } else {
        konamiIdx = 0;
      }
    });

    function triggerKonami(){
      // Confetti burst
      const colors = ['#ffb454','#ffd9a0','#ff7a7a','#7dd87d','#7ab8ff','#ff9dff'];
      for(let i = 0; i < 80; i++){
        const confetti = document.createElement('div');
        confetti.style.cssText = `position:fixed;width:${6+Math.random()*8}px;height:${6+Math.random()*10}px;background:${colors[Math.floor(Math.random()*colors.length)]};left:${Math.random()*100}vw;top:-20px;z-index:99999;pointer-events:none;border-radius:${Math.random()>0.5?'50%':'2px'};animation:konamiFall ${2+Math.random()*3}s ease-in forwards;animation-delay:${Math.random()*0.5}s;opacity:0.9;`;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3500);
      }
      // Add the keyframe if not already present
      if(!document.getElementById('konami-style')){
        const style = document.createElement('style');
        style.id = 'konami-style';
        style.textContent = '@keyframes konamiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}';
        document.head.appendChild(style);
      }
      showToast('🥚 You found the Konami Code! The source is strong with this one.');
      if(navigator.vibrate) navigator.vibrate([50,50,50,50,200]);
    }
  })();

  // ---- Easter Egg 2: Triple-click the brand logo 7 times ----
  (function(){
    let brandClicks = 0;
    let brandTimer = null;
    const brand = document.querySelector('.brand');
    if(brand){
      brand.addEventListener('click', function(e){
        brandClicks++;
        if(brandTimer) clearTimeout(brandTimer);
        brandTimer = setTimeout(() => { brandClicks = 0; }, 1500);
        if(brandClicks >= 7){
          brandClicks = 0;
          // Use a fixed overlay instead of body filter to prevent scroll jank
          let overlay = document.getElementById('invert-overlay');
          if(!overlay){
            overlay = document.createElement('div');
            overlay.id = 'invert-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;background:transparent;mix-blend-mode:difference;';
            document.body.appendChild(overlay);
            // Add a white background overlay to create the invert effect via difference blend
            const white = document.createElement('div');
            white.id = 'invert-bg';
            white.style.cssText = 'position:fixed;inset:0;z-index:99997;pointer-events:none;background:#fff;opacity:0;transition:opacity 0.3s ease;';
            document.body.appendChild(white);
          }
          const whiteBg = document.getElementById('invert-bg');
          if(whiteBg) whiteBg.style.opacity = '1';
          showToast('🥚 Inverted reality mode activated!');
          if(navigator.vibrate) navigator.vibrate([30,80,30,80,30]);
          setTimeout(() => {
            if(whiteBg) whiteBg.style.opacity = '0';
            setTimeout(() => { 
              if(whiteBg) whiteBg.remove();
              const ov = document.getElementById('invert-overlay');
              if(ov) ov.remove();
            }, 400);
          }, 3000);
        }
      });
    }
  })();

  // ---- Easter Egg 3: Type "openhouse" quickly ----
  (function(){
    const SECRET = 'openhouse';
    let secretIdx = 0;
    let secretTimer = null;
    document.addEventListener('keypress', function(e){
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if(e.key.toLowerCase() === SECRET[secretIdx]){
        secretIdx++;
        if(secretTimer) clearTimeout(secretTimer);
        secretTimer = setTimeout(() => { secretIdx = 0; }, 2000);
        if(secretIdx === SECRET.length){
          secretIdx = 0;
          // Flash the search kbd
          const kbd = document.querySelector('.palette-input-container kbd');
          if(kbd){
            kbd.style.transition = 'all 0.3s ease';
            kbd.style.background = 'var(--accent)';
            kbd.style.color = '#0a0a0a';
            kbd.textContent = '🥚';
            setTimeout(() => { kbd.style.background = ''; kbd.style.color = ''; kbd.textContent = 'Esc'; }, 2500);
          }
          showToast('🥚 You typed the magic word!');
        }
      } else {
        secretIdx = 0;
      }
    });
  })();

  // ---- Easter Egg 4: Press "H" twice for hidden counter ----
  (function(){
    let hCount = 0;
    let hTimer = null;
    document.addEventListener('keydown', function(e){
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if(e.key.toLowerCase() === 'h'){
        hCount++;
        if(hTimer) clearTimeout(hTimer);
        hTimer = setTimeout(() => { hCount = 0; }, 800);
        if(hCount >= 3){
          hCount = 0;
          const eggs = parseInt(localStorage.getItem('openhouse-eggs') || '0') + 1;
          localStorage.setItem('openhouse-eggs', eggs);
          showToast('🥚 Easter egg #' + eggs + ' found! (H×3 secret)');
        }
      }
    });
  })();

  // ---- Easter Egg 5: Shake device on mobile (if supported) ----
  if(window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission !== 'function'){
    let lastShake = 0;
    let shakeCount = 0;
    window.addEventListener('devicemotion', function(e){
      const acc = e.accelerationIncludingGravity;
      if(!acc) return;
      const mag = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
      if(mag > 28){
        const now = Date.now();
        if(now - lastShake < 600){
          shakeCount++;
          if(shakeCount >= 3){
            shakeCount = 0;
            document.querySelectorAll('.cat-pill').forEach((pill, i) => {
              pill.style.transition = 'transform 0.5s cubic-bezier(.22,1.3,.36,1)';
              pill.style.transform = `translateY(${(Math.random()-0.5)*20}px) rotate(${(Math.random()-0.5)*10}deg)`;
              setTimeout(() => { pill.style.transform = ''; }, 600);
            });
            showToast('🥚 Earthquake! The directory is shaking...');
          }
        } else {
          shakeCount = 0;
        }
        lastShake = now;
      }
    }, { passive: true });
  }

  // ---- Easter Egg 6: Right-click the footer credit ----
  (function(){
    const credit = document.querySelector('.credit-link');
    if(credit){
      credit.addEventListener('contextmenu', function(e){
        e.preventDefault();
        const msgs = [
          '🥚 Nice find! Built with love by reze.',
          '🥚 The code is open source too — check the repo!',
          '🥚 No secrets here... or are there?',
          '🥚 You have a keen eye for detail!',
          '🥚 This website has no ads. And never will.'
        ];
        showToast(msgs[Math.floor(Math.random() * msgs.length)]);
        if(navigator.vibrate) navigator.vibrate(15);
      });
    }
  })();

  // ---- Easter Egg 7: Resize the window rapidly 3 times ----
  (function(){
    let resizeCount = 0;
    let resizeTimer = null;
    window.addEventListener('resize', function(){
      resizeCount++;
      if(resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resizeCount = 0; }, 1500);
      if(resizeCount >= 5){
        resizeCount = 0;
        showToast('🥚 Stop that! You\'re making the pixels dizzy... 🌀');
      }
    });
  })();

  // ---- Easter Egg 8: Hold Ctrl+Shift+D ----
  document.addEventListener('keydown', function(e){
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd'){
      e.preventDefault();
      // Toggle dark reader easter egg mode
      const body = document.body;
      if(body.style.getPropertyValue('--egg-mode')){
        body.style.removeProperty('--egg-mode');
        body.style.background = '';
        showToast('🥚 Debug mode: OFF');
      } else {
        body.style.setProperty('--egg-mode', '1');
        showToast('🥚 Debug mode: ON — inspecting the source...');
      }
    }
  });

})();
