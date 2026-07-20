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

  // ===== 7. TILT CARDS =====
  if (!isTouch && !reduced) {
    $$('.tilt-card').forEach(card => {
      let rect = null;
      card.addEventListener('mousemove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rotY = (px - 0.5) * 12;
        const rotX = (0.5 - py) * 12;
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
      });
      card.addEventListener('mouseleave', () => {
        rect = null;
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateZ(0)';
      });
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
  const dock = $('#dock');
  if (dock) {
    const dockLinks = $$('a, button', dock);
    function updateDockActive() {
      const sections = ['top', 'apps', 'features', 'submit'];
      const scrollPos = window.scrollY + window.innerHeight / 2;
      sections.forEach((sectionId, index) => {
        const section = $(`#${sectionId}`);
        if (!section) return;
        const sectionTop = section.offsetTop;
        const nextSection = sections[index + 1] ? $(`#${sections[index + 1]}`) : null;
        const nextTop = nextSection ? nextSection.offsetTop : document.body.offsetHeight;
        if (scrollPos >= sectionTop && (nextTop ? scrollPos < nextTop : true)) {
          dockLinks.forEach(link => link.classList.remove('active'));
          const activeLink = dockLinks.find(link => link.getAttribute('href') === `#${sectionId}`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }
    window.addEventListener('scroll', updateDockActive, { passive: true });
    updateDockActive();
  }

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

  // ===== 13. SEARCH BAR EXPAND =====
  const paletteInput = $('#palette-input');
  if (paletteInput) {
    const originalWidth = paletteInput.parentElement.style.width || 'auto';
    paletteInput.addEventListener('focus', () => {
      paletteInput.parentElement.style.width = '280px';
    });
    paletteInput.addEventListener('blur', () => {
      paletteInput.parentElement.style.width = originalWidth;
    });
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

  // ===== 15. TAP SOUNDS & CROSSHAIR FOR TOUCH DEVICES =====
  let tapAudioContext = null;
  let audioUnlocked = false;
  let lastTapTime = 0;
  const TAP_DEBOUNCE = 100;

  // Create crosshair element for all devices
  const crosshair = document.createElement('div');
  crosshair.id = 'touch-crosshair';
  document.body.appendChild(crosshair);

  function showCrosshair(x, y) {
    const c = $('#touch-crosshair');
    if (!c) return;
    c.style.left = x + 'px';
    c.style.top = y + 'px';
    c.classList.add('active');
    setTimeout(() => {
      c.classList.remove('active');
    }, 150);
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      tapAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      // Create and play silent buffer to unlock
      const buffer = tapAudioContext.createBuffer(1, 1, 22050);
      const source = tapAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(tapAudioContext.destination);
      source.start(0);
    } catch (e) {
      console.log('Audio init:', e);
    }
  }

  function playTapSound() {
    const now = Date.now();
    if (now - lastTapTime < TAP_DEBOUNCE) return;
    lastTapTime = now;

    if (!audioUnlocked) {
      unlockAudio();
      // Retry after unlock
      setTimeout(playTapSound, 30);
      return;
    }

    if (!tapAudioContext) return;

    try {
      const oscillator = tapAudioContext.createOscillator();
      const gainNode = tapAudioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 1000;
      
      oscillator.connect(gainNode);
      gainNode.connect(tapAudioContext.destination);

      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(tapAudioContext.currentTime + 0.05);
      
      gainNode.gain.exponentialRampToValueAtTime(0.0001, tapAudioContext.currentTime + 0.05);
    } catch (e) {
      console.log('Sound error:', e);
    }
  }

  function handleTap(e) {
    const now = Date.now();
    if (now - lastTapTime < TAP_DEBOUNCE) return;
    lastTapTime = now;

    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;

    // Interactive elements selector
    const interactive = 'button, a, [data-cursor], .cat-pill, .feature-card, .download-card, .cat-app, .dock a, .dock button, .modal-close, .changelog-tab, .palette-trigger, .icon-btn, .admin-menu-item, .btn, .btn-primary, .btn-outline, .brand, .footer-col a';
    const target = e.target.closest(interactive);
    
    if (target) {
      playTapSound();
      showCrosshair(x, y);
    }
  }

  // Unlock audio on first interaction
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.addEventListener('mousedown', unlockAudio, { once: true, passive: true });

  // Handle taps
  document.addEventListener('touchstart', handleTap, { passive: true });
  document.addEventListener('mousedown', handleTap, { passive: true });

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
  window.OpenHouseEnhanced = { showToast, init };
})();
