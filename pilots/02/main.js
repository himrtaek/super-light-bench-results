(()=>{
 const C=document.getElementById('units'),G=C.getContext('2d'),F=document.getElementById('field');
 const arts=['stag','beetle','moth','raven','badger','mage'].map(name=>{const im=new Image();im.src='assets/'+name+'.webp';return im});
 const p=new URLSearchParams(location.search),capture=p.has('capture'),fixedT=Number(p.get('t')||5);
 const names=['사슴 파수병','딱정벌레 기수','태엽 나방'],cost=[3,2,3],speed=[48,67,55],maxhp=[110,80,65],damage=[23,15,6];
 let energy=6,northHp=240,southHp=240,units=[],sparks=[],last=0,elapsed=0,nextEnemy=7,selected=0,sequence=0,view={scale:1,ox:0,oy:0};
 const seedUnits=[
  {team:0,type:0,x:345,y:870,hp:110},{team:0,type:1,x:695,y:1020,hp:80},{team:0,type:2,x:515,y:1110,hp:65},
  {team:1,type:3,x:365,y:680,hp:100},{team:1,type:4,x:705,y:570,hp:125},{team:1,type:5,x:535,y:520,hp:70}
 ];
 function unit(o){return {...o,id:++sequence,max:o.hp,cd:.2+sequence*.13,bob:sequence*.7,hit:0};}
 units=seedUnits.map(unit);
 function resize(){const w=F.clientWidth,h=F.clientHeight,d=Math.min(devicePixelRatio||1,2);C.width=Math.round(w*d);C.height=Math.round(h*d);C.style.width=w+'px';C.style.height=h+'px';if(matchMedia('(min-aspect-ratio:1/1)').matches){view={sx:w/1024,sy:h/1000,ox:0,oy:-300*h/1000,landscape:true}}else{const scale=Math.max(w/1024,h/1536);view={sx:scale,sy:scale,ox:(w-1024*scale)/2,oy:(h-1536*scale)/2,landscape:false}}}
 function say(s){document.getElementById('status').textContent=s}
 function updateHud(){document.getElementById('energy').textContent=`에너지 ${Math.floor(energy)} / 10`;document.getElementById('energy-fill').style.width=(energy*10)+'%';const n=Math.max(0,Math.round(northHp)),s=Math.max(0,Math.round(southHp));document.getElementById('north-hp').textContent=n;document.getElementById('south-hp').textContent=s;document.getElementById('north-detail').textContent=n;document.getElementById('south-detail').textContent=s;document.getElementById('north-fill').style.width=(n/240*100)+'%';document.getElementById('south-fill').style.width=(s/240*100)+'%';document.getElementById('unit-count').textContent=units.length;document.querySelectorAll('.card').forEach(b=>{b.disabled=energy<cost[+b.dataset.type];b.setAttribute('aria-pressed',String(selected===+b.dataset.type))});}
 function deploy(type,x=([396,640,515][type]),y=1100){selected=type;if(energy<cost[type]){say('에너지가 차는 중입니다');return false}energy-=cost[type];const px=Math.max(220,Math.min(804,x)),py=Math.max(800,Math.min(1210,y));units.push(unit({team:0,type,x:px,y:py,hp:maxhp[type]}));sparks.push({x:px,y:py,age:0,kind:'spawn'});say(`${names[type]} 출전!`);updateHud();return true}
 document.querySelectorAll('.card').forEach(b=>b.addEventListener('click',()=>deploy(+b.dataset.type)));
 F.addEventListener('pointerdown',e=>{const r=F.getBoundingClientRect(),x=(e.clientX-r.left-F.clientLeft-view.ox)/view.sx,y=(e.clientY-r.top-F.clientTop-view.oy)/view.sy;if(y<780){say('남쪽 진영에 배치하세요');return}deploy(selected,x,y)});
 function tick(dt){elapsed+=dt;energy=Math.min(10,energy+dt*.35);if(elapsed>nextEnemy){const type=3+(Math.floor(elapsed/7)%3);units.push(unit({team:1,type,x:330+((Math.floor(elapsed*41)%3)*180),y:480,hp:[100,125,70][type-3]}));nextEnemy+=7;say('북쪽 길드가 접근합니다')}
  for(const u of units){u.hit=Math.max(0,u.hit-dt);u.bob+=dt*3;u.cd-=dt;let target=null,best=175;for(const v of units){if(v.team===u.team||v.hp<=0)continue;const dist=Math.hypot(v.x-u.x,v.y-u.y);if(dist<best){best=dist;target=v}}
   if(target){if(u.cd<=0){u.cd=u.type===2?1.1:.74;const d=damage[u.type%3];if(u.type===2){for(const ally of units)if(ally.team===0&&Math.hypot(ally.x-u.x,ally.y-u.y)<190)ally.hp=Math.min(ally.max,ally.hp+13)}else{target.hp-=d;target.hit=.25;sparks.push({x:target.x,y:target.y-50,age:0,kind:'hit'});if(target.hp<=0)say(`${u.team?'북쪽':'남쪽'} 수호대가 전진합니다`)}}}
   else{u.y+=(u.team?1:-1)*speed[u.type%3]*dt;u.x+=(512-u.x)*dt*.03;if((u.team===1&&u.y>1240)||(u.team===0&&u.y<265)){if(u.team===0){northHp=Math.max(0,northHp-8*dt);u.y=300;u.hp-=5*dt}else{southHp=Math.max(0,southHp-8*dt);u.y=1200;u.hp-=5*dt}}}}
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=units[i],b=units[j];if(a.team!==b.team)continue;const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<118&&d>1){const push=(118-d)*dt*.55;const dir=dx/d;a.x+=dir*push;b.x-=dir*push}}
  units=units.filter(u=>u.hp>0&&u.y>190&&u.y<1345);for(const s of sparks)s.age+=dt;sparks=sparks.filter(s=>s.age<.55);updateHud();}
 function sprite(u){const i=u.type,im=arts[i],size=[1.14,1.03,.92,1.13,1.23,1][i],s=248*size*(.78+u.y/1536*.42),aspect=im.naturalWidth&&im.naturalHeight?im.naturalWidth/im.naturalHeight:1,w=s*aspect;
  G.save();G.translate(u.x,u.y);G.scale(view.sy/view.sx,1);const x=0,y=Math.sin(u.bob)*4;G.globalAlpha=u.hit>0?.7+Math.sin(u.hit*42)*.3:1;G.fillStyle='#071d27b5';G.beginPath();G.ellipse(x,y+10,s*.35,s*.14,0,0,7);G.fill();G.strokeStyle=u.team?'#ffbe68':'#54f0d3';G.lineWidth=9;G.shadowColor=u.team?'#ffad3f':'#63ffdb';G.shadowBlur=24;G.stroke();G.shadowBlur=0;G.shadowColor=u.hit>0?'#fff5a5':(u.team?'#ffcc74':'#a4fff0');G.shadowBlur=u.hit>0?32:18;if(im.complete&&im.naturalWidth)G.drawImage(im,x-w*.5,y-s*.86,w,s);
  G.shadowBlur=0;const by=y-s*.73;G.fillStyle='#061b27f5';G.fillRect(x-s*.38,by-26,s*.76,19);G.strokeStyle=u.team?'#ffcc81':'#8ff9e7';G.lineWidth=2.5;G.strokeRect(x-s*.38,by-26,s*.76,19);G.fillStyle=u.team?'#ffb35b':'#5be6d0';G.fillRect(x-s*.365,by-24,s*.73*Math.max(0,u.hp/u.max),15);G.restore();}
 function draw(){const d=C.width/F.clientWidth;G.setTransform(view.sx*d,0,0,view.sy*d,view.ox*d,view.oy*d);G.clearRect(-view.ox/view.sx,-view.oy/view.sy,F.clientWidth/view.sx,F.clientHeight/view.sy);
  for(const u of [...units].sort((a,b)=>a.y-b.y))sprite(u);
  for(const s of sparks){const a=1-s.age/.55,r=10+s.age*150;G.save();G.globalAlpha=a;G.globalCompositeOperation='screen';G.strokeStyle=s.kind==='spawn'?'#8affde':'#ffe38d';G.lineWidth=7*a;G.beginPath();G.ellipse(s.x,s.y,r,r*.45,0,0,7);G.stroke();for(let i=0;i<9;i++){const ang=i*2.4+s.age*2;G.fillStyle=i%2?'#fff9d3':'#78f0db';G.beginPath();G.arc(s.x+Math.cos(ang)*r,s.y+Math.sin(ang)*r*.6,5*a,0,7);G.fill()}if(s.kind==='hit'){G.font='900 31px system-ui';G.textAlign='center';G.lineWidth=4;G.strokeStyle='#51321d';G.fillStyle='#fff3c6';G.strokeText('−23',s.x,s.y-r*.6);G.fillText('−23',s.x,s.y-r*.6)}G.restore()}
  if(capture&&fixedT>=5){G.save();G.globalCompositeOperation='screen';G.strokeStyle='#fff7b0';G.lineWidth=12;G.beginPath();G.arc(370,770,70,-1.5,1.3);G.stroke();G.restore()}
 }
 function frame(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;if(!capture)tick(dt);draw();requestAnimationFrame(frame)}
 if(capture){energy=6;for(const u of units){if(u.team===0)u.y-=35;if(u.team===1)u.y+=20}units[3].hp=77;sparks.push({x:370,y:760,age:.07,kind:'hit'});say('정원 수호대가 다리를 지킵니다')}
 addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,80));resize();updateHud();requestAnimationFrame(frame);
 window.__pilot={deploy,get imageReady(){return document.getElementById('scene').complete&&arts.every(im=>im.complete&&im.naturalWidth>0)},get energy(){return energy},get units(){return units.length},get positions(){return units.map(u=>[u.id,u.y])},get northHp(){return northHp},get southHp(){return southHp},get view(){return view}};
})();
