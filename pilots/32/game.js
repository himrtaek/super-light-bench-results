(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const countEl = document.getElementById('seedCount');
  const speechEl = document.getElementById('speech');
  const hintEl = document.getElementById('hintText');
  const shareButton = document.getElementById('shareButton');
  const WORLD = { width: 1536, height: 1024 };
  const rack = { x: 803, y: 644 };
  const prop = { x: 903, y: 632 };
  const basket = { x: 941, y: 591 };
  const path = [{x:607,y:825},{x:727,y:706},{x:803,y:644},{x:940,y:552},{x:1004,y:424}];
  const state = {
    sceneReady: false, x: 746, y: 716, targetX: 746, targetY: 716,
    walking: false, queuedShare: false, seeds: 3, seedsShared: 0,
    moveCount: 0, ritualCount: 0, lastInput: '', ritualPulse: 0, seedFlight: 0, sharing: false, actionHold: 0,
    clock: 0, renderedFrames: 0
  };
  let cssW = 1, cssH = 1, scale = 1, camX = 768, camY = 512;
  let lastFrame = 0, fixedTime = null, messageUntil = 0;
  const images = {};
  const fireflies = Array.from({length:31},(_,i)=>({
    x: 350 + ((i*311+73)%910), y:155+((i*197+37)%680),
    phase:i*1.91, size:1.5+(i%3)*.9
  }));

  function load(name, url) {
    return new Promise((resolve,reject)=>{
      const im = new Image();
      im.onload=()=>{images[name]=im;resolve();};
      im.onerror=()=>reject(new Error(`Could not load ${url}`));
      im.src=url;
    });
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.max(1,Math.round(cssW*dpr));
    canvas.height = Math.max(1,Math.round(cssH*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    scale = Math.max(cssW/WORLD.width, cssH/WORLD.height) * (cssW/cssH < .92 ? 1.06 : 1.18);
    camX = cssW/cssH < .92 ? 845 : 840;
    camY = cssW/cssH < .92 ? 565 : 560;
  }
  function toWorld(x,y) {
    return {x:(x-cssW/2)/scale+camX,y:(y-cssH/2)/scale+camY};
  }
  function closestPathPoint(p) {
    let best = path[0], bestDist = Infinity;
    for(let i=0;i<path.length-1;i++){
      const a=path[i],b=path[i+1],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      const q={x:a.x+t*dx,y:a.y+t*dy};
      const d=(p.x-q.x)**2+(p.y-q.y)**2;
      if(d<bestDist){best=q;bestDist=d;}
    }
    return best;
  }
  function speak(message, seconds=2.8) {
    speechEl.textContent=message;
    speechEl.classList.add('visible');
    messageUntil=performance.now()+seconds*1000;
  }
  function walkTo(p, input) {
    const q=closestPathPoint(p);
    state.targetX=q.x;state.targetY=q.y;
    state.walking=true;state.lastInput=input;state.moveCount++;
  }
  function share(input='button') {
    if(state.sharing || state.queuedShare)return;
    if(state.seeds<=0){speak('The basket is full. The bells will carry the rest.');return;}
    state.queuedShare=true;
    state.lastInput=input;
    walkTo(rack,input);
    speak('Carry a seed to the shared basket.');
  }
  function completeShare() {
    state.queuedShare=false;
    state.walking=false;
    state.sharing=true;
    state.seedFlight=.001;
    speak('Watch the seed follow the bell light.',2.3);
  }
  function landSeed() {
    state.sharing=false;
    state.seedFlight=0;
    state.seeds--;
    state.seedsShared++;
    state.ritualCount++;
    state.ritualPulse=1;
    state.actionHold=.6;
    countEl.textContent=String(state.seeds).padStart(2,'0');
    hintEl.textContent=state.seeds ? 'Another seed for the orchard?' : 'All seeds shared · stroll through the orchard';
    speak(state.seeds ? 'A dew bell rings for the next planting.' : 'The orchard keeps every kindness.',3.5);
  }
  function scenePointer(event) {
    if(state.sharing)return;
    const r=canvas.getBoundingClientRect();
    const p=toWorld(event.clientX-r.left,event.clientY-r.top);
    if(Math.hypot(p.x-prop.x,p.y-(prop.y-95))<145){share('scene');return;}
    state.queuedShare=false;
    walkTo(p,'scene');
    speak('Follow the clay path to the willow.',2);
  }
  function drawGlow(x,y,r,alpha,color='245,196,105') {
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(${color},${alpha})`);
    g.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  function drawCharacter(image,x,y,h,bob,flip) {
    const w=h*image.width/image.height;
    ctx.save();
    ctx.translate(x,y-4+bob);
    drawGlow(0,-h*.47,h*.58,.18,'254,230,181');
    ctx.fillStyle='rgba(23,32,35,.38)';
    ctx.beginPath();ctx.ellipse(0,0,w*.28,11,0,0,Math.PI*2);ctx.fill();
    ctx.scale(flip,1);
    // Four dark ink offsets preserve the character silhouette over luminous foliage.
    ctx.filter='brightness(0)';
    for(const [ox,oy] of [[-4,0],[4,0],[0,-4],[0,4]])
      ctx.drawImage(image,-w/2+ox,-h+oy,w,h);
    ctx.filter='none';
    ctx.shadowColor='rgba(255,210,117,.52)';ctx.shadowBlur=10;
    ctx.drawImage(image,-w/2,-h,w,h);
    ctx.restore();
  }
  function drawBellMagic(t) {
    const pulse=state.ritualPulse;
    if(state.sharing){
      const p=state.seedFlight;
      const sx=state.x+71,sy=state.y-164;
      const ex=basket.x,ey=basket.y-10;
      const cx=basket.x+20,cy=basket.y-246;
      const point=q=>({x:(1-q)*(1-q)*sx+2*(1-q)*q*cx+q*q*ex,y:(1-q)*(1-q)*sy+2*(1-q)*q*cy+q*q*ey});
      const tip=point(p);
      ctx.save();ctx.shadowColor='rgba(255,219,116,.85)';ctx.shadowBlur=15;
      ctx.strokeStyle='rgba(22,35,43,.72)';ctx.lineWidth=11;
      ctx.beginPath();ctx.moveTo(sx,sy);
      for(let i=1;i<=24;i++){const q=point(p*i/24);ctx.lineTo(q.x,q.y);}ctx.stroke();
      ctx.strokeStyle='rgba(255,235,149,.96)';ctx.lineWidth=5;ctx.stroke();ctx.restore();
      for(let i=1;i<=4;i++){const q=point(Math.max(0,p-i*.075));drawGlow(q.x,q.y,18-i*2,.63,'255,225,133');}
      drawGlow(tip.x,tip.y,40,.98,'255,220,118');
      ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(.7+p*5);
      ctx.fillStyle='#fff6b8';ctx.strokeStyle='#69472c';ctx.lineWidth=2.6;
      ctx.beginPath();ctx.ellipse(0,0,12,18,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e5aa4b';ctx.beginPath();ctx.ellipse(2,-2,4,8,.3,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(pulse<=0)return;
    const bloom=1-pulse;
    drawGlow(basket.x,basket.y-9,139,pulse*.67,'255,207,100');
    drawGlow(prop.x,prop.y-184,132,pulse*.43,'255,229,152');
    for(let j=0;j<2;j++){
      ctx.strokeStyle=j?'rgba(120,235,218,'+pulse*.85+')':'rgba(255,242,175,'+pulse*.95+')';
      ctx.lineWidth=j?3:5;
      ctx.beginPath();ctx.ellipse(basket.x,basket.y+3,30+j*12+bloom*(118+j*31),11+j*4+bloom*(37+j*12),0,0,Math.PI*2);ctx.stroke();
    }
    for(const bx of [prop.x-57,prop.x-2,prop.x+53]){
      for(let i=0;i<2;i++){
        const radius=19+i*14+bloom*26;
        ctx.strokeStyle=`rgba(255,238,165,${pulse*(.86-i*.2)})`;
        ctx.lineWidth=4-i;
        ctx.beginPath();ctx.arc(bx,prop.y-187,radius,-.72,.72);ctx.stroke();
        ctx.beginPath();ctx.arc(bx,prop.y-187,radius,Math.PI-.72,Math.PI+.72);ctx.stroke();
      }
    }
    for(let i=0;i<24;i++){
      const a=i*2.399+Math.sin(i*3)*.15;
      const rise=bloom*(67+(i%5)*18);
      const x=basket.x+Math.cos(a)*(20+bloom*112);
      const y=basket.y-17-rise+Math.sin(a)*15;
      const size=3+(i%3);
      ctx.fillStyle=`rgba(255,${184+i%4*13},95,${pulse})`;
      ctx.beginPath();ctx.ellipse(x,y,size,size*1.6,a,0,Math.PI*2);ctx.fill();
    }
  }
  function render() {
    if(!state.sceneReady)return;
    ctx.setTransform(canvas.width/cssW,0,0,canvas.height/cssH,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    ctx.save();
    ctx.translate(cssW/2-camX*scale,cssH/2-camY*scale);
    ctx.scale(scale,scale);
    ctx.drawImage(images.background,0,0,WORLD.width,WORLD.height);
    const t=state.clock;
    // Small moving points keep the illustrated environment alive without hiding its brushwork.
    for(const f of fireflies){
      const x=f.x+Math.sin(t*.7+f.phase)*9;
      const y=f.y+Math.cos(t*.9+f.phase)*6;
      const a=.18+.23*(.5+.5*Math.sin(t*2+f.phase));
      drawGlow(x,y,f.size*5,a*.48);
      ctx.fillStyle=`rgba(255,223,151,${a})`;
      ctx.beginPath();ctx.arc(x,y,f.size,0,Math.PI*2);ctx.fill();
    }
    // An authored cutout moves the focal object in front of the dense painting.
    const propH=245,propW=propH*images.rack.width/images.rack.height;
    drawGlow(prop.x,prop.y-87,156,.22,'255,214,145');
    ctx.fillStyle='rgba(20,35,34,.36)';
    ctx.beginPath();ctx.ellipse(prop.x,prop.y-6,propW*.4,18,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(images.rack,prop.x-propW/2,prop.y-propH,propW,propH);
    // The open basket has an unobtrusive in-world invitation while idle.
    const invitation=.36+.16*Math.sin(t*2.1);
    drawGlow(basket.x,basket.y,53,invitation,'245,188,96');
    ctx.strokeStyle=`rgba(255,222,151,${.37+.12*Math.sin(t*2.1)})`;
    ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(basket.x,basket.y+7,31,12,0,0,Math.PI*2);ctx.stroke();
    drawCharacter(images.keeper,992,582,165,Math.sin(t*1.75)*2,1);
    const walkingBob=state.walking?Math.sin(performance.now()*.025)*4:Math.sin(t*2.4)*1.8;
    if(state.sharing||state.actionHold>0)
      drawCharacter(images.toss,state.x,state.y,199,0,1);
    else drawCharacter(images.courier,state.x,state.y,178,walkingBob,state.targetX<state.x-8?-1:1);
    drawBellMagic(t);
    ctx.restore();
    state.renderedFrames++;
  }
  function tick(now) {
    const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
    state.clock=fixedTime==null?(now/1000)%10:fixedTime;
    if(state.walking){
      const dx=state.targetX-state.x,dy=state.targetY-state.y,d=Math.hypot(dx,dy);
      const step=305*dt;
      if(d<=step||d<2){state.x=state.targetX;state.y=state.targetY;state.walking=false;if(state.queuedShare)completeShare();}
      else {state.x+=dx/d*step;state.y+=dy/d*step;}
    }
    if(state.sharing){state.seedFlight=Math.min(1,state.seedFlight+dt/1.35);if(state.seedFlight>=1)landSeed();}
    if(state.ritualPulse>0)state.ritualPulse=Math.max(0,state.ritualPulse-dt/1.65);
    if(state.actionHold>0)state.actionHold=Math.max(0,state.actionHold-dt);
    if(messageUntil&&now>messageUntil){speechEl.classList.remove('visible');messageUntil=0;}
    render();requestAnimationFrame(tick);
  }
  canvas.addEventListener('pointerdown',scenePointer);
  shareButton.addEventListener('click',()=>share('button'));
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(key==='e'||key===' '){e.preventDefault();share('keyboard');return;}
    const delta={arrowup:[40,-40],w:[40,-40],arrowdown:[-40,40],s:[-40,40],arrowleft:[-50,15],a:[-50,15],arrowright:[50,-15],d:[50,-15]}[key];
    if(delta){e.preventDefault();if(state.sharing)return;state.queuedShare=false;walkTo({x:state.x+delta[0],y:state.y+delta[1]},'keyboard');}
  });
  window.addEventListener('resize',()=>{resize();render();});
  window.__pilot32={state,share,walkTo,setTime(t){fixedTime=((t%10)+10)%10;state.clock=fixedTime;render();},resumeTime(){fixedTime=null;}};
  Promise.all([
    load('background','assets/marsh-orchard-night.webp'),
    load('courier','assets/seed-courier.webp'),
    load('toss','assets/seed-courier-toss.webp'),
    load('keeper','assets/bell-keeper.webp'),
    load('rack','assets/community-rack.webp')
  ]).then(()=>{resize();state.sceneReady=true;render();lastFrame=performance.now();requestAnimationFrame(tick);})
    .catch(err=>{speechEl.textContent='The orchard could not be loaded.';console.error(err);});
})();
