(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = document.getElementById('stage');
  const ui = {
    ammo: document.getElementById('ammo'), reserve: document.getElementById('reserve'),
    status: document.getElementById('status'), targetCount: document.getElementById('targetCount'),
    progress: document.getElementById('progress'), alert: document.getElementById('hitAlert'),
    reload: document.getElementById('reloadText'), hint: document.getElementById('startHint')
  };
  const station = new Image(), rifle = new Image();
  station.src = 'assets/storm-station.webp';
  rifle.src = 'assets/carbine-hands.webp';
  let w = 0, h = 0, dpr = 1, last = 0, time = 0, gunKick = 0, flash = 0, impact = 0;
  let ammo = 24, reserve = 96, reloading = false, reloadAt = 0, ads = false, alertAt = 0;
  let shots = 0, hits = 0, disables = 0, audio = null;
  let aim = { x: 0, y: 0 }, hadInput = false;
  const particles = [], marks = [], shells = [];
  const targets = [
    { x: 866, y: 445, r: 34, hp: 3, name: 'A / TURRET', phase: 0, disabledUntil: 0 },
    { x: 698, y: 515, r: 29, hp: 3, name: 'B / SENSOR', phase: 2.4, disabledUntil: 0 },
    { x: 1015, y: 518, r: 30, hp: 3, name: 'C / SENSOR', phase: 4.7, disabledUntil: 0 }
  ];
  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    if (!hadInput) aim = { x: w * .515, y: h * .475 };
    else { aim.x = Math.min(w - 20, Math.max(20, aim.x)); aim.y = Math.min(h - 20, Math.max(20, aim.y)); }
  }
  window.addEventListener('resize', resize);
  resize();
  function geometry() {
    const scale = Math.max(w / 1672, h / 941) * 1.018;
    const lookX = (aim.x / w - .5) * Math.min(w * .027, 27);
    const lookY = (aim.y / h - .5) * Math.min(h * .014, 12);
    return { scale, ox: (w - 1672 * scale) / 2 - lookX, oy: (h - 941 * scale) / 2 - lookY };
  }
  function pos(t, g) {
    const drift = t.phase ? Math.sin(time * .9 + t.phase) * 7 : 0;
    return { x: g.ox + (t.x + drift) * g.scale, y: g.oy + (t.y + Math.sin(time * .7 + t.phase) * (t.phase ? 5 : 0)) * g.scale };
  }
  function setAlert(message) {
    ui.alert.textContent = message;
    ui.alert.classList.add('visible');
    alertAt = time + 1.12;
  }
  function updateHud() {
    ui.ammo.textContent = String(ammo).padStart(2, '0');
    ui.reserve.textContent = reserve;
    ui.status.textContent = hits >= 9 ? 'RANGE CLEAR' : hits ? 'CONFIRMED' : 'ACTIVE';
    ui.targetCount.textContent = hits ? `${String(hits).padStart(2, '0')} HITS · ${disables} DOWN` : '03 CONTACTS';
    ui.progress.style.width = `${Math.min(100, hits / 9 * 100)}%`;
    ui.reload.textContent = reloading ? 'RELOADING…' : ammo === 0 ? 'PRESS R TO RELOAD' : '5.56 MM · SEMI-AUTO';
  }
  function sound(kind) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = kind === 'hit' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(kind === 'hit' ? 620 : 115, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 250 : 45, audio.currentTime + (kind === 'hit' ? .12 : .19));
      gain.gain.setValueAtTime(kind === 'hit' ? .045 : .11, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + (kind === 'hit' ? .14 : .21));
      osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .22);
    } catch (_) { /* Audio is optional when the browser blocks it. */ }
  }
  function burst(x, y, type, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = (type === 'hit' ? 80 : 40) + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 45, age: 0,
        life: .24 + Math.random() * .42, size: type === 'hit' ? 1 + Math.random() * 3 : 1 + Math.random() * 2,
        color: type === 'hit' ? (i % 4 ? '#ffb666' : '#eff9fc') : '#b7c4bd' });
    }
  }
  function beginReload() {
    if (reloading || ammo === 24 || reserve <= 0) return;
    reloading = true; reloadAt = time + 1.15; setAlert('RELOADING'); updateHud();
  }
  function fire() {
    if (reloading) return;
    if (ammo <= 0) { beginReload(); return; }
    hadInput = true; ui.hint.classList.add('hidden');
    ammo--; shots++; gunKick = Math.min(1.45, gunKick + 1); flash = .115;
    const g = geometry();
    let hit = null;
    for (const target of targets) {
      if (target.hp <= 0) continue;
      const p = pos(target, g);
      if (Math.hypot(aim.x - p.x, aim.y - p.y) < Math.max(28, target.r * g.scale * 1.5)) { hit = { target, p }; break; }
    }
    const impactPoint = hit ? hit.p : { x: aim.x, y: aim.y };
    impact = .15;
    marks.push({ x: impactPoint.x, y: impactPoint.y, age: 0, hit: !!hit });
    burst(impactPoint.x, impactPoint.y, hit ? 'hit' : 'miss', hit ? 20 : 10);
    shells.push({ x: w * .71, y: h * .7, vx: 130 + Math.random() * 80, vy: -230 - Math.random() * 70, rot: Math.random() * 3, age: 0 });
    if (hit) {
      hit.target.hp--; hits++; sound('hit');
      if (hit.target.hp === 0) {
        disables++; hit.target.disabledUntil = time + 4.3;
        burst(hit.p.x, hit.p.y, 'hit', 34);
        setAlert(`${hit.target.name}  /  DISABLED`);
      } else setAlert('HIT CONFIRMED  +1');
    }
    sound('shot'); updateHud();
    if (ammo === 0 && reserve) setTimeout(beginReload, 500);
  }
  function moveAim(x, y) {
    aim.x = Math.max(15, Math.min(w - 15, x));
    aim.y = Math.max(80, Math.min(h - 30, y));
    hadInput = true;
  }
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) moveAim(e.clientX, e.clientY); });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.button === 2) { ads = true; return; }
    moveAim(e.clientX, e.clientY); fire();
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('pointerup', e => { if (e.button === 2) ads = false; });
  window.addEventListener('keydown', e => {
    const step = e.shiftKey ? 6 : 18;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','r','R','Shift'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveAim(aim.x - step, aim.y);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveAim(aim.x + step, aim.y);
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') moveAim(aim.x, aim.y - step);
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') moveAim(aim.x, aim.y + step);
    if (e.key === ' ' && !e.repeat) fire();
    if (e.key.toLowerCase() === 'r') beginReload();
    if (e.key === 'Shift') ads = true;
  });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') ads = false; });
  document.getElementById('fireBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fire(); });
  document.getElementById('adsBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); ads = true; });
  document.getElementById('adsBtn').addEventListener('pointerup', () => { ads = false; });
  document.getElementById('adsBtn').addEventListener('pointercancel', () => { ads = false; });
  document.getElementById('reloadBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); beginReload(); });

  function drawTarget(t, g) {
    const p = pos(t, g), r = t.r * g.scale, alive = t.hp > 0;
    ctx.save(); ctx.translate(p.x, p.y);
    const pulse = .5 + .5 * Math.sin(time * 3.3 + t.phase);
    if (alive) {
      const glow = ctx.createRadialGradient(0,0,0,0,0,r*2.3);
      glow.addColorStop(0,`rgba(255,72,39,${.17 + pulse*.1})`); glow.addColorStop(1,'rgba(255,72,39,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,r*2.3,0,7); ctx.fill();
      ctx.fillStyle='#1c2527'; ctx.strokeStyle='#6c7774'; ctx.lineWidth=Math.max(1,2*g.scale);
      ctx.beginPath(); ctx.moveTo(-r*.9,-r*.25); ctx.lineTo(-r*.62,-r*.65); ctx.lineTo(r*.62,-r*.65); ctx.lineTo(r*.9,-r*.24); ctx.lineTo(r*.78,r*.39); ctx.lineTo(-r*.78,r*.39); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#66706b'; ctx.fillRect(-r*.75,-r*.46,r*1.5,r*.14);
      ctx.fillStyle='#10181b'; ctx.fillRect(-r*.53,-r*.2,r*1.06,r*.48);
      ctx.fillStyle='#cc4832'; ctx.shadowColor='#ff613b'; ctx.shadowBlur=12+8*pulse;
      ctx.beginPath(); ctx.ellipse(0,0,r*.37,r*.26,0,0,7); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#ffc18d'; ctx.fillRect(-r*.12,-r*.055,r*.24,r*.085);
      ctx.strokeStyle='rgba(246,185,123,.83)'; ctx.lineWidth=1.2;
      for (const side of [-1,1]) { ctx.beginPath(); ctx.moveTo(side*r*.69,-r*.84); ctx.lineTo(side*r*.97,-r*.84); ctx.lineTo(side*r*.97,-r*.51); ctx.stroke(); }
      ctx.fillStyle='rgba(9,18,22,.7)'; ctx.fillRect(-r*1.1,-r*1.38,r*2.2,3);
      ctx.fillStyle='#efac6d'; ctx.fillRect(-r*1.1,-r*1.38,r*2.2*t.hp/3,3);
      ctx.fillStyle='#e3eced'; ctx.font=`600 ${Math.max(8,10*g.scale)}px monospace`; ctx.textAlign='center';
      ctx.fillText(t.name,0,-r*1.62);
    } else {
      ctx.fillStyle='rgba(23,28,29,.72)'; ctx.beginPath(); ctx.ellipse(0,r*.22,r*.85,r*.35,0,0,7); ctx.fill();
      ctx.strokeStyle='rgba(237,161,93,.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,r*.6,0,7); ctx.stroke();
      ctx.fillStyle='#dfad77'; ctx.font=`600 ${Math.max(8,10*g.scale)}px monospace`; ctx.textAlign='center'; ctx.fillText('OFFLINE',0,-r);
    }
    ctx.restore();
  }
  function drawEffects(dt) {
    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=250*dt; p.vx*=.98;
      if(p.age>=p.life){particles.splice(i,1);continue;}
      ctx.globalAlpha=1-p.age/p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size*2.2);
    }
    ctx.globalAlpha=1;
    for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=480*dt;s.rot+=dt*17;if(s.age>1){shells.splice(i,1);continue;}
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);ctx.fillStyle='#d5a45c';ctx.fillRect(-6,-2,12,4);ctx.fillStyle='#f7d392';ctx.fillRect(-6,-2,12,1);ctx.restore();}
    for(let i=marks.length-1;i>=0;i--){const m=marks[i];m.age+=dt;if(m.age>.6){marks.splice(i,1);continue;}
      ctx.save();ctx.translate(m.x,m.y);ctx.globalAlpha=1-m.age/.6;ctx.strokeStyle=m.hit?'#ffe1b0':'#bdc9c5';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,5+m.age*42,0,7);ctx.stroke();
      if(m.hit){ctx.strokeStyle='#fff';for(const a of [-1,1])for(const b of [-1,1]){ctx.beginPath();ctx.moveTo(a*7,b*7);ctx.lineTo(a*13,b*13);ctx.stroke();}}
      ctx.restore();}
  }
  function drawWeapon(g) {
    if(!rifle.complete||!rifle.naturalWidth)return;
    const s=Math.max(w/1672,h/941), adsScale=ads?1.12:1;
    const iw=1672*s*adsScale, ih=941*s*adsScale;
    const recoilY=gunKick*27, recoilX=gunKick*8;
    const left=w*.49-iw*.48+(aim.x-w*.5)*.035+recoilX;
    const top=h*.105-(ads?h*.19:0)-recoilY;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=10;ctx.drawImage(rifle,left,top,iw,ih);ctx.restore();
    // The generated isolated sight has an opaque white pane. Reopen only its inner glass
    // against the live scene so it reads as a functioning optic during aim and recoil.
    if(station.complete&&station.naturalWidth){
      const glassX=left+iw*1065/1672, glassY=top+ih*351/941;
      const glassW=iw*88/1672, glassH=ih*65/941;
      ctx.save();ctx.beginPath();ctx.roundRect(glassX,glassY,glassW,glassH,Math.max(4,7*s));ctx.clip();
      ctx.drawImage(station,g.ox,g.oy,1672*g.scale,941*g.scale);
      ctx.fillStyle='rgba(41,65,68,.28)';ctx.fillRect(glassX,glassY,glassW,glassH);
      ctx.restore();
      ctx.fillStyle='rgba(249,95,64,.92)';ctx.shadowColor='#ff6245';ctx.shadowBlur=6;
      ctx.beginPath();ctx.arc(glassX+glassW*.5,glassY+glassH*.53,Math.max(1,1.5*s),0,7);ctx.fill();ctx.shadowBlur=0;
    }
    if(flash>0){
      const mx=left+iw*.475, my=top+ih*.48;
      const a=Math.min(1,flash/.105), radius=Math.min(w,h)*.105*a;
      const glow=ctx.createRadialGradient(mx,my,0,mx,my,radius*2.2);glow.addColorStop(0,`rgba(255,246,200,${.85*a})`);glow.addColorStop(.25,`rgba(255,161,74,${.5*a})`);glow.addColorStop(1,'rgba(255,145,63,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(mx,my,radius*2.2,0,7);ctx.fill();
      ctx.save();ctx.translate(mx,my);ctx.rotate(-.22);ctx.fillStyle=`rgba(255,237,180,${a})`;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-radius*.45,-radius*.2);ctx.lineTo(-radius*.1,-radius*.1);ctx.lineTo(-radius*.58,-radius*.62);ctx.lineTo(radius*.07,-radius*.21);ctx.lineTo(radius*.36,-radius*.5);ctx.lineTo(radius*.18,0);ctx.lineTo(radius*.6,radius*.16);ctx.lineTo(0,radius*.13);ctx.closePath();ctx.fill();ctx.restore();
      ctx.strokeStyle=`rgba(255,209,134,${a*.7})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(aim.x,aim.y);ctx.stroke();
    }
  }
  function drawReticle() {
    const x=aim.x,y=aim.y,spread=ads?6:10+gunKick*11;
    ctx.save();ctx.translate(x,y);ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.strokeStyle='rgba(244,250,246,.9)';ctx.lineWidth=1.35;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a)*spread,Math.sin(a)*spread);ctx.lineTo(Math.cos(a)*(spread+8),Math.sin(a)*(spread+8));ctx.stroke();}
    ctx.fillStyle='#f6d5a1';ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  function drawRain() {
    ctx.save();ctx.strokeStyle='rgba(203,222,226,.13)';ctx.lineWidth=.8;
    for(let i=0;i<70;i++){
      const x=((i*137.57+time*280)%(w+80))-40, y=((i*89.13+time*(180+i%5*35))%(h+80))-40;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+17+(i%5)*3);ctx.stroke();
    }
    ctx.restore();
  }
  function frame(ms) {
    const dt=Math.min(.04,(ms-last)/1000||.016);last=ms;time+=dt;
    if(reloading&&time>=reloadAt){const n=Math.min(24-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHud();}
    for(const t of targets)if(t.hp===0&&time>t.disabledUntil)t.hp=3;
    gunKick=Math.max(0,gunKick-dt*5.6);flash=Math.max(0,flash-dt);impact=Math.max(0,impact-dt);
    if(time>alertAt)ui.alert.classList.remove('visible');
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const g=geometry();
    if(station.complete&&station.naturalWidth)ctx.drawImage(station,g.ox,g.oy,1672*g.scale,941*g.scale);
    else{const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#344956');grad.addColorStop(1,'#111a1e');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);}
    for(const t of targets)drawTarget(t,g);
    drawRain();drawEffects(dt);drawWeapon(g);drawReticle();
    const vignette=ctx.createRadialGradient(w*.5,h*.5,h*.2,w*.5,h*.5,Math.max(w,h)*.7);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,8,12,.43)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    requestAnimationFrame(frame);
  }
  updateHud();requestAnimationFrame(frame);
  window.__pilot15={get state(){return {shots,hits,disables,ammo,reserve,reloading,sceneReady:station.complete&&station.naturalWidth>0&&rifle.complete&&rifle.naturalWidth>0,targets:targets.map(t=>({name:t.name,hp:t.hp}))};}, aimAt:(x,y)=>moveAim(x,y),fire, reload:beginReload};
})();
