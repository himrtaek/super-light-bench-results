(()=>{
 'use strict';
 const cv=document.querySelector('#game'),c=cv.getContext('2d');
 const live=document.querySelector('#status');
 const CARD=[
  {art:'serpent',name:'UNDERTOW',kind:'TIDE',rank:4,value:40,color:'#7acbff'},
  {art:'beacon',name:'BEACON',kind:'LIGHT',rank:5,value:55,color:'#ffd276'},
  {art:'jelly',name:'MOONVEIL',kind:'TIDE',rank:3,value:35,color:'#b6ccff'},
  {art:'seabird',name:'EMBERWING',kind:'EMBER',rank:6,value:60,color:'#ff9a79'},
  {art:'hart',name:'KELP HART',kind:'GROVE',rank:4,value:45,color:'#9bd7ac'},
  {art:'compass',name:'NORTHSTAR',kind:'LIGHT',rank:5,value:50,color:'#f2d891'}
 ];
 const img={};let assetsReady=false,W=1080,H=650,portrait=false;
 let score=380,selected=new Set(),spent=new Set(),manual=false,elapsed=0,prev=performance.now(),frozen=false;
 let scriptIndex=0,submitCount=0,lastAward=0,lastBreakdown={base:0,full:0,mult:1,award:0,pairs:0,combo:'NO COMBINATION'},awardAt=-10,scoreBefore=380,ghosts=[];
 const script=[[.9,'select',0],[1.5,'select',2],[2.1,'select',4],[3.55,'submit'],[5.55,'select',1],[6.15,'select',3],[6.75,'select',5],[8.3,'submit']];
 Promise.all(CARD.map(x=>new Promise((resolve,reject)=>{
  const a=new Image();a.onload=()=>{img[x.art]=a;resolve()};a.onerror=()=>reject(Error('asset '+x.art));a.src='assets/'+x.art+'.webp';
 }))).then(()=>assetsReady=true).catch(e=>console.error(e));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
 const hash=(a,b=0)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n)};
 function resize(){portrait=innerHeight>innerWidth*1.15;W=portrait?650:1080;H=portrait?1040:650;const d=Math.min(devicePixelRatio||1,2);cv.width=Math.round(innerWidth*d);cv.height=Math.round(innerHeight*d);c.setTransform(cv.width/W,0,0,cv.height/H,0,0)}
 addEventListener('resize',resize);resize();
 function rr(x,y,w,h,r,fill,stroke,lw=1){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke()}}
 function line(x1,y1,x2,y2,color,w=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=w;c.stroke()}
 function txt(s,x,y,size,color='#f9f0d3',align='left',weight=700,serif=false){c.font=`${weight} ${size}px ${serif?'Georgia,serif':'system-ui,-apple-system,sans-serif'}`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y)}
 function fitTxt(s,x,y,maxW,size,color='#f9f0d3',align='left',weight=700){c.font=`${weight} ${size}px system-ui,-apple-system,sans-serif`;const w=c.measureText(s).width;if(w>maxW)size*=maxW/w;txt(s,x,y,size,color,align,weight)}
 function gradient(x,y,w,h,colors){const g=c.createLinearGradient(x,y,x+w,y+h);colors.forEach(([p,v])=>g.addColorStop(p,v));return g}
 function layout(){
  if(portrait)return {score:[23,108,604,220],omens:[35,352,580,111],tray:[240,477,170,23],button:[120,956,410,64],cards:CARD.map((_,i)=>[35+(i%3)*200,510+Math.floor(i/3)*218,180,202])};
  return {score:[353,116,694,176],omens:[25,142,300,398],tray:[616,294,170,18],button:[730,570,318,58],cards:CARD.map((_,i)=>[354+i*116,315,105,222])};
 }
 function compute(){
  const cards=[...selected].map(i=>CARD[i]),base=cards.reduce((n,x)=>n+x.value,0),full=cards.length===3?25:0;
  let pairs=0;for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)if(cards[i].kind===cards[j].kind)pairs++;
  const mult=1+pairs*.5,award=Math.round((base+full)*mult);
  let combo=cards.length<3?'BUILD A CHART':pairs>=3?`${cards[0].kind} TRINITY`:pairs?`${cards.find((a,i)=>cards.some((b,j)=>i!==j&&a.kind===b.kind)).kind} ECHO`:'THREE CURRENTS';
  return {base,full,mult,award,pairs,combo};
 }
 function choose(i,fromUser=false){
  if(fromUser)manual=true;
  if(spent.has(i))return false;
  if(selected.has(i))selected.delete(i);else if(selected.size<3)selected.add(i);else return false;
  live.textContent=`${CARD[i].name} ${selected.has(i)?'selected':'deselected'}`;return true;
 }
 function submit(fromUser=false){
  if(fromUser)manual=true;if(!selected.size)return false;
  const detail=compute(),{award}=detail;scoreBefore=score;score+=award;lastAward=award;lastBreakdown=detail;awardAt=elapsed;submitCount++;
  let slot=0;for(const i of selected){spent.add(i);ghosts.push({i,at:elapsed,slot:slot++,from:layout().cards[i].slice()})}
  selected.clear();live.textContent=`Chart scored ${award} points. Total ${score}.`;
  return true;
 }
 function reset(){score=380;selected.clear();spent.clear();manual=false;scriptIndex=0;submitCount=0;lastAward=0;lastBreakdown={base:0,full:0,mult:1,award:0,pairs:0,combo:'NO COMBINATION'};awardAt=-10;scoreBefore=380;ghosts=[];live.textContent='New chart'}
 function update(now){const dt=Math.min((now-prev)/1000,.1);prev=now;if(frozen)return;elapsed+=dt;if(elapsed>=10){elapsed-=10;reset()}
  while(!manual&&scriptIndex<script.length&&elapsed>=script[scriptIndex][0]){const [_,act,i]=script[scriptIndex++];if(act==='select')choose(i);else submit()}
  ghosts=ghosts.filter(g=>elapsed-g.at<.8);
 }
 function seek(time){const target=clamp(time,0,9.999);elapsed=0;reset();while(scriptIndex<script.length&&script[scriptIndex][0]<=target){const [at,act,i]=script[scriptIndex++];elapsed=at;if(act==='select')choose(i);else submit()}elapsed=target;ghosts=ghosts.filter(g=>elapsed-g.at<.8);frozen=true}
 function backdrop(){
  c.fillStyle=gradient(0,0,W,H,[[0,'#0b1d35'],[.5,'#11253d'],[1,'#271f38']]);c.fillRect(0,0,W,H);
  // Horizontal chart bands and an offset diamond grid: no rotating or spiral motif.
  c.save();c.globalAlpha=.26;
  for(let j=0;j<13;j++){const y=70+j*51+Math.sin(elapsed*.38+j)*3;c.beginPath();c.moveTo(0,y);for(let x=0;x<=W+30;x+=30)c.lineTo(x,y+Math.sin(x*.018+j*.8)*5);c.strokeStyle=j%2?'#5d8094':'#bb815f';c.lineWidth=j%2?1.2:2.2;c.stroke()}
  c.strokeStyle='#477186';c.lineWidth=.7;
  for(let x=-H;x<W+H;x+=80){line(x,0,x+H,H,'#477186',.8);line(x+H,0,x,H,'#477186',.8)}
  c.restore();
  for(let i=0;i<70;i++){const x=hash(i,1)*W,y=hash(i,3)*H,r=hash(i,8)*1.7+.5;const a=.17+.4*(.5+.5*Math.sin(elapsed*(1.1+hash(i,9))+i));c.fillStyle=`rgba(255,227,174,${a})`;c.fillRect(x,y,r,r)}
  // Faceted tide-glass plates behind the score and hand.
  c.save();c.globalAlpha=.15;c.fillStyle='#5a7d89';
  for(let j=0;j<6;j++){const cx=W*(j+.5)/6,cy=H*(.27+.11*(j%3));c.beginPath();c.moveTo(cx-80,cy);c.lineTo(cx-20,cy-45);c.lineTo(cx+65,cy-22);c.lineTo(cx+95,cy+37);c.lineTo(cx-34,cy+77);c.closePath();c.fill()}
  c.restore();
  const vignette=c.createRadialGradient(W*.55,H*.42,H*.1,W*.55,H*.45,W*.8);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(2,7,19,.6)');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(7,16,31,.48)';c.fillRect(0,0,W,portrait?96:94);
  line(24,portrait?97:94,W-24,portrait?97:94,'#bd935d',2);
 }
 function header(){
  txt('TIDAL',portrait?28:34,portrait?34:38,portrait?31:30,'#f4e1ac','left',900,true);
  txt('ATLAS',portrait?28:34,portrait?67:70,portrait?31:30,'#f4e1ac','left',900,true);
  const right=W-25;txt('NIGHT 03  /  05',right,portrait?37:40,portrait?18:17,'#c0d4dc','right',800);
  txt('CHART THE CURRENT',right,portrait?69:68,portrait?14:13,'#d3a96f','right',700);
 }
 function bevelPanel(x,y,w,h){
  c.save();c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=16;c.shadowOffsetY=8;
  rr(x,y,w,h,15,gradient(x,y,w,h,[[0,'#25425a'],[.42,'#132b43'],[1,'#101e34']]),'#d6a668',2.5);c.restore();
  rr(x+7,y+7,w-14,h-14,10,null,'rgba(235,198,130,.55)',1);
  for(const side of [0,1]){const sx=side?x+w-25:x+25;line(sx,y+17,sx+(side?-10:10),y+17,'#f5d592',2);line(sx,y+h-17,sx+(side?-10:10),y+h-17,'#f5d592',2)}
 }
 function scoreStage(){const age=elapsed-awardAt;if(age<0||age>=1.72)return 'idle';if(age<.43)return 'award';if(age<.93)return 'formula';return 'total'}
 function stageRail(x,y,w,h,stage){
  const labels=['01 AWARD','02 BONUSES','03 TOTAL'];
  const active=stage==='award'?0:stage==='formula'?1:2,unit=(w-44)/3;
  labels.forEach((name,i)=>{const xx=x+22+i*unit;
   rr(xx,y+h-24,unit-9,3,1.5,i===active?'#ffd48b':'#507887');
   txt(name,xx,y+h-12,portrait?10:10,i===active?'#ffe1a4':'#8aabb0','left',800);
  });
 }
 function scorePanel(){
  const [x,y,w,h]=layout().score;bevelPanel(x,y,w,h);
  const stage=scoreStage(),preview=compute(),d=lastBreakdown;
  if(stage==='idle'){
   if(portrait){
    txt('CURRENT TOTAL',x+22,y+27,19,'#c9dfda','left',800);
    fitTxt(`${preview.combo}  ·  ${selected.size}/3`,x+w-22,y+27,258,15,'#ffd18b','right',800);
    txt(score.toLocaleString(),x+22,y+83,53,'#fff2cb','left',900,true);
    txt('/ 1,200',x+255,y+86,22,'#86afbd','left',700,true);
    rr(x+22,y+113,w-44,10,5,'#0c1727','#a8bfbd',1);
    rr(x+24,y+115,(w-48)*clamp(score/1200,0,1),6,3,'#e8ba73');
    const cols=[[`CARD VALUE`,String(preview.base)],[`FULL CHART`,`+${preview.full}`],[`HARMONY`,`×${preview.mult.toFixed(1)}`],[`PREVIEW`,`+${preview.award}`]];
    cols.forEach(([head,value],i)=>{const xx=x+22+i*143;txt(head,xx,y+158,12,'#a8c7c8');txt(value,xx,y+190,26,i===3?'#ffd18b':'#fff1cd','left',900,true)});
   }else{
    txt('CURRENT TOTAL',x+24,y+29,18,'#c9dfda','left',800);
    txt(score.toLocaleString(),x+24,y+92,49,'#fff2cb','left',900,true);
    txt('/ 1,200',x+245,y+94,20,'#98bbc4','left',700,true);
    rr(x+23,y+137,328,12,6,'#0c1727','#a8bfbd',1);
    rr(x+26,y+140,322*clamp(score/1200,0,1),6,3,'#e8ba73');
    line(x+370,y+20,x+370,y+h-19,'rgba(199,169,111,.52)',1.5);
    fitTxt(preview.combo,x+394,y+28,200,17,'#ffd18b','left',850);
    txt(`${selected.size}/3`,x+w-24,y+28,15,'#b7d0d1','right',800);
    txt(`CARDS  ${preview.base}     FULL  +${preview.full}`,x+394,y+63,17,'#fff1c7','left',800);
    txt(`HARMONY  ×${preview.mult.toFixed(1)}`,x+394,y+98,17,'#a7e0dc','left',800);
    rr(x+388,y+h-43,w-407,31,8,'#d4a26a','#f8dfab',1);
    txt(`PREVIEW  +${preview.award}`,x+388+(w-407)/2,y+h-27,18,'#192b38','center',900,true);
   }
   return;
  }
  const inset=portrait?22:24;
  if(stage==='award'){
   txt('CHART AWARD',x+inset,y+27,portrait?19:18,'#c9dfda','left',800);
   txt(`+${lastAward}`,x+inset,y+(portrait?93:102),portrait?66:60,'#ffd88f','left',900,true);
   fitTxt(d.combo,x+w-inset,y+(portrait?94:99),portrait?220:230,portrait?17:17,'#ffd18b','right',850);
  }else if(stage==='formula'){
   txt('BONUSES APPLIED',x+inset,y+27,portrait?19:18,'#c9dfda','left',800);
   fitTxt(d.combo,x+w-inset,y+27,portrait?220:235,portrait?15:16,'#ffd18b','right',850);
   const eq=`(${d.base} + ${d.full}) × ${d.mult.toFixed(1)}`;
   fitTxt(eq,x+inset,y+(portrait?90:96),portrait?w-44:430,portrait?41:39,'#fff1c9','left',900);
   txt('CARDS        FULL CHART       HARMONY',x+inset,y+(portrait?136:138),portrait?12:12,'#a8c7c8','left',800);
   txt(`= +${d.award}`,x+w-inset,y+(portrait?165:96),portrait?31:30,'#ffd18b','right',900,true);
  }else{
   txt('NEW TOTAL',x+inset,y+27,portrait?19:18,'#c9dfda','left',800);
   fitTxt(d.combo,x+w-inset,y+27,portrait?220:235,portrait?15:16,'#ffd18b','right',850);
   txt(score.toLocaleString(),x+inset,y+(portrait?91:99),portrait?66:60,'#fff3d0','left',900,true);
   if(portrait){txt(`${scoreBefore}  +  ${lastAward}`,x+w-inset,y+93,22,'#a9d6d3','right',800,true)}
   else{txt(`${scoreBefore}  PREVIOUS`,x+w-inset,y+73,18,'#a9d6d3','right',800);txt(`+${lastAward}  CHART AWARD`,x+w-inset,y+111,18,'#ffd18b','right',800)}
   rr(x+inset,y+(portrait?140:135),w-inset*2,10,5,'#0c1727','#a8bfbd',1);
   rr(x+inset+2,y+(portrait?142:137),(w-inset*2-4)*clamp(score/1200,0,1),6,3,'#e8ba73');
  }
  stageRail(x,y,w,h,stage);
 }
 function omenIcon(i,x,y,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);c.lineWidth=2.5;c.strokeStyle='#f0d399';c.fillStyle='#f0d399';
  if(i===0){for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(-14,j*8);c.bezierCurveTo(-7,j*8-7,4,j*8+7,14,j*8);c.stroke()}}
  if(i===1){c.beginPath();c.arc(0,0,12,0,7);c.stroke();line(-17,0,17,0,'#f0d399',2);line(0,-17,0,17,'#f0d399',2)}
  if(i===2){c.beginPath();c.moveTo(0,-16);c.lineTo(12,0);c.lineTo(0,16);c.lineTo(-12,0);c.closePath();c.stroke();c.beginPath();c.arc(0,0,3,0,7);c.fill()}
  c.restore();
 }
 function relicCard(i,x,y,w,h,active,horizontal){
  const data=[['DEEP CURRENT','+25','AT 3 CARDS'],['TRUE NORTH','×1.5','MATCHED KIND'],['NIGHT GLASS','PREVIEW','REVEALS AWARD']][i];
  c.save();c.shadowColor=active?'rgba(243,198,115,.45)':'rgba(0,0,0,.45)';c.shadowBlur=active?17:10;c.shadowOffsetY=5;
  rr(x,y,w,h,8,gradient(x,y,w,h,[[0,'#294b60'],[.5,'#1b354d'],[1,'#152b42']]),active?'#f2d394':'#82a5a8',active?2.5:1.5);c.restore();
  rr(x+4,y+4,w-8,h-8,5,null,'rgba(238,201,137,.52)',1);
  c.save();c.globalAlpha=.16;c.strokeStyle='#c7e9dd';for(let j=0;j<7;j++)line(x+7+j*13,y+9,x+7+j*13,y+h-9,'#c7e9dd',.6);c.restore();
  if(horizontal){
   rr(x+8,y+9,33,17,3,'#0b2639','#b7c8bd',1);txt('R'+(i+1),x+24.5,y+17,11,'#ffe0a3','center',850);
   txt(active?'ARMED':'READY',x+w-9,y+17,10,active?'#ffe0a3':'#8db1b5','right',850);
   omenIcon(i,x+38,y+65,1.25);
   fitTxt(data[0],x+75,y+43,w-83,14,'#ffe5b1','left',850);
   txt(data[1],x+75,y+69,15,active?'#ffd28d':'#c5d7d5','left',900,true);
   fitTxt(data[2],x+75,y+89,w-83,10,'#bcd7d3','left',750);
  }else{
   txt('R'+(i+1),x+9,y+18,12,'#ffe0a3','left',850);
   txt('RELIC',x+w-8,y+18,10,'#abc7c5','right',800);
   const glow=c.createRadialGradient(x+w/2,y+93,4,x+w/2,y+93,59);glow.addColorStop(0,active?'rgba(251,204,112,.31)':'rgba(117,202,218,.15)');glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.fillRect(x,y+25,w,135);
   omenIcon(i,x+w/2,y+97,2.05);
   line(x+12,y+151,x+w-12,y+151,'rgba(240,211,153,.55)',1.4);
   fitTxt(data[0],x+w/2,y+174,w-12,13,'#ffe5b1','center',850);
   fitTxt(data[1],x+w/2,y+207,w-14,19,active?'#ffd28d':'#c5d7d5','center',900);
   fitTxt(data[2],x+w/2,y+230,w-12,10,'#bcd7d3','center',750);
   rr(x+12,y+h-29,w-24,19,4,active?'#d8ac6e':'#325466');
   txt(active?'ARMED':'READY',x+w/2,y+h-19,10,active?'#193346':'#a7c6c5','center',900);
  }
 }
 function relicStatus(){const p=scoreStage()==='idle'?compute():lastBreakdown;return [p.full>0,p.pairs>0,true]}
 function omens(){
  const [x,y,w,h]=layout().omens;
  const armed=relicStatus();
  if(!portrait){
   txt('RELIC DECK',x+4,y-23,18,'#d9cba9','left',800);
   for(let i=0;i<3;i++)relicCard(i,x+i*101,y+12,98,286,armed[i],false);
   rr(x,y+315,w,55,8,'rgba(13,38,51,.78)','#82a5a8',1);
   txt('PASSIVE EFFECTS',x+w/2,y+334,15,'#f6dcad','center',850);
   txt(`${armed.filter(Boolean).length} / 3 ARMED`,x+w/2,y+354,13,'#a9d8d4','center',800);
   return;
  }
  txt('RELIC DECK',x,y-14,18,'#d9cba9','left',800);
  const gap=11,cw=(w-gap*2)/3;
  for(let i=0;i<3;i++)relicCard(i,x+i*(cw+gap),y,cw,h,armed[i],true);
 }
 function kindIcon(kind,x,y,s){
  c.save();c.translate(x,y);c.scale(s,s);c.strokeStyle='#f7e0a9';c.fillStyle='#f7e0a9';c.lineWidth=2;c.lineCap='round';
  if(kind==='TIDE'){for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(-8,j*5);c.quadraticCurveTo(-2,j*5-4,3,j*5);c.quadraticCurveTo(7,j*5+3,9,j*5);c.stroke()}}
  if(kind==='LIGHT'){for(let j=0;j<8;j++){const a=j*Math.PI/4;line(Math.cos(a)*6,Math.sin(a)*6,Math.cos(a)*10,Math.sin(a)*10,'#f7e0a9',1.7)}c.beginPath();c.arc(0,0,4,0,7);c.fill()}
  if(kind==='EMBER'){c.beginPath();c.moveTo(-7,8);c.quadraticCurveTo(-10,-2,0,-10);c.quadraticCurveTo(2,-4,6,-7);c.quadraticCurveTo(12,6,2,10);c.quadraticCurveTo(1,3,-2,2);c.quadraticCurveTo(-4,7,-7,8);c.fill()}
  if(kind==='GROVE'){c.beginPath();c.moveTo(-7,8);c.quadraticCurveTo(-11,-5,8,-10);c.quadraticCurveTo(11,6,-7,8);c.stroke();line(-5,6,6,-6,'#f7e0a9',1.5)}
  c.restore();
 }
 function drawCard(i,rect,opacity=1,raised=true,ghost=false){
  const [x,y,w,h]=rect,a=CARD[i],chosen=selected.has(i)&&!ghost,used=spent.has(i)&&!ghost,lift=raised&&chosen?(portrait?14:24):0,yy=y-lift;
  c.save();c.globalAlpha=opacity*(used?.38:1);
  c.shadowColor=chosen?'rgba(255,219,148,.8)':'rgba(0,0,0,.65)';c.shadowBlur=chosen?19:11;c.shadowOffsetY=chosen?7:11;
  rr(x,yy,w,h,10,'#e6d6ae',chosen?'#fff1be':'#815f42',chosen?3:1.8);c.restore();
  c.save();c.globalAlpha=opacity*(used?.45:1);
  rr(x+4,yy+4,w-8,h-8,7,'#e8d9bb','#b28856',1);
  rr(x+7,yy+7,w-14,portrait?25:23,4,'#183549');
  txt(String(a.rank),x+13,yy+(portrait?19:18),portrait?22:20,'#fff2d0','left',900,true);
  fitTxt(a.kind,x+w/2,yy+(portrait?19:18),w*.48,portrait?12:10,a.color,'center',850);
  kindIcon(a.kind,x+w-20,yy+(portrait?19:18),portrait?1:.8);
  const artX=x+8,artY=yy+(portrait?34:31),artW=w-16,artH=portrait?116:145;
  c.beginPath();c.roundRect(artX,artY,artW,artH,3);c.clip();
  c.fillStyle='#14273b';c.fillRect(artX,artY,artW,artH);
  if(img[a.art]){const im=img[a.art],scale=Math.max(artW/im.width,artH/im.height),dw=im.width*scale,dh=im.height*scale;c.drawImage(im,artX+(artW-dw)/2,artY+(artH-dh)/2,dw,dh)}
  c.restore();
  c.save();c.globalAlpha=opacity*(used?.45:1);
  rr(artX,artY,artW,artH,3,null,'#9b734b',1.7);
  if(chosen||used){rr(artX+2,artY+artH-20,artW-4,18,2,chosen?'rgba(227,173,98,.93)':'rgba(22,47,60,.85)');txt(chosen?'SELECTED':'CHARTED',x+w/2,artY+artH-11,portrait?11:10,chosen?'#243743':'#b8d0cc','center',900)}
  fitTxt(a.name,x+w/2,artY+artH+(portrait?14:11),w-16,portrait?15:11,'#345260','center',900);
  txt(a.kind,x+11,yy+h-16,portrait?12:10,'#385664','left',800);
  txt(`+${a.value}`,x+w-10,yy+h-16,portrait?24:21,'#3d3943','right',900,true);
  if(chosen){c.fillStyle='#f8d691';c.beginPath();c.moveTo(x+w/2-7,yy-11);c.lineTo(x+w/2+7,yy-11);c.lineTo(x+w/2,yy-3);c.closePath();c.fill()}
  c.restore();
 }
 function ghostPoint(g,k){const a=g.from,tray=layout().tray,sx=a[0]+a[2]/2,sy=a[1]+a[3]/2,tx=tray[0]+tray[2]/2+(g.slot-1)*38,ty=tray[1]+tray[3]/2;
  const q=1-k;return [q*q*q*sx+3*q*q*k*sx+3*q*k*k*tx+k*k*k*tx,q*q*q*sy+3*q*q*k*(sy-110)+3*q*k*k*(ty+65)+k*k*k*ty]}
 function cards(){const r=layout().cards;
  for(let i=0;i<6;i++)drawCard(i,r[i]);
  for(const g of ghosts){const k=clamp((elapsed-g.at)/.68,0,1);if(k>=1)continue;
   c.save();c.globalAlpha=(1-smooth(.65,1,k))*.85;c.strokeStyle=CARD[g.i].color;c.lineWidth=3.5;c.shadowColor=CARD[g.i].color;c.shadowBlur=12;
   c.beginPath();for(let j=0;j<=12;j++){const v=ghostPoint(g,clamp(k-.22+j*.22/12,0,1));if(j===0)c.moveTo(...v);else c.lineTo(...v)}c.stroke();c.restore();
  }
  for(const g of ghosts){const k=clamp((elapsed-g.at)/.68,0,1);if(k>=1)continue;
   const [x,y]=ghostPoint(g,smooth(0,1,k)),s=1-.68*k,a=g.from;
   c.save();c.translate(x,y);c.scale(s,s);drawCard(g.i,[-a[2]/2,-a[3]/2,a[2],a[3]],1-smooth(.76,1,k),false,true);c.restore();
  }
 }
 function drawTray(){const [x,y,w,h]=layout().tray,liveGhosts=ghosts.filter(g=>elapsed-g.at<.68).length,lit=liveGhosts>0;
  c.save();c.shadowColor=lit?'#f6c77d':'rgba(0,0,0,.35)';c.shadowBlur=lit?15:6;
  rr(x,y,w,h,7,lit?'#315c64':'#183b4b',lit?'#ffe0a0':'#87abb0',1.6);c.restore();
  txt(lit?'CHARTING GATE':'CHART GATE',x+w/2,y+h/2,portrait?12:10,lit?'#ffe0a0':'#b4d0ce','center',850);
 }
 function button(){const [x,y,w,h]=layout().button,ready=selected.size>0;
  c.save();c.shadowColor=ready?'rgba(255,197,117,.45)':'rgba(0,0,0,.4)';c.shadowBlur=ready?22:9;
  rr(x,y,w,h,12,ready?gradient(x,y,w,h,[[0,'#ffdc95'],[1,'#d99853']]):'#42606b',ready?'#fff0bf':'#87a5a3',2.5);c.restore();
  txt('CHART SELECTION',x+w/2,y+h/2-3,portrait?22:19,ready?'#28313a':'#d6e3db','center',900);
  txt('ENTER  •  '+selected.size+' / 3',x+w/2,y+h/2+(portrait?20:16),portrait?12:11,ready?'#60402d':'#b0c4c3','center',800);
 }
 function particles(){const age=elapsed-awardAt;if(age<0||age>1.35)return;
  const a=1-smooth(.7,1.35,age);c.save();c.globalAlpha=a;
  const target=layout().score,bx=target[0]+target[2]*.52,by=target[1]+target[3]+14;
  for(let i=0;i<38;i++){const ang=i*2.4,sp=60+hash(i,6)*185,r=age*sp;
    const x=bx+Math.cos(ang)*r,y=by+Math.sin(ang)*r*.7;
    c.fillStyle=i%4?'#f5d389':'#a6f0ef';c.fillRect(x,y,2+hash(i,7)*5,2+hash(i,8)*5);
  }c.restore();
 }
 function frame(now){update(now);c.setTransform(cv.width/W,0,0,cv.height/H,0,0);c.clearRect(0,0,W,H);backdrop();particles();if(assetsReady)cards();header();omens();scorePanel();drawTray();button();requestAnimationFrame(frame)}
 requestAnimationFrame(frame);
 cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
  const b=layout().button;if(x>=b[0]&&x<=b[0]+b[2]&&y>=b[1]&&y<=b[1]+b[3]){submit(true);return}
  for(let i=5;i>=0;i--){const a=layout().cards[i],lift=selected.has(i)?(portrait?14:24):0;
    if(x>=a[0]&&x<=a[0]+a[2]&&y>=a[1]-lift&&y<=a[1]+a[3]){choose(i,true);return}}
 });
 addEventListener('keydown',e=>{const n=Number(e.key);if(n>=1&&n<=6)choose(n-1,true);if(e.key==='Enter'){submit(true);e.preventDefault()}});
 window.__atlasDebug={snapshot:()=>({time:elapsed,portrait,score,selected:[...selected],spent:[...spent],preview:compute(),relicArmed:relicStatus(),submitCount,assetsReady,frozen,scoreStage:scoreStage(),lastBreakdown:{...lastBreakdown},inTransit:ghosts.filter(g=>elapsed-g.at<.68).length}),select:i=>choose(i,true),submit:()=>submit(true),reset:()=>{elapsed=0;reset();frozen=false},seek,resume:()=>{frozen=false;prev=performance.now()},resize};
 const params=new URLSearchParams(location.search);if(params.has('at'))seek(Number(params.get('at'))||0);
})();
