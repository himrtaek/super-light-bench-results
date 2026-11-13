(() => {
  'use strict';
  const game = document.getElementById('game');
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d', { alpha: true });
  const boss = document.getElementById('boss');
  const hero = document.getElementById('hero');
  const button = document.getElementById('parry');
  const cue = document.getElementById('cue');
  const result = document.getElementById('result');
  const bossFill = document.getElementById('bossFill');
  const heroFill = document.getElementById('heroFill');
  const bossValue = document.getElementById('bossValue');
  const heroValue = document.getElementById('heroValue');
  const cycleMs = 3900;
  const windupStart = 1650;
  const impactStart = 2700;
  const impactEnd = 3050;
  let start = performance.now();
  let lastCycle = -1;
  let resolved = false;
  let hpBoss = 100;
  let hpHero = 100;
  let state = 'playing';
  let phase = 'idle';
  let flashUntil = 0;
  let noticeUntil = 0;
  let particles = [];
  let rain = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  function resize() {
    const rect = game.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rain = Array.from({ length: Math.min(150, Math.round(width * height / 7000)) }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      speed: 4 + Math.random() * 7, length: 8 + Math.random() * 17,
      alpha: .08 + Math.random() * .17
    }));
  }
  function hud() {
    bossFill.style.transform = `scaleX(${hpBoss / 100})`;
    heroFill.style.transform = `scaleX(${hpHero / 100})`;
    bossValue.textContent = `${hpBoss}%`;
    heroValue.textContent = `${hpHero}%`;
  }
  function notice(text, ms = 1000) {
    result.textContent = text;
    result.classList.add('show');
    noticeUntil = performance.now() + ms;
  }
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 7;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 2, life: 1, color, r: 1 + Math.random() * 3 });
    }
  }
  function finish(win) {
    state = win ? 'won' : 'lost';
    phase = 'end';
    cue.classList.remove('show');
    button.classList.remove('ready');
    button.innerHTML = '다시 시작<small>RETRY</small>';
    notice(win ? '종지기가 무너졌다' : '다시 일어나 싸워라', 100000);
  }
  function reset() {
    hpBoss = 100; hpHero = 100; state = 'playing'; phase = 'idle';
    start = performance.now(); lastCycle = -1; resolved = false;
    boss.className = 'actor'; hero.className = 'actor';
    button.innerHTML = '받아치기<small>타이밍 방어</small>';
    result.classList.remove('show'); hud();
  }
  function parry() {
    if (state !== 'playing') { reset(); return; }
    const now = performance.now();
    const t = (now - start) % cycleMs;
    if (t >= windupStart && t < impactStart && !resolved) {
      resolved = true;
      hpBoss = clamp(hpBoss - 20, 0, 100);
      hud();
      boss.classList.add('hurt'); hero.classList.add('parry');
      flashUntil = now + 540;
      burst(width * (width < height ? .53 : .48), height * .55, '#b4fff1', 40);
      notice('완벽한 받아치기 · 20 피해', 950);
      if (hpBoss === 0) finish(true);
    } else if (t < windupStart) {
      notice('아직 종이 울리지 않았다', 650);
    } else if (t >= impactStart && t < impactEnd) {
      notice('한 박자 늦었다', 650);
    }
  }
  button.addEventListener('click', parry);
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) parry(); } });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(game);
  resize(); hud();
  const images = [...document.images];
  const assetsReady = Promise.all(images.map(img => img.decode().catch(e => { throw new Error(`image failed: ${img.src}: ${e}`); })));
  window.__pilot05 = { get state() { return { phase, hpBoss, hpHero, gameState: state, resolved, width, height }; }, assetsReady };
  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(40, now - lastFrame); lastFrame = now;
    ctx.clearRect(0, 0, width, height);
    for (const line of rain) {
      line.x -= dt * .18; line.y += line.speed * dt / 16;
      if (line.y > height + 25) { line.y = -25; line.x = Math.random() * (width + 70); }
      if (line.x < -30) line.x = width + 30;
      ctx.strokeStyle = `rgba(169,227,229,${line.alpha})`;
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(line.x, line.y); ctx.lineTo(line.x - line.length * .28, line.y + line.length); ctx.stroke();
    }
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += .1 * dt / 16; p.life -= dt / 580;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.01, p.r * p.life), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state === 'playing') {
      const elapsed = now - start;
      const cycle = Math.floor(elapsed / cycleMs);
      const t = elapsed % cycleMs;
      if (cycle !== lastCycle) { lastCycle = cycle; resolved = false; boss.classList.remove('hurt'); hero.classList.remove('parry', 'hurt'); }
      phase = t < windupStart ? 'idle' : t < impactStart ? 'windup' : t < impactEnd ? 'impact' : 'recover';
      cue.classList.toggle('show', phase === 'windup' && !resolved);
      button.classList.toggle('ready', phase === 'windup' && !resolved);
      boss.classList.toggle('windup', phase === 'windup' && !resolved);
      boss.classList.toggle('impact', phase === 'impact' && !resolved);
      if (phase === 'impact' && !resolved) {
        resolved = true;
        hpHero = clamp(hpHero - 20, 0, 100);
        hero.classList.add('hurt'); hud();
        burst(width * (width < height ? .35 : .27), height * .62, '#e7a370', 25);
        notice('종지기의 일격 · 20 피해', 950);
        if (hpHero === 0) finish(false);
      }
      if (now > flashUntil) { boss.classList.remove('hurt'); hero.classList.remove('parry'); }
    }
    if (now > noticeUntil && state === 'playing') result.classList.remove('show');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
