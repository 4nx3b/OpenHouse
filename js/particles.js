(function(){
  const canvas = document.getElementById('particles');
  const hero = document.querySelector('.hero');
  if(!canvas || !hero) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover:none)').matches;

  let w, h, dpr;
  let particles = [];
  let mouse = { x: -9999, y: -9999, active:false };
  let bursts = [];
  let running = false;
  let glowSprite = null;

  // Lighter budget: fewer particles, capped pixel ratio (perf > crispness here)
  const COUNT_DESKTOP = 34;
  const COUNT_MOBILE = 14;
  const RADIUS = 170; // mouse influence radius, css px

  function buildGlowSprite(){
    // pre-render a soft dot once instead of using ctx.shadowBlur per-particle per-frame
    const s = 24;
    const off = document.createElement('canvas');
    off.width = off.height = s;
    const octx = off.getContext('2d');
    const grad = octx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grad.addColorStop(0, 'rgba(255,200,140,0.9)');
    grad.addColorStop(1, 'rgba(255,200,140,0)');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, s, s);
    glowSprite = off;
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = hero.getBoundingClientRect();
    const cssW = window.innerWidth;
    const cssH = Math.max(rect.height, window.innerHeight * 0.6);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    w = canvas.width = cssW * dpr;
    h = canvas.height = cssH * dpr;
  }

  function makeParticle(){
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.4 + 0.5) * dpr,
      vx: (Math.random() - 0.5) * 0.14 * dpr,
      vy: (Math.random() - 0.5) * 0.14 * dpr,
      base: Math.random() * 0.45 + 0.12
    };
  }

  function init(){
    resize();
    const count = isTouch ? COUNT_MOBILE : COUNT_DESKTOP;
    particles = Array.from({length: count}, makeParticle);
  }

  function addBurst(clientX, clientY){
    if(!running) return; // loop is off (touch/reduced) — skip building bursts
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    if(y < -100 || y > h + 100) return; // outside the canvas area, skip
    const n = 10;
    for(let i=0;i<n;i++){
      const angle = (Math.PI * 2 * i) / n + Math.random()*0.3;
      const speed = (Math.random()*2 + 1) * dpr;
      bursts.push({
        x, y,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 1,
        r: (Math.random()*1.6+0.7) * dpr
      });
    }
  }
  window.__particleBurst = addBurst;

  function draw(){
    ctx.clearRect(0,0,w,h);

    const radiusPx = RADIUS * dpr;
    const radiusSq = radiusPx * radiusPx;

    for(let i=0;i<particles.length;i++){
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if(p.x < 0) p.x = w; else if(p.x > w) p.x = 0;
      if(p.y < 0) p.y = h; else if(p.y > h) p.y = 0;

      let alpha = p.base;
      if(mouse.active){
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const distSq = dx*dx + dy*dy;
        if(distSq < radiusSq){
          const t = 1 - distSq/radiusSq;
          p.x += dx * t * 0.001;
          p.y += dy * t * 0.001;
          alpha = Math.min(p.base + t*0.5, 1);
        }
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(240,238,233,${alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }

    if(bursts.length){
      for(let i=bursts.length-1;i>=0;i--){
        const b = bursts[i];
        b.x += b.vx; b.y += b.vy;
        b.vx *= 0.95; b.vy *= 0.95;
        b.life -= 0.035;
        if(b.life <= 0){ bursts.splice(i,1); continue; }
        const size = 22 * b.life * dpr;
        ctx.globalAlpha = b.life;
        ctx.drawImage(glowSprite, b.x - size/2, b.y - size/2, size, size);
        ctx.globalAlpha = 1;
      }
    }

    requestAnimationFrame(step);
  }

  function step(){
    if(!running) return;
    draw();
    requestAnimationFrame(step);
  }

  function start(){ if(!running){ running = true; requestAnimationFrame(step); } }
  function stop(){ running = false; }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 150);
  });

  if(!isTouch){
    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * dpr;
      mouse.y = (e.clientY - rect.top) * dpr;
      mouse.active = e.clientY < rect.bottom;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { mouse.active = false; });
  }

  buildGlowSprite();
  init();

  // On touch / reduced-motion devices, skip the continuous animation loop
  // entirely and just paint one static frame (saves CPU/battery on phones).
  if(isTouch || reduced){
    draw();
  } else if('IntersectionObserver' in window){
    // only animate while the hero is actually visible — saves cycles on the
    // rest of the page and while the tab is scrolled away or backgrounded
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => entry.isIntersecting ? start() : stop());
    }, { threshold: 0 });
    io.observe(hero);
  } else {
    start();
  }
})();
