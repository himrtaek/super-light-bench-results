(() => {
  'use strict';
  const canvas = document.querySelector('#scene');
  const stage = document.querySelector('#stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const prompt = document.querySelector('#prompt');
  const H = 540, GROUND = 406, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const v = clamp((x - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };
  const seeded = n => { const t = Math.sin(n * 127.17 + 61.73) * 43758.55; return t - Math.floor(t); };
  const images = {};
  const load = (name, file) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => { images[name] = im; resolve(); }; im.onerror = reject; im.src = file; });
  const assetsReady = Promise.all([
    load('bg', 'assets/glasshouse.webp'),
    load('hero', 'assets/courier.webp'),
    load('enemy', 'assets/seed-sentinel.webp')
  ]);
  let W = 960, pixelRatio = 1, cam = 0, t = 0, last = 0, freeze = false, shake = 0, bloom = 0, lastInput = -100;
  const held = { left: false, right: false };
  const hero = { x: 335, y: GROUND, vx: 0, vy: 0, hp: 4, facing: 1, attack: 0, cooldown: 0, invuln: 0, landed: true };
  const enemies = [];
  const motes = [], particles = [];
  function makeEnemy(x) { return { x, y: GROUND, hp: 3, phase: 'approach', phaseTime: 0, attackCooldown: 1.4, facing: -1, flash: 0, alpha: 1, hitHero: false, spawn: x }; }
  function reset() {
    Object.assign(hero, { x: 335, y: GROUND, vx: 0, vy: 0, hp: 4, facing: 1, attack: 0, cooldown: 0, invuln: 0, landed: true });
    enemies.length = 0; enemies.push(makeEnemy(555), makeEnemy(850));
    particles.length = 0; bloom = 0; t = 0;
  }
  reset();
  for (let i = 0; i < 60; i++) motes.push({ x: seeded(i * 3) * 960, y: seeded(i * 3 + 1) * 380, r: .7 + seeded(i * 3 + 2) * 2, phase: seeded(i + 400) * TAU });
  function burst(x, y, kind, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + seeded(t * 91 + i) * .5;
      const speed = 65 + seeded(i * 13 + t * 31) * 210;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 45, age: 0, life: .3 + seeded(i * 31 + t) * .42, size: kind === 'leaf' ? 3 + seeded(i) * 6 : 1.5 + seeded(i) * 3.8, kind, spin: seeded(i + t) * TAU });
    }
  }
  function attack() {
    if (hero.cooldown > 0 || hero.hp <= 0) return;
    hero.cooldown = .35; hero.attack = .29; hero.vx += hero.facing * 35; lastInput = t;
    let hit = false;
    for (const e of enemies) {
      if (e.phase === 'dead' || e.phase === 'gone') continue;
      const dx = (e.x - hero.x) * hero.facing;
      if (dx > -12 && dx < 145 && Math.abs((e.y - 60) - (hero.y - 67)) < 85) {
        e.hp--; e.flash = .22; e.x += hero.facing * 25; hit = true;
        burst(e.x - hero.facing * 18, GROUND - 82, 'spark', 17);
        if (e.hp <= 0) { e.phase = 'dead'; e.phaseTime = 0; burst(e.x, GROUND - 85, 'leaf', 29); bloom = clamp(bloom + .33, 0, 1); }
        else { e.phase = 'recoil'; e.phaseTime = 0; bloom = clamp(bloom + .12, 0, 1); }
      }
    }
    burst(hero.x + hero.facing * 95, hero.y - 95, 'gold', hit ? 9 : 5);
    if (hit) shake = .12;
  }
  function jump() {
    if (!hero.landed || hero.hp <= 0) return;
    hero.vy = -470; hero.landed = false; lastInput = t;
    burst(hero.x, GROUND - 1, 'dust', 7);
  }
  function hitHero() {
    if (hero.invuln > 0 || hero.hp <= 0) return;
    hero.hp--; hero.invuln = .9; hero.vx = -hero.facing * 160; hero.vy = -150; hero.landed = false;
    shake = .26; burst(hero.x, hero.y - 80, 'coral', 22);
    if (hero.hp <= 0) { prompt.textContent = '불씨가 꺼졌습니다'; prompt.classList.add('show'); }
  }
  function resize() {
    const b = stage.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(b.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(b.height * pixelRatio));
    W = H * b.width / b.height;
  }
  new ResizeObserver(resize).observe(stage); resize();
  function update(dt) {
    t += dt;
    if (t >= 11) reset();
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    hero.attack = Math.max(0, hero.attack - dt);
    hero.invuln = Math.max(0, hero.invuln - dt);
    shake = Math.max(0, shake - dt);
    const move = Number(held.right) - Number(held.left);
    if (move) { hero.facing = move; hero.vx += (move * 215 - hero.vx) * Math.min(1, dt * 13); lastInput = t; }
    else hero.vx *= Math.max(0, 1 - dt * (hero.landed ? 9 : 2.5));
    hero.x = clamp(hero.x + hero.vx * dt, 85, 900);
    hero.vy += 1150 * dt; hero.y += hero.vy * dt;
    if (hero.y >= GROUND) {
      if (!hero.landed && hero.vy > 180) burst(hero.x, GROUND - 2, 'dust', 7);
      hero.y = GROUND; hero.vy = 0; hero.landed = true;
    }
    for (const e of enemies) {
      e.phaseTime += dt; e.flash = Math.max(0, e.flash - dt); e.attackCooldown -= dt;
      const dx = hero.x - e.x, dist = Math.abs(dx);
      if (e.phase === 'approach') {
        e.facing = Math.sign(dx) || -1;
        if (dist > 112) e.x += e.facing * (e.spawn > 700 ? 32 : 55) * dt;
        if (dist < 150 && e.attackCooldown <= 0) { e.phase = 'windup'; e.phaseTime = 0; e.hitHero = false; }
      } else if (e.phase === 'windup' && e.phaseTime > .58) { e.phase = 'lunge'; e.phaseTime = 0; }
      else if (e.phase === 'lunge') {
        e.x += e.facing * 245 * dt;
        if (!e.hitHero && dist < 60 && Math.abs(hero.y - GROUND) < 75) { hitHero(); e.hitHero = true; }
        if (e.phaseTime > .30) { e.phase = 'recover'; e.phaseTime = 0; }
      } else if (e.phase === 'recover' && e.phaseTime > .56) { e.phase = 'approach'; e.phaseTime = 0; e.attackCooldown = 1.3; }
      else if (e.phase === 'recoil' && e.phaseTime > .31) { e.phase = 'approach'; e.phaseTime = 0; e.attackCooldown = .8; }
      else if (e.phase === 'dead' && e.phaseTime > 1.3) { e.phase = 'gone'; e.phaseTime = 0; }
      else if (e.phase === 'gone' && e.phaseTime > 2.1 && t < 9) Object.assign(e, makeEnemy(e.spawn));
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'leaf' ? 65 : 350) * dt; p.vx *= 1 - dt * 1.4;
      if (p.age >= p.life) particles.splice(i, 1);
    }
    if (hero.hp <= 0 && hero.invuln < .1) reset();
    const tutorial = t > 2.6 && t < 5.5 && lastInput < 0;
    if (tutorial) prompt.classList.add('show'); else if (hero.hp > 0) prompt.classList.remove('show');
  }
  function backdrop() {
    const bgWidth = Math.max(960, W), maxCam = Math.max(0, bgWidth - W);
    cam = clamp(hero.x - W * (W < 580 ? .23 : .46), 0, maxCam);
    const jitter = shake ? Math.sin(t * 142) * shake * 17 : 0;
    ctx.save(); ctx.translate(-cam + jitter, 0);
    ctx.drawImage(images.bg, 0, 0, bgWidth, H);
    // Light shafts are translucent and move independently of the painted setting.
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const x = 78 + i * 180 + Math.sin(t * .4 + i) * 9;
      const grad = ctx.createLinearGradient(x - 70, 30, x + 140, GROUND);
      grad.addColorStop(0, 'rgba(255,201,147,.10)'); grad.addColorStop(1, 'rgba(123,205,204,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 190, GROUND); ctx.lineTo(x + 35, GROUND); ctx.fill();
    }
    ctx.restore();
    for (const m of motes) {
      const x = m.x + Math.sin(t * .7 + m.phase) * 13;
      const y = m.y + Math.cos(t * .9 + m.phase) * 11;
      ctx.globalAlpha = .14 + .34 * (.5 + .5 * Math.sin(t * 2 + m.phase));
      ctx.fillStyle = '#ffe5ae'; ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Ground contact is a fixed edge matching the painted terrace.
    const edge = ctx.createLinearGradient(0, GROUND - 2, 0, GROUND + 8);
    edge.addColorStop(0, 'rgba(255,204,149,.54)'); edge.addColorStop(1, 'rgba(4,31,39,0)');
    ctx.fillStyle = edge; ctx.fillRect(0, GROUND - 2, bgWidth, 10);
    ctx.restore();
  }
  function ellipse(x, y, rx, ry, col, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  function glow(x, y, r, color, alpha) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function drawEnemy(e) {
    if (e.phase === 'gone') return;
    const dead = e.phase === 'dead', a = dead ? 1 - smooth(.5, 1.3, e.phaseTime) : 1;
    const bob = dead ? -e.phaseTime * 35 : Math.sin(t * 6 + e.spawn) * 2;
    ellipse(e.x, GROUND + 5, 50, 9, '#01151b', .42 * a);
    if (e.phase === 'windup') {
      const u = smooth(0, .58, e.phaseTime);
      glow(e.x, GROUND - 82, 105 + u * 38, '#ff6b36', .20 + u * .35);
      ctx.strokeStyle = `rgba(255,175,110,${.35 + u * .6})`; ctx.lineWidth = 2 + u * 2; ctx.beginPath(); ctx.arc(e.x, GROUND - 82, 42 + u * 18, -.7, .7); ctx.stroke();
    }
    ctx.save(); ctx.globalAlpha = a; ctx.translate(e.x, GROUND + bob);
    if (e.phase === 'recoil') ctx.rotate(-e.facing * Math.sin(e.phaseTime * 10) * .12);
    if (dead) ctx.rotate(e.phaseTime * .3);
    if (e.facing > 0) ctx.scale(-1, 1);
    ctx.drawImage(images.enemy, -112, -165, 224, 165);
    if (e.flash > 0) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = e.flash * 3; ctx.drawImage(images.enemy, -112, -165, 224, 165); }
    ctx.restore();
    glow(e.x, GROUND - 87 + bob, 32, '#ff7c2a', dead ? a * .25 : .26);
    if (!dead) {
      const hx = e.x - 29, hy = GROUND - 160;
      ctx.fillStyle = 'rgba(3,25,31,.72)'; ctx.fillRect(hx, hy, 58, 5);
      ctx.fillStyle = '#f8bd76'; ctx.fillRect(hx, hy, 58 * e.hp / 3, 5);
    }
  }
  function drawHero() {
    const walk = Math.abs(hero.vx) > 30 && hero.landed;
    const bob = walk ? Math.sin(t * 16) * 3 : Math.sin(t * 3) * 1.2;
    const attacking = hero.attack > 0, u = attacking ? 1 - hero.attack / .29 : 0;
    ellipse(hero.x, GROUND + 3, 39, 7, '#02191e', .54);
    glow(hero.x + 8, hero.y - 131, 66, '#ffba65', .18);
    ctx.save(); ctx.translate(hero.x, hero.y + bob);
    if (hero.facing < 0) ctx.scale(-1, 1);
    if (!hero.landed) ctx.rotate(-.12); else if (attacking) ctx.rotate(-.07 * Math.sin(u * Math.PI));
    if (hero.invuln > 0 && Math.floor(hero.invuln * 20) % 2) ctx.globalAlpha = .5;
    ctx.drawImage(images.hero, -90, -169, 164, 169);
    ctx.restore();
    // The pruning spear is articulated in code, independently of the painted hero.
    ctx.save(); ctx.translate(hero.x + hero.facing * 18, hero.y - 68 + bob); ctx.scale(hero.facing, 1);
    ctx.rotate(attacking ? -.95 + 1.55 * smooth(0, .6, u) : .12 + Math.sin(t * 2) * .04);
    ctx.lineCap = 'round'; ctx.strokeStyle = '#452c2c'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(76, -10); ctx.stroke();
    ctx.strokeStyle = '#e2a962'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(76, -12); ctx.stroke();
    const blade = new Path2D(); blade.moveTo(74, -16); blade.quadraticCurveTo(100, -23, 117, -48); blade.quadraticCurveTo(112, -12, 86, -2); blade.closePath();
    ctx.fillStyle = '#e4e3d0'; ctx.strokeStyle = '#334656'; ctx.lineWidth = 2; ctx.fill(blade); ctx.stroke(blade);
    ctx.restore();
    if (attacking) drawSlash(u);
  }
  function drawSlash(u) {
    const x = hero.x + hero.facing * 26, y = hero.y - 78;
    ctx.save(); ctx.translate(x, y); ctx.scale(hero.facing, 1); ctx.globalCompositeOperation = 'screen';
    const alpha = Math.sin(u * Math.PI);
    ctx.strokeStyle = `rgba(255,246,213,${alpha * .8})`; ctx.lineCap = 'round'; ctx.lineWidth = 13 * (1 - u) + 3;
    ctx.beginPath(); ctx.ellipse(39, -17, 93, 61, -.12, -1.1 + u * .45, 1.05 + u * .25); ctx.stroke();
    ctx.strokeStyle = `rgba(255,155,85,${alpha * .7})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(39, -17, 101, 70, -.12, -1.08 + u * .35, .95 + u * .2); ctx.stroke();
    glow(130, -24, 35, '#fff7dc', alpha * .8); ctx.restore();
  }
  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.age / p.life;
      ctx.save(); ctx.globalAlpha = a;
      if (p.kind === 'leaf') {
        ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.age * 5);
        ctx.fillStyle = '#d68062'; ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.quadraticCurveTo(p.size * .75, 0, 0, p.size); ctx.quadraticCurveTo(-p.size * .75, 0, 0, -p.size); ctx.fill();
      } else if (p.kind === 'dust') ellipse(p.x, p.y, p.size * 1.5, p.size * .5, '#d7b58d', a * .6);
      else { ctx.fillStyle = p.kind === 'spark' ? '#fff0bf' : p.kind === 'coral' ? '#ff846e' : '#ffc178'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  function foreground() {
    ctx.save(); ctx.translate(-cam * 1.2, 0);
    for (let i = 0; i < 10; i++) {
      const x = i * 113 + seeded(i) * 60 - 25;
      ctx.strokeStyle = 'rgba(4,30,34,.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 540); ctx.quadraticCurveTo(x + 14, 466, x - 16, 445 + seeded(i + 30) * 45); ctx.stroke();
      ctx.fillStyle = i % 3 ? 'rgba(8,51,51,.7)' : 'rgba(12,66,61,.72)';
      for (let j = 0; j < 4; j++) {
        const yy = 475 + j * 17, xx = x + (j % 2 ? -1 : 1) * (10 + j * 2);
        ctx.beginPath(); ctx.ellipse(xx, yy, 15 - j * 2, 5, j % 2 ? -.4 : .4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function hud() {
    ctx.save();
    const small = W < 580, sx = small ? 18 : 35, sy = small ? 56 : 58;
    ctx.fillStyle = 'rgba(4,24,31,.75)'; ctx.beginPath(); ctx.roundRect(sx - 8, sy - 16, small ? 156 : 184, 53, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(235,183,127,.45)'; ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const x = sx + i * 30, y = sy + 5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.4);
      ctx.fillStyle = i < hero.hp ? '#f6b487' : '#365258'; ctx.strokeStyle = i < hero.hp ? '#ffe1ae' : '#73817b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(12, -7, 11, 8, 0, 12); ctx.bezierCurveTo(-9, 3, -7, -7, 0, -11); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#d4b893'; ctx.font = '10px system-ui,sans-serif'; ctx.letterSpacing = '1px'; ctx.fillText('LUMEN', sx, sy + 27);
    ctx.fillStyle = 'rgba(234,190,133,.26)'; ctx.fillRect(sx + 122, sy - 3, 37, 6);
    ctx.fillStyle = '#ffca7e'; ctx.fillRect(sx + 122, sy - 3, 37 * bloom, 6);
    ctx.strokeStyle = '#e8b27b'; ctx.beginPath(); ctx.arc(sx + 140, sy + 1, 19, -.25 * Math.PI, 1.25 * Math.PI); ctx.stroke();
    ctx.restore();
    if (t < 2.5) {
      ctx.save(); ctx.globalAlpha = smooth(0, .35, t) * (1 - smooth(1.9, 2.5, t));
      ctx.textAlign = 'center'; ctx.fillStyle = '#f9e9cd'; ctx.shadowColor = '#08232a'; ctx.shadowBlur = 12;
      ctx.font = `italic ${small ? 24 : 31}px Georgia,serif`; ctx.fillText('유리 정원의 마지막 불씨', W / 2, 168);
      ctx.strokeStyle = 'rgba(255,215,169,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W / 2 - 120, 181); ctx.lineTo(W / 2 - 17, 181); ctx.moveTo(W / 2 + 17, 181); ctx.lineTo(W / 2 + 120, 181); ctx.stroke();
      ctx.restore();
    }
    const remain = Math.max(0, 11 - t);
    ctx.save(); ctx.fillStyle = 'rgba(7,29,34,.7)'; ctx.fillRect(W - 99, 37, 66, 24);
    ctx.fillStyle = '#f3d1a7'; ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${remain.toFixed(1)}s`, W - 66, 54); ctx.restore();
  }
  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    backdrop();
    ctx.save(); ctx.translate(-cam, 0);
    enemies.sort((a, b) => a.x - b.x).forEach(drawEnemy);
    drawHero(); drawParticles();
    ctx.restore();
    foreground(); hud();
  }
  function frame(now) {
    const dt = last ? Math.min((now - last) / 1000, .033) : 0; last = now;
    if (!freeze) update(dt);
    render(); requestAnimationFrame(frame);
  }
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  document.addEventListener('keydown', e => {
    if (keyMap[e.code]) { held[keyMap[e.code]] = true; e.preventDefault(); }
    if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) { jump(); e.preventDefault(); }
    if ((e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'KeyX') && !e.repeat) { attack(); e.preventDefault(); }
  });
  document.addEventListener('keyup', e => { if (keyMap[e.code]) { held[keyMap[e.code]] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { held.left = false; held.right = false; });
  for (const dir of ['left', 'right']) {
    const b = document.querySelector(`#${dir}`);
    b.addEventListener('pointerdown', e => { e.preventDefault(); held[dir] = true; b.classList.add('pressed'); b.setPointerCapture(e.pointerId); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => { held[dir] = false; b.classList.remove('pressed'); });
  }
  document.querySelector('#jump').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  document.querySelector('#attack').addEventListener('pointerdown', e => { e.preventDefault(); attack(); });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') attack(); });
  window.__pilot06 = { assetsReady, get state() { return { time: t, hero: { x: hero.x, y: hero.y, hp: hero.hp, attacking: hero.attack > 0, landed: hero.landed }, enemies: enemies.map(e => ({ x: e.x, hp: e.hp, phase: e.phase })), view: { width: W, height: H, camera: cam }, particleCount: particles.length }; }, attack, jump, reset };
  assetsReady.then(() => { requestAnimationFrame(frame); }).catch(e => { console.error('Asset load failed', e); });
})();
