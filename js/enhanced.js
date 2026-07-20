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

  // ===== 7. TILT CARDS (Why Openhouse - localized press lift) =====
  if (!reduced) {
    $$('.feature-card').forEach(card => {
      let rect = null;
      let raf = null;

      const applyTilt = (clientX, clientY) => {
        if (!rect) rect = card.getBoundingClientRect();

        const px = (clientX - rect.left) / rect.width;
        const py = (clientY - rect.top) / rect.height;

        // Localized tilt: stronger rotation when pressing near edges/corners
        const rotY = (px - 0.5) * 18;           // horizontal tilt
        const rotX = (0.5 - py) * 16;           // vertical tilt

        // Extra lift/bury based on vertical position
        const lift = (0.5 - py) * 22;           // positive = lift, negative = bury

        card.style.transition = 'transform 0.12s cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform = `
          perspective(900px)
          rotateX(${rotX}deg)
          rotateY(${rotY}deg)
          translateZ(${lift}px)
        `;

        // Glow follows cursor
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
      };

      const resetTilt = () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transition = 'transform 0.35s cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      };

      // Desktop mouse
      if (!isTouch) {
        card.addEventListener('mousemove', (e) => {
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => applyTilt(e.clientX, e.clientY));
        });
        card.addEventListener('mouseleave', resetTilt);
      }

      // Mobile touch support (localized tilt)
      card.addEventListener('touchstart', (e) => {
        rect = card.getBoundingClientRect();
        applyTilt(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (raf) cancelAnimationFrame(raf);
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
  function showCrosshair(x,y,variant=''){
    if (reduced) return;
    crossEl.style.left=x+'px'; crossEl.style.top=y+'px';
    crossEl.className=''; if(variant) crossEl.classList.add(variant);
    void crossEl.offsetWidth;
    crossEl.classList.add('active');
    clearTimeout(crossTimer);
    crossTimer=setTimeout(()=>{ crossEl.classList.remove('active'); }, 520);
  }

  const interactiveSel='button, a, [data-cursor], .cat-pill, .feature-card, .download-card, .cat-app, .dock a, .dock button, .modal-close, .changelog-tab, .palette-trigger, .icon-btn, .admin-menu-item, .btn, .btn-primary, .btn-outline, .brand, .footer-col a';
  // Only these should play the Minecraft damage sound
  const SOUND_ALLOWED_SEL='.modal-close, #welcome-dismiss, #upload-form button[type="submit"], #login-form button[type="submit"], #icon-form button[type="submit"], #tags-form button[type="submit"], #confirm-ok, #upload-cancel, #confirm-cancel, #tags-cancel, #icon-close, #icon-reset';
  let lastTouchTs = 0;
  let lastSoundTs = 0;

  function handleInteraction(e){
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
})();
