(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scene = $('scene');
  const art = $('sceneArt');
  const weather = $('weather');
  const ctx = weather.getContext('2d', { alpha: true });
  const moveBtn = $('moveBtn');
  const scanBtn = $('scanBtn');
  const marker = $('marker');
  const state = {
    sceneReady: false,
    elapsed: 0,
    loop: 0,
    progress: 0,
    lookX: 0,
    lookY: 0,
    found: false,
    scans: 0,
    moving: false,
    feedback: '',
  };
  window.__pilot20 = { state, scan: scanSignal, moveStep: amount => { state.progress = Math.min(1, state.progress + amount); updateView(); } };

  const rand = seed => {
    let x = seed | 0;
    return () => {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  };
  const random = rand(20261107);
  const drops = Array.from({ length: 146 }, () => ({ x: random(), y: random(), speed: .35 + random() * .42, length: 7 + random() * 15, alpha: .08 + random() * .18 }));
  const rings = Array.from({ length: 31 }, () => ({ x: .08 + random() * .86, y: .66 + random() * .31, phase: random(), width: 1.7 + random() * 3.5 }));
  let width = 0, height = 0, dpr = 1;
  let viewX = 0, viewY = 0;
  let dragging = false, dragId = null, lastX = 0, lastY = 0;
  let toastUntil = 0;
  const keys = new Set();

  function resize() {
    const rect = scene.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    weather.width = Math.round(width * dpr);
    weather.height = Math.round(height * dpr);
    weather.style.width = `${width}px`;
    weather.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateView();
  }

  function showToast(message) {
    state.feedback = message;
    $('toast').textContent = message;
    $('toast').classList.add('is-visible');
    toastUntil = performance.now() + 1800;
  }

  function scanSignal() {
    if (state.found) return;
    if (state.progress < .58) {
      showToast('신호가 약합니다 · 수문 쪽으로 더 접근하세요');
      return;
    }
    state.found = true;
    state.scans++;
    $('pulse').classList.remove('is-active');
    void $('pulse').offsetWidth;
    $('pulse').classList.add('is-active');
    showToast('수문 신호 확인 · 수위 기록 확보');
    updateView();
  }

  function updateView() {
    const p = state.progress;
    const mobile = width < 700 && height > 480;
    const scale = 1.025 + p * .24;
    const x = -state.lookX * Math.min(width * .035, 25) - p * (mobile ? width * .012 : width * .01);
    const y = state.lookY * Math.min(height * .023, 16) + p * height * .008;
    art.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
    scene.style.setProperty('--look-near', `${(-state.lookX * 9).toFixed(1)}px`);
    scene.style.setProperty('--beam-x', `${(state.lookX * 11).toFixed(1)}px`);
    marker.style.transform = `translate(calc(-50% + ${(-state.lookX * 11).toFixed(1)}px),-50%) scale(${(1 + p * .14).toFixed(3)})`;
    marker.style.opacity = state.found ? '.32' : '1';
    $('distance').textContent = `${Math.max(12, Math.round(280 - p * 268))} M`;
    $('progressFill').style.width = `${Math.round(p * 100)}%`;
    $('statusText').textContent = state.found ? '신호 연결 완료' : '수문 신호 미확인';
    $('routeState').textContent = state.found ? 'SIGNAL FOUND' : p >= .58 ? 'WITHIN RANGE' : 'SIGNAL LOST';
    $('objectiveTitle').textContent = state.found ? '수위 기록 확보' : '수문 아래의 신호';
    $('objectiveText').textContent = state.found ? '수문 제어망이 다시 응답합니다.' : p >= .58 ? '사정권 도착 · 신호를 확인하세요.' : '젖은 보행로를 따라 수문에 접근하세요.';
    scanBtn.setAttribute('aria-label', state.found ? '신호 확인 완료' : '수문 신호 확인');
  }

  function drawWeather(time) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    for (const d of drops) {
      const yy = ((d.y + time * d.speed) % 1.12) * height - height * .06;
      const xx = d.x * width - (time * 16) % (width + 20);
      const wrappedX = ((xx % (width + 20)) + (width + 20)) % (width + 20);
      ctx.strokeStyle = `rgba(172,226,236,${d.alpha})`;
      ctx.beginPath(); ctx.moveTo(wrappedX, yy); ctx.lineTo(wrappedX - d.length * .19, yy + d.length); ctx.stroke();
    }
    ctx.lineWidth = .8;
    for (const r of rings) {
      const phase = (time * .48 + r.phase) % 1;
      const x = r.x * width;
      const y = r.y * height;
      const radius = (2 + phase * 12) * (height / 810);
      ctx.strokeStyle = `rgba(130,219,224,${(.15 * (1 - phase)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, radius * r.width), Math.max(.5, radius * .38), 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (state.found) {
      const glow = ctx.createRadialGradient(width * .62, height * .46, 0, width * .62, height * .46, width * .25);
      glow.addColorStop(0, 'rgba(83,239,226,.13)'); glow.addColorStop(1, 'rgba(83,239,226,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    }
  }

  function updateClock() {
    $('clock').textContent = `00:${String(Math.max(0, 10 - Math.floor(state.elapsed))).padStart(2, '0')}`;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    state.elapsed += dt;
    if (state.elapsed >= 10) {
      state.elapsed %= 10;
      state.loop++;
      state.progress = 0;
      state.found = false;
      updateView();
    }
    if (state.moving || keys.has('w') || keys.has('arrowup')) state.progress = Math.min(1, state.progress + dt * .30);
    if (keys.has('a') || keys.has('arrowleft')) state.lookX = Math.max(-1, state.lookX - dt * 1.4);
    if (keys.has('d') || keys.has('arrowright')) state.lookX = Math.min(1, state.lookX + dt * 1.4);
    if (!dragging && !keys.has('a') && !keys.has('d') && !keys.has('arrowleft') && !keys.has('arrowright')) state.lookX *= Math.pow(.66, dt);
    viewX += (state.lookX - viewX) * Math.min(1, dt * 5);
    viewY += (state.lookY - viewY) * Math.min(1, dt * 5);
    updateView();
    updateClock();
    drawWeather(now / 1000);
    if (now > toastUntil) $('toast').classList.remove('is-visible');
    requestAnimationFrame(frame);
  }

  scene.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    dragging = true; dragId = event.pointerId; lastX = event.clientX; lastY = event.clientY;
    scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragId) return;
    state.lookX = Math.max(-1, Math.min(1, state.lookX + (event.clientX - lastX) / Math.max(120, width * .25)));
    state.lookY = Math.max(-1, Math.min(1, state.lookY + (event.clientY - lastY) / Math.max(160, height * .35)));
    lastX = event.clientX; lastY = event.clientY;
  });
  const endDrag = event => { if (event.pointerId === dragId) { dragging = false; dragId = null; } };
  scene.addEventListener('pointerup', endDrag);
  scene.addEventListener('pointercancel', endDrag);
  moveBtn.addEventListener('pointerdown', event => { state.moving = true; moveBtn.classList.add('is-held'); moveBtn.setPointerCapture(event.pointerId); event.preventDefault(); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) moveBtn.addEventListener(type, () => { state.moving = false; moveBtn.classList.remove('is-held'); });
  moveBtn.addEventListener('click', () => { state.progress = Math.min(1, state.progress + .08); updateView(); });
  scanBtn.addEventListener('click', scanSignal);
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 'd', 'arrowup', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === 'e' || key === ' ') scanSignal();
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); state.moving = false; moveBtn.classList.remove('is-held'); });
  window.addEventListener('resize', resize);
  art.addEventListener('load', () => { state.sceneReady = art.naturalWidth > 0; });
  if (art.complete && art.naturalWidth > 0) state.sceneReady = true;
  resize();
  updateView();
  requestAnimationFrame(frame);
})();
