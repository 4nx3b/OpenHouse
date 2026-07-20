/**
 * OpenHouse Enhanced Features
 * All additive - does not modify existing functionality
 * Dark mode toggle has been removed
 */

(function() {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const $ = (s, ctx = document) => (ctx || document).querySelector(s);
  const $$ = (s, ctx = document) => Array.from((ctx || document).querySelectorAll(s));

  // ============================================================
  // 1. SCROLL REVEAL ANIMATIONS
  // ============================================================
  if (!reduced) {
    const revealElements = $$('.reveal-up, .feature-card, .stat, .cat-pill');
    
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

    revealElements.forEach(el => revealObserver.observe(el));
  }

  // ============================================================
  // 2. BACK TO TOP BUTTON
  // ============================================================
  function createBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.setAttribute('aria-label', 'Back to top');
    btn.addEventListener('click', () => {
      if (typeof Lenis !== 'undefined' && window.OpenhouseLenis) {
        window.OpenhouseLenis.scrollTo(document.body, { offset: 0 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    document.body.appendChild(btn);
    return btn;
  }

  const backToTop = createBackToTop();

  // ============================================================
  // 3. TOAST NOTIFICATIONS
  // ============================================================
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

  if (window.showToast) {
    window.showToast = showToast;
  }

  // ============================================================
  // 4. MODAL ANIMATIONS
  // ============================================================
  const modalOverlays = $$('.modal-overlay');
  modalOverlays.forEach(overlay => {
    const modal = $('.modal', overlay);
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.92) translateY(20px)';
  });

  // ============================================================
  // 5. SEARCH ENHANCEMENTS
  // ============================================================
  const paletteInput = $('#palette-input');
  const paletteOverlay = $('#palette-overlay');

  if (paletteInput && paletteOverlay) {
    const originalWidth = paletteInput.parentElement.style.width || 'auto';
    paletteInput.addEventListener('focus', () => {
      paletteInput.parentElement.style.width = '280px';
    });
    paletteInput.addEventListener('blur', () => {
      paletteInput.parentElement.style.width = originalWidth;
    });
  }

  // ============================================================
  // 6. STATS COUNTER
  // ============================================================
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

  // ============================================================
  // 7. TYPEWRITER EFFECT
  // ============================================================
  const typewriteElements = $$('[data-typewrite]');
  if (typewriteElements.length && !reduced) {
    typewriteElements.forEach(el => {
      const text = el.textContent;
      el.innerHTML = '';
      el.style.visibility = 'visible';
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
        } else {
          clearInterval(typeInterval);
          el.classList.add('done');
        }
      }, 50);
    });
  }

  // ============================================================
  // 8. MAGNETIC BUTTONS
  // ============================================================
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

  // ============================================================
  // 9. TILT CARDS
  // ============================================================
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

  // ============================================================
  // 10. MARQUEE
  // ============================================================
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

  // ============================================================
  // 11. DOCK NAVIGATION
  // ============================================================
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

  // ============================================================
  // 12. KEYBOARD NAVIGATION
  // ============================================================
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';
    if (typing) return;

    if (e.key === 'Escape') {
      $$('.modal-overlay.open').forEach(overlay => {
        overlay.classList.remove('open');
      });
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

  // ============================================================
  // 13. SCROLL PROGRESS
  // ============================================================
  const progressBar = $('#scroll-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
      progressBar.style.transform = `scaleX(${p || 0})`;
    }, { passive: true });
  }

  // ============================================================
  // 14. BACK TO TOP VISIBILITY
  // ============================================================
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    document.body.classList.add('enhanced-loaded');
    console.log('✨ OpenHouse Enhanced Features Loaded');
  }

  // Export
  window.OpenHouseEnhanced = { showToast, init };
})();
