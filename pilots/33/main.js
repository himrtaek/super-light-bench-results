(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const shade = document.createElement('canvas');
  const shadeCtx = shade.getContext('2d');
  const art = new Image();
  art.src = 'assets/sluice-corridor.webp';
  const ui = {
    lamp: document.getElementById('lamp'), reticle: document.getElementById('reticle'),
    hint: document.getElementById('hint'), objective: document.getElementById('objective'),
    detail: document.getElementById('detail'), track: document.getElementById('track'),
    time: document.getElementById('time'), toast: document.getElementById('toast'),
    step: document.getElementById('stepBtn'), use: document.getElementById('useBtn'),
    light: document.getElementById('lightBtn')
  };
  const params = new URLSearchParams(location.search);
  const capture = params.get('capture') === '1';
  const fixedTime = Math.max(0, Math.min(9.99, Number(params.get('t')) || 0));
  const state = {
    sceneReady: false, capture, t: capture ? fixedTime : 0,
    cycle: 0, pan: 0, step: 0, aimX: .58, aimY: .43,
    lightOn: true, opened: params.get('opened') === '1', interactions: 0,
    valveInBeam: false, width: 0, height: 0
  };
  const held = new Set();
  const VALVE = { x: 1074 / 1672, y: 452 / 941 };
  const DOOR = { x: 883 / 1672, y: 445 / 941 };
  let layout = null, toastTimer = 0, lastFrame = performance.now(), pointerDown = false, lastPointerX = 0;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    shade.width = canvas.width; shade.height = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shadeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = w; state.height = h;
    render();
  }
  function imageLayout() {
    const w = state.width, h = state.height;
    const scale = Math.max(w / art.width, h / art.height) * (1 + .11 * state.step);
    const iw = art.width * scale, ih = art.height * scale;
    return { x: (w - iw) / 2 + state.pan * w * .72, y: (h - ih) / 2 + state.step * h * .015, w: iw, h: ih };
  }
  function project(point) {
    const l = layout || imageLayout();
    return { x: l.x + l.w * point.x, y: l.y + l.h * point.y };
  }
  function aimedAtValve() {
    if (!layout || !state.lightOn || state.opened) return false;
    const p = project(VALVE), x = state.aimX * state.width, y = state.aimY * state.height;
    const range = clamp(state.width * .073, 35, 85);
    return Math.hypot(p.x - x, p.y - y) < range;
  }
  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1500);
  }
  function useValve() {
    if (state.opened) { toast('격벽은 이미 열렸습니다.'); return; }
    if (!state.lightOn) { toast('손전등을 켜세요.'); return; }
    if (!aimedAtValve()) { toast('밸브를 손전등으로 비추세요.'); return; }
    state.opened = true;
    state.interactions++;
    toast('압력 해제 · 격벽 개방');
    updateUI();
  }
  function updateUI() {
    const locked = aimedAtValve();
    state.valveInBeam = locked;
    ui.reticle.classList.toggle('lock', locked);
    ui.reticle.style.left = `${state.aimX * 100}%`;
    ui.reticle.style.top = `${state.aimY * 100}%`;
    ui.hint.textContent = state.opened ? '수로 개방' : locked ? 'E / 점검' : '';
    ui.objective.textContent = state.opened ? '격벽이 열렸습니다' : '손전등으로 압력 밸브를 찾으세요';
    ui.detail.textContent = state.opened ? '다음 구역으로 이어지는 통로가 확보되었습니다.' : '시점을 돌려 밸브를 비춘 뒤 점검하세요.';
    ui.track.style.width = state.opened ? '100%' : locked ? '54%' : '0%';
    ui.time.textContent = `00:${String(Math.max(0, 10 - Math.floor(state.t))).padStart(2, '0')}`;
    document.getElementById('game').classList.toggle('light-off', !state.lightOn);
    ui.light.setAttribute('aria-label', state.lightOn ? '손전등 끄기' : '손전등 켜기');
  }
  function drawDoor() {
    if (!state.opened) return;
    const p = project(DOOR), s = layout.w / art.width;
    const opening = Math.min(1, Math.max(.45, (state.t % 10) * .35));
    const gap = clamp(18 * s + opening * 36 * s, 10, 64);
    const top = p.y - 129 * s, bottom = p.y + 120 * s;
    ctx.save();
    const g = ctx.createLinearGradient(p.x - gap, 0, p.x + gap, 0);
    g.addColorStop(0, '#203d35'); g.addColorStop(.2, '#041313'); g.addColorStop(.5, '#071a1c'); g.addColorStop(.8, '#041313'); g.addColorStop(1, '#6eaa8d');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(p.x - gap*.35, top); ctx.lineTo(p.x + gap*.3, top);
    ctx.lineTo(p.x + gap, bottom); ctx.lineTo(p.x - gap, bottom); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#9adbb7'; ctx.shadowBlur = 17; ctx.strokeStyle = '#9bd9aa88'; ctx.lineWidth = 2;
    ctx.stroke(); ctx.restore();
  }
  function drawSteam() {
    const w = state.width, h = state.height, t = state.t;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const phase = ((i * .37 + t * .13) % 1), x = w * (.33 + i * .011) + Math.sin(t * .63 + i) * w * .013;
      const y = h * (.30 - phase * .2); ctx.strokeStyle = `rgba(159,185,174,${(.08 * (1-phase)).toFixed(3)})`;
      ctx.lineWidth = 2 + i % 3; ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+12,y-17,x+5,y-35); ctx.stroke();
    }
    ctx.restore();
  }
  function revealAmbient(point, width, height, strength) {
    const p = project(point), scale = layout.w / art.width;
    shadeCtx.save();
    shadeCtx.translate(p.x, p.y);
    shadeCtx.scale(width * scale, height * scale);
    const glow = shadeCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, `rgba(0,0,0,${strength})`);
    glow.addColorStop(.42, `rgba(0,0,0,${strength * .66})`);
    glow.addColorStop(.76, `rgba(0,0,0,${strength * .18})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    shadeCtx.fillStyle = glow;
    shadeCtx.fillRect(-1, -1, 2, 2);
    shadeCtx.restore();
  }
  function drawBeam(x, y) {
    const w = state.width, h = state.height, radius = clamp(Math.min(w,h)*.39, 150, 390);
    const fromX = w*.80, fromY = h*.91;
    ctx.save();
    const cone = ctx.createLinearGradient(fromX, fromY, x, y);
    cone.addColorStop(0, 'rgba(230,230,204,.12)'); cone.addColorStop(1, 'rgba(237,226,191,.014)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(fromX,fromY);
    ctx.lineTo(x-radius*.74,y-radius*.71); ctx.quadraticCurveTo(x,y-radius*.97,x+radius*.69,y-radius*.65);
    ctx.closePath(); ctx.fill();
    shadeCtx.setTransform(shade.width/w,0,0,shade.height/h,0,0);
    shadeCtx.clearRect(0,0,w,h); shadeCtx.globalCompositeOperation = 'source-over';
    shadeCtx.fillStyle = 'rgba(1,4,6,.87)'; shadeCtx.fillRect(0,0,w,h);
    shadeCtx.globalCompositeOperation = 'destination-out';
    const hole = shadeCtx.createRadialGradient(x,y,0,x,y,radius);
    hole.addColorStop(0,'rgba(0,0,0,1)'); hole.addColorStop(.27,'rgba(0,0,0,.98)');
    hole.addColorStop(.47,'rgba(0,0,0,.91)'); hole.addColorStop(.67,'rgba(0,0,0,.39)');
    hole.addColorStop(.88,'rgba(0,0,0,.05)'); hole.addColorStop(1,'rgba(0,0,0,0)');
    shadeCtx.fillStyle = hole; shadeCtx.fillRect(x-radius,y-radius,radius*2,radius*2);
    // Local bounce from the inspection lamp reveals the walkable route without lifting the whole frame.
    revealAmbient({x: 1290 / 1672, y: 417 / 941}, 425, 365, .59); // right wall and conduit
    revealAmbient({x: 1330 / 1672, y: 675 / 941}, 460, 290, .49); // guardrail and wet edge
    revealAmbient({x: 615 / 1672, y: 469 / 941}, 330, 295, .43); // left-hand continuation
    revealAmbient({x: 455 / 1672, y: 180 / 941}, 425, 220, .30); // overhead pipe silhouette
    shadeCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(shade,0,0,w,h);
    const hot = ctx.createRadialGradient(x,y,0,x,y,radius*.78);
    hot.addColorStop(0,'rgba(255,231,185,.79)');
    hot.addColorStop(.22,'rgba(255,224,174,.67)');
    hot.addColorStop(.46,'rgba(250,207,151,.39)');
    hot.addColorStop(.72,'rgba(230,185,133,.055)');
    hot.addColorStop(1,'rgba(230,185,133,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hot; ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    ctx.restore();
  }
  function render() {
    if (!state.width || !state.height || !art.complete || !art.naturalWidth) return;
    const w = state.width, h = state.height;
    ctx.clearRect(0,0,w,h); layout = imageLayout();
    ctx.save(); ctx.filter = 'contrast(1.12) saturate(.88)';
    ctx.drawImage(art, layout.x, layout.y, layout.w, layout.h); ctx.restore();
    drawDoor(); drawSteam();
    if (state.lightOn) drawBeam(w*state.aimX,h*state.aimY);
    else { ctx.fillStyle='rgba(0,2,4,.89)'; ctx.fillRect(0,0,w,h); }
    const vignette = ctx.createRadialGradient(w*.5,h*.51,h*.14,w*.5,h*.51,Math.max(w,h)*.7);
    vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(1,'rgba(0,0,0,.83)');
    ctx.fillStyle=vignette; ctx.fillRect(0,0,w,h);
    updateUI(); state.sceneReady = true;
  }
  function tick(now) {
    const dt = Math.min(.05,(now-lastFrame)/1000); lastFrame=now;
    if (!capture) {
      state.t += dt;
      if (state.t >= 10) { state.t %= 10; state.cycle++; state.opened=false; state.step=0; }
      if (held.has('w') || held.has('arrowup')) state.step=clamp(state.step + dt*.43,0,1);
      if (held.has('a') || held.has('arrowleft')) state.pan=clamp(state.pan + dt*.56,-.55,.55);
      if (held.has('d') || held.has('arrowright')) state.pan=clamp(state.pan - dt*.56,-.55,.55);
    }
    render(); requestAnimationFrame(tick);
  }
  function pointer(e) {
    const r=canvas.getBoundingClientRect();
    state.aimX=clamp((e.clientX-r.left)/r.width,.03,.97);
    state.aimY=clamp((e.clientY-r.top)/r.height,.06,.9);
    if (pointerDown) state.pan=clamp(state.pan + (e.clientX-lastPointerX)/r.width*.55,-.55,.55);
    lastPointerX=e.clientX;
  }
  canvas.addEventListener('pointerdown',e=>{pointer(e);pointerDown=true;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',pointer);
  canvas.addEventListener('pointerup',()=>{pointerDown=false;});
  canvas.addEventListener('pointercancel',()=>{pointerDown=false;});
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if (['w','a','d','arrowup','arrowleft','arrowright','e','f',' '].includes(key)) e.preventDefault();
    held.add(key);
    if (!e.repeat && (key==='e' || key===' ')) useValve();
    if (!e.repeat && key==='f') { state.lightOn=!state.lightOn; updateUI(); }
  });
  document.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
  ui.step.addEventListener('pointerdown',()=>held.add('w'));
  for (const ev of ['pointerup','pointercancel','pointerleave']) ui.step.addEventListener(ev,()=>held.delete('w'));
  ui.step.addEventListener('click',()=>{state.step=clamp(state.step+.19,0,1);});
  ui.use.addEventListener('click',useValve);
  ui.light.addEventListener('click',()=>{state.lightOn=!state.lightOn;updateUI();});
  window.addEventListener('blur',()=>held.clear());
  window.addEventListener('resize',resize);
  window.__pilot33={state, project:()=>({valve:project(VALVE),door:project(DOOR)}), useValve};
  art.decode().then(()=>{resize();requestAnimationFrame(tick);}).catch(()=>{ui.objective.textContent='장면을 불러올 수 없습니다';});
})();
