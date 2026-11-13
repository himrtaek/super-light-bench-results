(() => {
  'use strict';
  const canvas = document.querySelector('#scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = 960, H = 540, FLOOR = 411, TAU = Math.PI * 2;
  const img = {}, art = { frames: {}, mutedDesktop: null, mutedPortrait: null };
  const files = { bg: 'assets/stormworks.webp', foxA: 'assets/fox-keys-a.webp', foxB: 'assets/fox-keys-b.webp', boss: 'assets/galesmith-keys.webp' };
  const ready = Promise.all(Object.entries(files).map(([name, src]) => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { img[name] = image; resolve(); }; image.onerror = () => reject(Error('image failed: ' + src)); image.src = src;
  })));
  const rnd = n => { const x = Math.sin(n * 128.41 + 71.73) * 43758.5453; return x - Math.floor(x); };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const ease = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
  const hero = { x: 260, y: FLOOR, vx: 0, vy: 0, hp: 4, facing: 1, grounded: true, hurt: 0, fire: 0, fireCooldown: 0, stride: 0, braking: 0 };
  const boss = { x: 745, hp: 16, phase: 'idle', phaseTime: 0, flash: 0, hitFx: 0, attackCount: 0 };
  const held = { left: false, right: false, attack: false };
  const shots = [], gusts = [], sparks = [], flecks = [];
  let t = 0, last = 0, cycle = 0, impact = 0, win = false, loaded = false, error = null, portraitMode = false;
  for(let i=0;i<58;i++) flecks.push({x:rnd(i*4)*W,y:rnd(i*4+1)*385,r:0.4+rnd(i*4+2)*1.6,p:rnd(i*4+3)*TAU});
  ready.then(() => { buildArt(); loaded = true; }).catch(e => { error = String(e); });
  function buildArt() {
    function muted(w,h,draw,centers) {
      const c=document.createElement('canvas');c.width=w;c.height=h;const q=c.getContext('2d');
      q.filter='blur(5px) brightness(.72) saturate(.84)';draw(q);q.filter='none';
      const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d');
      for(const [x,y,r] of centers){const g=m.createRadialGradient(x,y,25,x,y,r);g.addColorStop(0,'rgba(255,255,255,.64)');g.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=g;m.fillRect(x-r,y-r,r*2,r*2);}
      q.globalCompositeOperation='destination-in';q.drawImage(mask,0,0);q.globalCompositeOperation='source-over';return c;
    }
    art.mutedDesktop=muted(960,540,q=>q.drawImage(img.bg,0,0,960,540),[[265,300,235],[745,290,260]]);
    art.mutedPortrait=muted(520,780,q=>{const crop=img.bg.height*520/840;q.drawImage(img.bg,(img.bg.width-crop)/2,0,crop,img.bg.height,0,0,520,840);},[[145,465,195],[375,455,220]]);
    for(const name of ['foxA','foxB','boss']) {
      const im=img[name],cw=im.width/2,ch=im.height/2;art.frames[name]=[];
      for(let n=0;n<4;n++){
        const sx=(n%2)*cw,sy=Math.floor(n/2)*ch;
        const target=document.createElement('canvas');target.width=cw;target.height=ch;const out=target.getContext('2d');
        for(const [radius,color] of [[5,'rgba(224,190,137,.56)'],[2,'rgba(7,22,27,.86)']]){
          const layer=document.createElement('canvas');layer.width=cw;layer.height=ch;const lc=layer.getContext('2d');
          for(let j=0;j<20;j++){const a=j*Math.PI*2/20;lc.drawImage(im,sx,sy,cw,ch,Math.cos(a)*radius,Math.sin(a)*radius,cw,ch);}
          lc.globalCompositeOperation='source-in';lc.fillStyle=color;lc.fillRect(0,0,cw,ch);out.drawImage(layer,0,0);
        }
        out.drawImage(im,sx,sy,cw,ch,0,0,cw,ch);art.frames[name].push(target);
      }
    }
  }
  function reset() {
    Object.assign(hero,{x:260,y:FLOOR,vx:0,vy:0,hp:4,facing:1,grounded:true,hurt:0,fire:0,fireCooldown:0,stride:0,braking:0});
    Object.assign(boss,{x:745,hp:16,phase:'idle',phaseTime:0,flash:0,hitFx:0,attackCount:0});
    shots.length=0;gusts.length=0;sparks.length=0;t=0;impact=0;win=false;cycle++;
  }
  function puff(x,y,type,n=12) {
    for(let i=0;i<n;i++) {const a=TAU*(i+rnd(i+t*27)) / n, speed=45+rnd(i*7+t*47)*180;
      sparks.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(type==='steam'?40:0),age:0,life:.35+rnd(i*11+t)*.38,r:2+rnd(i*5)*5,type,rot:rnd(i*19+t)*TAU}); }
  }
  function jump() { if(!hero.grounded || hero.hp<=0)return; hero.vy=-560;hero.grounded=false;puff(hero.x,FLOOR-3,'dust',9); }
  function fire() {
    if(hero.fireCooldown>0 || hero.hp<=0 || win)return;
    hero.fireCooldown=.19;hero.fire=.22;hero.vx-=hero.facing*32;
    shots.push({x:hero.x+hero.facing*72,y:hero.y-104,vx:hero.facing*730,age:0});
    puff(hero.x+hero.facing*77,hero.y-104,'muzzle',7);
  }
  function hurtHero() {
    if(hero.hurt>0 || hero.hp<=0)return;
    hero.hp--;hero.hurt=1.1;hero.vx=-150;hero.vy=-150;hero.grounded=false;impact=.22;puff(hero.x,hero.y-95,'impact',18);
  }
  function bossHit() {
    if(boss.hp<=0)return;
    boss.hp--;boss.flash=.17;boss.hitFx=.31;impact=.13;puff(boss.x-90,FLOOR-170,'impact',14);
    if(boss.hp<=0){boss.phase='defeated';boss.phaseTime=0;win=true;puff(boss.x,FLOOR-155,'brass',35);}
    else if(boss.phase!=='blast'){boss.phase='hurt';boss.phaseTime=0;}
  }
  function update(dt) {
    if(!loaded)return;
    t+=dt;if(t>=10){reset();return;}
    hero.hurt=Math.max(0,hero.hurt-dt);hero.fire=Math.max(0,hero.fire-dt);hero.fireCooldown=Math.max(0,hero.fireCooldown-dt);hero.braking=Math.max(0,hero.braking-dt);boss.flash=Math.max(0,boss.flash-dt);boss.hitFx=Math.max(0,boss.hitFx-dt);impact=Math.max(0,impact-dt);
    const dir=Number(held.right)-Number(held.left);
    if(dir){if(dir!==hero.facing&&Math.abs(hero.vx)>60)hero.braking=.15;hero.facing=dir;hero.vx+=(dir*255-hero.vx)*Math.min(1,dt*12);hero.stride+=dt*11;}
    else {hero.vx*=Math.max(0,1-dt*(hero.grounded?9:2.4));}
    if(held.attack)fire();
    hero.x=clamp(hero.x+hero.vx*dt,105,880);
    hero.vy+=1240*dt;hero.y+=hero.vy*dt;
    if(hero.y>=FLOOR){if(!hero.grounded&&hero.vy>160)puff(hero.x,FLOOR-3,'dust',8);hero.y=FLOOR;hero.vy=0;hero.grounded=true;}
    if(hero.hp<=0){if(t>8.8)reset();}
    boss.phaseTime+=dt;
    if(!win){
      if(boss.phase==='idle'&&boss.phaseTime>1.35){boss.phase='windup';boss.phaseTime=0;}
      else if(boss.phase==='windup'&&boss.phaseTime>.68){boss.phase='blast';boss.phaseTime=0;boss.attackCount++;gusts.push({x:boss.x-168,y:FLOOR-88,vx:-385,age:0,scale:1});gusts.push({x:boss.x-180,y:FLOOR-192,vx:-325,age:0,scale:.7});puff(boss.x-190,FLOOR-155,'steam',22);impact=.12;}
      else if(boss.phase==='blast'&&boss.phaseTime>.49){boss.phase='idle';boss.phaseTime=0;}
      else if(boss.phase==='hurt'&&boss.phaseTime>.27){boss.phase='idle';boss.phaseTime=.38;}
    }
    for(let i=shots.length-1;i>=0;i--){const b=shots[i];b.age+=dt;b.x+=b.vx*dt;if(b.x>boss.x-113&&b.x<boss.x+80&&Math.abs(b.y-(FLOOR-163))<100&&boss.hp>0){bossHit();shots.splice(i,1);}else if(b.age>1.45||b.x>1000||b.x<0)shots.splice(i,1);}
    for(let i=gusts.length-1;i>=0;i--){const g=gusts[i];g.age+=dt;g.x+=g.vx*dt;if(Math.abs(g.x-hero.x)<46&&Math.abs(g.y-(hero.y-85))<65)hurtHero();if(g.age>2.4||g.x<-120)gusts.splice(i,1);}
    for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.type==='steam'?-25:310)*dt;p.vx*=1-dt*1.7;if(p.age>p.life)sparks.splice(i,1);}
  }
  function fit(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));}
  new ResizeObserver(fit).observe(canvas);fit();
  function line(x1,y1,x2,y2,col,w){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function ellipse(x,y,rx,ry,col,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();ctx.restore();}
  function sprite(sheet,n,x,y,w,h,flip=false,rot=0,sx=1,sy=1){const im=img[sheet];if(!im)return;const cw=im.width/2,ch=im.height/2;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale((flip?-1:1)*sx*(portraitMode?2.65:1),sy*(portraitMode?1.67:1));ctx.shadowColor=sheet==='boss'?'rgba(255,215,149,.55)':'rgba(255,233,187,.6)';ctx.shadowBlur=portraitMode?4:2;const frame=art.frames[sheet]?.[n];if(frame)ctx.drawImage(frame,-w/2,-h,w,h);else ctx.drawImage(im,(n%2)*cw,Math.floor(n/2)*ch,cw,ch,-w/2,-h,w,h);ctx.restore();}
  function paintBg(){
    if(img.bg)ctx.drawImage(img.bg,0,0,W,H);else {const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1c3b45');g.addColorStop(1,'#6d6050');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
    ctx.fillStyle='rgba(6,22,29,.16)';ctx.fillRect(0,0,W,H);if(art.mutedDesktop)ctx.drawImage(art.mutedDesktop,0,0);
    ctx.save();ctx.globalCompositeOperation='screen';const x=180+Math.sin(t*.47)*24;const gl=ctx.createRadialGradient(x,130,20,x,130,245);gl.addColorStop(0,'rgba(122,242,223,.15)');gl.addColorStop(1,'rgba(122,242,223,0)');ctx.fillStyle=gl;ctx.fillRect(0,0,520,410);ctx.restore();
    for(const f of flecks){const x=f.x+Math.sin(t*1.5+f.p)*6,y=f.y+(t*12+f.p*11)%35;ellipse(x,y,f.r,f.r*.7,'#f2dca9',.15+.23*(.5+.5*Math.sin(t*4+f.p)));}
    // Distinct moving foreground: fine steam curls and rope silhouettes.
    ctx.save();ctx.globalAlpha=.33;ctx.strokeStyle='#172d35';ctx.lineWidth=5;
    for(let i=0;i<3;i++){const x=150+i*335+Math.sin(t*.5+i)*3;ctx.beginPath();ctx.moveTo(x,-12);ctx.bezierCurveTo(x+16,45,x-12,69,x+10,110);ctx.stroke();}
    ctx.restore();
  }
  function actorSeparation(){for(const [x,y,r,a] of [[hero.x,hero.y-92,205,.37],[boss.x,FLOOR-145,225,.43]]){const g=ctx.createRadialGradient(x,y,26,x,y,r);g.addColorStop(0,`rgba(3,18,27,${a})`);g.addColorStop(1,'rgba(3,18,27,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}}
  function drawGust(g){ctx.save();ctx.translate(g.x,g.y);ctx.globalAlpha=clamp(1-g.age/2.4,0,1);ctx.strokeStyle='#d7e7da';ctx.lineWidth=5*g.scale;ctx.lineCap='round';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-56*g.scale,(-19+i*18)*g.scale);ctx.bezierCurveTo(-15*g.scale,(-44+i*17)*g.scale,24*g.scale,(30+i*10)*g.scale,62*g.scale,(i-1)*15*g.scale);ctx.stroke();}ctx.strokeStyle='#6ba2ad';ctx.lineWidth=2*g.scale;ctx.beginPath();ctx.arc(0,0,33*g.scale,t*8,t*8+4.5);ctx.stroke();ctx.restore();}
  function drawBoss(){
    const b=boss, bob=(b.phase==='idle'?Math.sin(t*4.3)*4:0), recoil=b.phase==='hurt'?Math.sin(b.phaseTime*19)*.13:0;
    ellipse(b.x,FLOOR+11,115,16,'#08232b',.55);ctx.save();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(b.x-20,FLOOR-155,12,b.x-20,FLOOR-155,140);g.addColorStop(0,'rgba(255,174,86,.23)');g.addColorStop(1,'rgba(255,174,86,0)');ctx.fillStyle=g;ctx.fillRect(b.x-150,FLOOR-300,300,300);ctx.restore();
    let frame=b.phase==='windup'?1:b.phase==='blast'?2:b.phase==='hurt'||b.phase==='defeated'?3:Math.floor(t*2.6)%2;
    const w=340,h=245;
    sprite('boss',frame,b.x,b.phase==='defeated'?FLOOR+b.phaseTime*20:FLOOR+bob,w,h,false,recoil+(b.phase==='hurt'?.14:0),b.phase==='windup'?.84:b.phase==='blast'?1.13:1,b.phase==='windup'?1.15:b.phase==='blast'?.91:1);
    if(b.flash>0){ctx.save();ctx.globalAlpha=b.flash*2.8;ctx.globalCompositeOperation='screen';sprite('boss',frame,b.x,FLOOR+bob,w,h);ctx.restore();}
    if(b.hitFx>0)drawImpactMark(b.x-105,FLOOR-157,b.hitFx/.31);
    if(b.phase==='windup'){const u=ease(b.phaseTime/.68);ctx.save();ctx.strokeStyle=`rgba(247,196,116,${.3+.5*u})`;ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.arc(b.x-58,FLOOR-140,95+u*25,0,TAU);ctx.stroke();ctx.restore();}
  }
  function drawImpactMark(x,y,k){
    ctx.save();ctx.globalAlpha=Math.min(1,k*3);ctx.lineCap='round';ctx.lineJoin='round';
    // Broken ink rings and two off-center stars leave the hit point visible.
    for(const [radius,a0,a1] of [[26,-2.55,-.63],[33,.38,2.30],[45,-1.75,-1.13]]){
      ctx.beginPath();ctx.arc(x,y,radius+(1-k)*10,a0,a1);ctx.strokeStyle='#18272a';ctx.lineWidth=8;ctx.stroke();
      ctx.strokeStyle='#fff0bd';ctx.lineWidth=3.4;ctx.stroke();
    }
    const star=(sx,sy,r,arms)=>{ctx.beginPath();for(let i=0;i<arms*2;i++){const a=i*Math.PI/arms-.35,rr=i%2?r*.34:r;const px=sx+Math.cos(a)*rr,py=sy+Math.sin(a)*rr;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fillStyle='#ffe4a4';ctx.strokeStyle='#1b2928';ctx.lineWidth=3;ctx.fill();ctx.stroke();};
    star(x-34,y-34,18+(1-k)*5,5);star(x+35,y+27,11+(1-k)*4,4);
    for(const [dx,dy] of [[-62,-14],[-48,33],[16,-55],[64,-23],[54,52]]){
      line(x+dx*.75,y+dy*.75,x+dx*1.25,y+dy*1.25,'#203039',5);
      line(x+dx*.75,y+dy*.75,x+dx*1.25,y+dy*1.25,'#ffe3a8',2.5);
    }
    ctx.restore();
  }
  function drawHero(){
    const moving=Math.abs(hero.vx)>35&&hero.grounded, airborne=!hero.grounded, shooting=hero.fire>0;
    let sheet='foxA',frame=0;
    if(hero.braking>0){sheet='foxB';frame=2;}
    else if(shooting){sheet=hero.fire>.1?'foxA':'foxB';frame=3;}
    else if(airborne){frame=2;}
    else if(moving){const a=Math.floor(hero.stride)%3;if(a===0){sheet='foxA';frame=1;}else{sheet='foxB';frame=a-1;}}
    const bob=moving?Math.sin(hero.stride*TAU/3)*3:Math.sin(t*3)*1.7;
    ellipse(hero.x,FLOOR+5,51,9,'#06232a',hero.grounded?.52:.24);
    if(!hero.grounded)ellipse(hero.x,FLOOR+5,35,6,'#a2845d',.25);
    ctx.save();if(hero.hurt>0&&Math.floor(hero.hurt*21)%2)ctx.globalAlpha=.48;
    const w=209,h=191, x=hero.x+(hero.facing<0?-10:0),y=hero.y+bob;
    sprite(sheet,frame,x,y,w,h,hero.facing<0,airborne?clamp(hero.vy/1900,-.18,.18):0,shooting?1.04:1,shooting?.92:1);
    ctx.restore();
    if(shooting){ctx.save();const a=hero.fire/.22,mx=hero.x+hero.facing*91,my=hero.y-104;ctx.globalCompositeOperation='screen';ellipse(mx,my,20+18*a,10+6*a,'#ffdc8c',a*.75);ctx.strokeStyle=`rgba(255,240,183,${a})`;ctx.lineWidth=3;for(let i=0;i<7;i++){const ang=(i/7)*TAU;ctx.beginPath();ctx.moveTo(mx+Math.cos(ang)*22,my+Math.sin(ang)*22);ctx.lineTo(mx+Math.cos(ang)*(35+13*a),my+Math.sin(ang)*(35+13*a));ctx.stroke();}ctx.restore();}
  }
  function drawShots(){for(const b of shots){const tail=b.vx>0?-1:1;line(b.x,b.y,b.x+tail*31,b.y+2,'#f7d18a',5);ellipse(b.x,b.y,7,4,'#fff7d6');line(b.x-3,b.y-6,b.x+3,b.y+6,'#a97037',1.5);}}
  function drawSparks(){for(const p of sparks){const a=1-p.age/p.life;ctx.save();ctx.globalAlpha=a;if(p.type==='steam'){ctx.strokeStyle='#e1f1e7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r*2,p.rot+p.age*3,p.rot+p.age*3+2);ctx.stroke();}else if(p.type==='dust'){ellipse(p.x,p.y,p.r*1.4,p.r*.7,'#ddc597',a*.48);}else if(p.type==='brass'){ctx.translate(p.x,p.y);ctx.rotate(p.rot+p.age*7);ctx.fillStyle=iColor(p);ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.8);}else{ellipse(p.x,p.y,p.r*a,p.r*a,p.type==='muzzle'?'#fff4d2':'#ffad67',a);}ctx.restore();}}
  function iColor(p){return rnd(p.rot*100)<.5?'#e3aa55':'#92c4c5';}
  function frameUI(){
    // Frame, independent from the painting, leaves the scene readable.
    ctx.strokeStyle='#51372b';ctx.lineWidth=8;ctx.strokeRect(3,3,W-6,H-6);ctx.strokeStyle='#c89b61';ctx.lineWidth=2;ctx.strokeRect(9,9,W-18,H-18);
    const narrow=canvas.clientWidth<500;
    if(narrow){ctx.fillStyle='rgba(8,35,42,.82)';ctx.fillRect(15,19,260,92);ctx.strokeStyle='#bf9661';ctx.lineWidth=3;ctx.strokeRect(15,19,260,92);ctx.font='bold 28px Georgia,serif';ctx.fillStyle='#f1e4bf';ctx.fillText('STORMWORKS',34,58);for(let i=0;i<4;i++){ctx.save();ctx.translate(57+i*54,86);ctx.rotate(Math.PI/4);ctx.fillStyle=i<hero.hp?'#f0a268':'#36535b';ctx.strokeStyle='#e9ce92';ctx.lineWidth=2;ctx.fillRect(-12,-12,24,24);ctx.strokeRect(-12,-12,24,24);ctx.restore();}ctx.fillStyle='rgba(8,35,42,.82)';ctx.fillRect(304,19,640,92);ctx.strokeStyle='#bf9661';ctx.lineWidth=3;ctx.strokeRect(304,19,640,92);ctx.textAlign='center';ctx.font='bold 28px Georgia,serif';ctx.fillStyle='#f6e8c7';ctx.fillText('GALESMITH',624,57);ctx.fillStyle='#102e36';ctx.fillRect(330,77,586,20);const fg=ctx.createLinearGradient(330,0,916,0);fg.addColorStop(0,'#f1b36a');fg.addColorStop(1,'#ca6d49');ctx.fillStyle=fg;ctx.fillRect(332,79,582*boss.hp/16,16);ctx.strokeStyle='#f0d7a0';ctx.lineWidth=2;ctx.strokeRect(330,77,586,20);ctx.textAlign='left';return;}
    ctx.fillStyle='rgba(8,35,42,.76)';ctx.fillRect(25,25,188,60);ctx.strokeStyle='#bf9661';ctx.lineWidth=2;ctx.strokeRect(25,25,188,60);
    ctx.font='bold 15px Georgia,serif';ctx.fillStyle='#f1e4bf';ctx.letterSpacing='2px';ctx.fillText('STORMWORKS',40,47);ctx.letterSpacing='0px';
    for(let i=0;i<4;i++){ctx.save();ctx.translate(45+i*35,67);ctx.rotate(Math.PI/4);ctx.fillStyle=i<hero.hp?'#f0a268':'#36535b';ctx.strokeStyle='#e9ce92';ctx.lineWidth=1.5;ctx.fillRect(-8,-8,16,16);ctx.strokeRect(-8,-8,16,16);ctx.restore();}
    ctx.fillStyle='rgba(8,35,42,.78)';ctx.fillRect(305,25,350,62);ctx.strokeStyle='#bf9661';ctx.lineWidth=2;ctx.strokeRect(305,25,350,62);ctx.font='bold 16px Georgia,serif';ctx.textAlign='center';ctx.fillStyle='#f6e8c7';ctx.fillText('GALESMITH',480,48);ctx.fillStyle='#102e36';ctx.fillRect(329,60,302,13);const fill=ctx.createLinearGradient(330,0,630,0);fill.addColorStop(0,'#f1b36a');fill.addColorStop(1,'#ca6d49');ctx.fillStyle=fill;ctx.fillRect(330,61,300*boss.hp/16,11);ctx.strokeStyle='#f0d7a0';ctx.lineWidth=1;ctx.strokeRect(329,60,302,13);ctx.textAlign='left';
    ctx.fillStyle='rgba(7,29,36,.69)';ctx.fillRect(22,497,225,25);ctx.font='12px Georgia,serif';ctx.fillStyle='#f4dfb1';ctx.fillText('A / D   MOVE    SPACE   JUMP    J   FIRE',32,514);
    if(win||hero.hp<=0){ctx.save();ctx.fillStyle='rgba(5,25,32,.68)';ctx.fillRect(245,206,470,100);ctx.strokeStyle='#e6be7e';ctx.lineWidth=3;ctx.strokeRect(245,206,470,100);ctx.textAlign='center';ctx.font='bold 35px Georgia,serif';ctx.fillStyle='#f5d38c';ctx.fillText(win?'STORM TAMED':'BLOWN AWAY',480,265);ctx.restore();}
  }
  function film(){
    const tick=Math.floor(t*12);
    ctx.save();ctx.globalAlpha=.08;ctx.fillStyle='#e9d4a3';for(let i=0;i<130;i++){const x=rnd(i+tick*179)*W,y=rnd(i*13+tick*29)*H;ctx.fillRect(x,y,1.2,1.2);}
    ctx.globalAlpha=.10;ctx.strokeStyle='#f1e8ce';ctx.lineWidth=.8;for(let i=0;i<3;i++){const x=rnd(i*23+Math.floor(t*.8)*40)*W;ctx.beginPath();ctx.moveTo(x,-10);ctx.quadraticCurveTo(x+4+Math.sin(t+i)*3,250,x-5,H+10);ctx.stroke();}
    const v=ctx.createRadialGradient(W/2,H/2,170,W/2,H/2,550);v.addColorStop(0,'rgba(6,15,17,0)');v.addColorStop(1,'rgba(6,15,17,.47)');ctx.globalAlpha=1;ctx.fillStyle=v;ctx.fillRect(0,0,W,H);ctx.restore();
  }
  function renderPortrait(){
    const PW=520,PH=780;ctx.setTransform(canvas.width/PW,0,0,canvas.height/PH,0,0);ctx.clearRect(0,0,PW,PH);
    // A central, uncropped-ratio section of the original painting fills the taller stage.
    if(img.bg){const crop=img.bg.height*520/840;ctx.drawImage(img.bg,(img.bg.width-crop)/2,0,crop,img.bg.height,0,0,520,840);}
    else {ctx.fillStyle='#274650';ctx.fillRect(0,0,PW,PH);}
    ctx.fillStyle='rgba(6,22,29,.16)';ctx.fillRect(0,0,PW,PH);if(art.mutedPortrait)ctx.drawImage(art.mutedPortrait,0,0);
    ctx.save();ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(132,200,10,132,200,280);glow.addColorStop(0,'rgba(156,239,224,.14)');glow.addColorStop(1,'rgba(156,239,224,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,PW,PH);ctx.restore();
    ctx.save();if(impact>0)ctx.translate(Math.sin(t*131)*impact*16,Math.cos(t*103)*impact*11);
    ctx.translate(24,311.75);ctx.scale(.47,.75);
    actorSeparation();for(const g of gusts)drawGust(g);drawBoss();drawHero();drawShots();drawSparks();ctx.restore();
    ctx.save();ctx.globalAlpha=.075;ctx.fillStyle='#ead9b6';const tick=Math.floor(t*12);for(let i=0;i<105;i++)ctx.fillRect(rnd(i+tick*179)*PW,rnd(i*13+tick*29)*PH,1.1,1.1);ctx.restore();
    const vignette=ctx.createRadialGradient(PW/2,PH/2,140,PW/2,PH/2,450);vignette.addColorStop(0,'rgba(5,20,24,0)');vignette.addColorStop(1,'rgba(5,20,24,.52)');ctx.fillStyle=vignette;ctx.fillRect(0,0,PW,PH);
    ctx.strokeStyle='#51372b';ctx.lineWidth=7;ctx.strokeRect(3,3,PW-6,PH-6);ctx.strokeStyle='#c89b61';ctx.lineWidth=2;ctx.strokeRect(9,9,PW-18,PH-18);
    ctx.fillStyle='rgba(8,35,42,.84)';ctx.fillRect(15,16,228,70);ctx.strokeStyle='#bf9661';ctx.lineWidth=2;ctx.strokeRect(15,16,228,70);
    ctx.font='bold 18px Georgia,serif';ctx.fillStyle='#f1e4bf';ctx.fillText('STORMWORKS',28,43);
    for(let i=0;i<4;i++){ctx.save();ctx.translate(44+i*49,65);ctx.rotate(Math.PI/4);ctx.fillStyle=i<hero.hp?'#f0a268':'#36535b';ctx.strokeStyle='#e9ce92';ctx.lineWidth=1.5;ctx.fillRect(-9,-9,18,18);ctx.strokeRect(-9,-9,18,18);ctx.restore();}
    ctx.fillStyle='rgba(8,35,42,.84)';ctx.fillRect(257,16,248,70);ctx.strokeStyle='#bf9661';ctx.lineWidth=2;ctx.strokeRect(257,16,248,70);
    ctx.textAlign='center';ctx.font='bold 17px Georgia,serif';ctx.fillStyle='#f6e8c7';ctx.fillText('GALESMITH',381,43);ctx.fillStyle='#102e36';ctx.fillRect(271,58,220,14);const fg=ctx.createLinearGradient(271,0,491,0);fg.addColorStop(0,'#f1b36a');fg.addColorStop(1,'#ca6d49');ctx.fillStyle=fg;ctx.fillRect(273,60,216*boss.hp/16,10);ctx.strokeStyle='#f0d7a0';ctx.lineWidth=1;ctx.strokeRect(271,58,220,14);ctx.textAlign='left';
    if(win||hero.hp<=0){ctx.fillStyle='rgba(5,25,32,.76)';ctx.fillRect(75,256,370,88);ctx.strokeStyle='#e6be7e';ctx.lineWidth=3;ctx.strokeRect(75,256,370,88);ctx.textAlign='center';ctx.font='bold 32px Georgia,serif';ctx.fillStyle='#f5d38c';ctx.fillText(win?'STORM TAMED':'BLOWN AWAY',260,311);ctx.textAlign='left';}
  }
  function render(){
    portraitMode=canvas.clientWidth<500&&canvas.clientHeight>canvas.clientWidth;
    if(portraitMode){renderPortrait();return;}
    const sX=canvas.width/W,sY=canvas.height/H;ctx.setTransform(sX,0,0,sY,0,0);ctx.clearRect(0,0,W,H);
    ctx.save();if(impact>0)ctx.translate(Math.sin(t*131)*impact*20,Math.cos(t*103)*impact*13);
    paintBg();actorSeparation();for(const g of gusts)drawGust(g);drawBoss();drawHero();drawShots();drawSparks();ctx.restore();film();frameUI();
  }
  function frame(now){if(!last)last=now;const dt=Math.min((now-last)/1000,.034);last=now;update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
  document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyW','ArrowUp','KeyJ','KeyX','KeyK'].includes(e.code))e.preventDefault();if(e.repeat&&['Space','KeyW','ArrowUp'].includes(e.code))return;switch(e.code){case'ArrowLeft':case'KeyA':held.left=true;break;case'ArrowRight':case'KeyD':held.right=true;break;case'Space':case'KeyW':case'ArrowUp':jump();break;case'KeyJ':case'KeyX':case'KeyK':held.attack=true;fire();break;}});
  document.addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')held.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')held.right=false;if(['KeyJ','KeyX','KeyK'].includes(e.code))held.attack=false;});
  window.addEventListener('blur',()=>{held.left=false;held.right=false;held.attack=false;});
  for(const [id,key,action] of [['left','left',null],['right','right',null],['jump',null,jump],['attack','attack',fire]]){const el=document.getElementById(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('held');if(key)held[key]=true;if(action)action();});const off=e=>{e.preventDefault();el.classList.remove('held');if(key)held[key]=false;};el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);}
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')fire();});
  window.__pilot07={assetsReady:ready,reset,get state(){return {t,loaded,error,hero:{...hero},boss:{...boss},shots:shots.length,gusts:gusts.length,view:{width:canvas.width,height:canvas.height},cycle};},jump,fire};
})();
