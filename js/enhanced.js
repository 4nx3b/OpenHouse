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
  // end of original init()

  // ===== 16. CURSOR TRAIL (lightweight — max 8 dots, throttled) =====
  if (!isTouch && !reduced) {
    const trailDots = [];
    const MAX_TRAIL = 8;
    let lastTrailTime = 0;

    document.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - lastTrailTime < 40) return; // throttle: max ~25/sec
      lastTrailTime = now;

      const dot = document.createElement('div');
      dot.className = 'cursor-trail-dot';
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      document.body.appendChild(dot);
      trailDots.push(dot);

      // Clean up old dots
      if (trailDots.length > MAX_TRAIL) {
        const old = trailDots.shift();
        if (old && old.parentNode) old.parentNode.removeChild(old);
      }

      // Auto-cleanup after animation
      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
        const idx = trailDots.indexOf(dot);
        if (idx > -1) trailDots.splice(idx, 1);
      }, 600);
    }, { passive: true });
  }

  // ===== 17. BUTTON RIPPLE EFFECT =====
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn, .btn-primary, .btn-outline');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, { passive: true });

  // ===== 18. HERO FLOATING ORBS =====
  if (!isTouch && !reduced) {
    const hero = document.querySelector('.hero');
    if (hero) {
      ['hero-orb-1', 'hero-orb-2', 'hero-orb-3'].forEach(cls => {
        const orb = document.createElement('div');
        orb.className = 'hero-orb ' + cls;
        hero.appendChild(orb);
      });
    }
  }

  // ===== 19. TOPBAR SCROLL GLOW =====
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    window.addEventListener('scroll', () => {
      topbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  // ===== 20. FEATURE GRID IN-VIEW DETECTION =====
  const featureGrid = document.querySelector('.feature-grid');
  if (featureGrid && 'IntersectionObserver' in window) {
    const fgi = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          // Mark children as in
          Array.from(entry.target.children).forEach(card => card.classList.add('in'));
          fgi.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    fgi.observe(featureGrid);
  }

  // ===== 21. SECTION IN-VIEW DETECTION =====
  const sections = document.querySelectorAll('.showcase-head, .features, .download');
  if (sections.length && 'IntersectionObserver' in window) {
    const sio = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, { threshold: 0.15 });
    sections.forEach(s => sio.observe(s));
  }

  // ===== 22. CATEGORY PILL GLOW FOLLOW =====
  if (!isTouch) {
    document.addEventListener('mousemove', (e) => {
      const pills = document.querySelectorAll('#cat-grid .cat-pill');
      pills.forEach(pill => {
        const r = pill.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        pill.style.setProperty('--mx', mx + '%');
        pill.style.setProperty('--my', my + '%');
      });
    }, { passive: true });
  }

  // ================================================================
  //                    🥚 EASTER EGGS 🥚
  // ================================================================

  // ===== EASTER EGG 1: KONAMI CODE → Rainbow Mode =====
  const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiIdx = 0;
  let konamiActive = false;

  document.addEventListener('keydown', (e) => {
    const expected = konamiCode[konamiIdx];
    if (e.key === expected || e.key.toLowerCase() === expected) {
      konamiIdx++;
      if (konamiIdx === konamiCode.length) {
        konamiIdx = 0;
        konamiActive = !konamiActive;
        document.body.classList.toggle('konami-mode', konamiActive);
        showEasterEggToast(konamiActive ? '🌈 Rainbow Mode Activated!' : '🌈 Rainbow Mode Off');
        if (konamiActive) spawnConfetti(40);
        setTimeout(() => { if (konamiActive) { konamiActive = false; document.body.classList.remove('konami-mode'); } }, 8000);
      }
    } else {
      konamiIdx = 0;
    }
  });

  // ===== EASTER EGG 2: Click brand logo 7 times → Matrix Rain =====
  let brandClicks = 0;
  let brandClickTimer = null;
  const brandEls = document.querySelectorAll('.brand');
  brandEls.forEach(el => {
    el.addEventListener('click', () => {
      brandClicks++;
      clearTimeout(brandClickTimer);
      brandClickTimer = setTimeout(() => { brandClicks = 0; }, 2000);
      if (brandClicks >= 7) {
        brandClicks = 0;
        triggerMatrixRain();
        showEasterEggToast('💊 Welcome to the Matrix...');
      }
    });
  });

  function triggerMatrixRain() {
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const char = document.createElement('span');
        char.className = 'matrix-char';
        char.textContent = chars[Math.floor(Math.random() * chars.length)];
        char.style.left = Math.random() * 100 + 'vw';
        char.style.setProperty('--fall-speed', (2 + Math.random() * 4) + 's');
        char.style.fontSize = (12 + Math.random() * 10) + 'px';
        document.body.appendChild(char);
        setTimeout(() => char.remove(), 6000);
      }, i * 80);
    }
  }

  // ===== EASTER EGG 3: Type "openhouse" on keyboard → Confetti + Toast =====
  let typedBuffer = '';
  let typedTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.length === 1) {
      typedBuffer += e.key.toLowerCase();
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => { typedBuffer = ''; }, 2000);
      if (typedBuffer.includes('openhouse')) {
        typedBuffer = '';
        spawnConfetti(60);
        showEasterEggToast('🎉 You found the secret! Openhouse loves you!');
      }
    }
  });

  // ===== EASTER EGG 4: Search "hello" in palette → special response =====
  const _palInput = document.getElementById('palette-input');
  if (_palInput) {
    _palInput.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      if (val === 'hello' || val === 'hi' || val === 'hey') {
        showEasterEggToast('👋 Hey there, explorer! Try typing "konami" 😉');
      }
      if (val === 'konami') {
        showEasterEggToast('🎮 ↑↑↓↓←→←→BA — you know the code!');
      }
      if (val === 'matrix' || val === 'neo') {
        triggerMatrixRain();
        showEasterEggToast('💊 Follow the white rabbit...');
      }
      if (val === 'party' || val === 'disco') {
        document.body.classList.toggle('disco-mode');
        showEasterEggToast('🪩 Disco mode!');
        setTimeout(() => document.body.classList.remove('disco-mode'), 6000);
      }
      if (val === '🎉' || val === 'confetti') {
        spawnConfetti(80);
        showEasterEggToast('🎊 Party time!');
      }
    });
  }

  // ===== EASTER EGG 5: Triple-click stats → fun animation =====
  const statNums = document.querySelectorAll('.stat-num');
  statNums.forEach(stat => {
    let clickCount = 0;
    let clickTimer = null;
    stat.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; }, 500);
      if (clickCount >= 3) {
        clickCount = 0;
        // Spin animation
        stat.style.transition = 'transform 0.8s cubic-bezier(.22, 1.3, .36, 1)';
        stat.style.transform = 'rotate(360deg) scale(1.3)';
        setTimeout(() => {
          stat.style.transform = '';
          // Bonus: show random fun number
          const funNums = ['∞', '42', 'π', '🚀', '9001', '0xCAFEBABE'];
          const origText = stat.textContent;
          stat.textContent = funNums[Math.floor(Math.random() * funNums.length)];
          setTimeout(() => { stat.textContent = origText; }, 1500);
        }, 800);
      }
    });
  });

  // ===== EASTER EGG 6: Shake device (mobile) =====
  if (isTouch && 'DeviceMotionEvent' in window) {
    let lastShake = 0;
    window.addEventListener('devicemotion', (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const total = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
      if (total > 35 && Date.now() - lastShake > 3000) {
        lastShake = Date.now();
        document.body.classList.add('shake-mode');
        spawnEmojiRain(['🎉', '✨', '🚀', '💫', '🔥', '⭐', '🌟', '💥'], 15);
        showEasterEggToast('📱 Nice shake! Have some emojis!');
        setTimeout(() => document.body.classList.remove('shake-mode'), 500);
      }
    });
  }

  // ===== EASTER EGG 7: (removed — below "Why Openhouse" section) =====

  // ===== EASTER EGG 8: (removed — below "Why Openhouse" section) =====

  // ===== HELPER: Spawn Confetti =====
  function spawnConfetti(count) {
    const colors = ['#ffb454', '#ffd9a0', '#ff7a7a', '#7dd87d', '#7ab8ff', '#d4a0ff', '#ff9d3d', '#54c8ff'];
    const shapes = ['■', '●', '▲', '◆', '★'];
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        el.style.left = (20 + Math.random() * 60) + 'vw';
        el.style.top = '-10px';
        el.style.color = colors[Math.floor(Math.random() * colors.length)];
        el.style.fontSize = (8 + Math.random() * 10) + 'px';
        el.style.setProperty('--fall-duration', (2 + Math.random() * 3) + 's');
        el.style.setProperty('--drift-x', (-80 + Math.random() * 160) + 'px');
        el.style.setProperty('--spin', (360 + Math.random() * 720) + 'deg');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 5000);
      }, i * 30);
    }
  }

  // ===== HELPER: Spawn Emoji Rain =====
  function spawnEmojiRain(emojis, count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.setProperty('--float-dur', (3 + Math.random() * 4) + 's');
        el.style.fontSize = (18 + Math.random() * 16) + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 7000);
      }, i * 120);
    }
  }

  // ===== HELPER: Easter Egg Toast =====
  function showEasterEggToast(message) {
    // Remove any existing toast
    const existing = document.querySelector('.easter-egg-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'easter-egg-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  // Export new functions
  if (window.OpenHouseEnhanced) {
    window.OpenHouseEnhanced.spawnConfetti = spawnConfetti;
    window.OpenHouseEnhanced.spawnEmojiRain = spawnEmojiRain;
    window.OpenHouseEnhanced.showEasterEggToast = showEasterEggToast;
    window.OpenHouseEnhanced.triggerMatrixRain = triggerMatrixRain;
  }
})();
