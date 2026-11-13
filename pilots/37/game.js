(() => {
  'use strict';
  const canvas=document.querySelector('#sea'), ctx=canvas.getContext('2d',{alpha:false});
  const image=(src)=>{const im=new Image();im.src=src;return im;};
  const sea=image('assets/afterstorm-sea.webp'), ship=image('assets/wind-skiff.webp');
  const $=id=>document.getElementById(id);
  const state={time:0,heading:0,headingVelocity:0,wind:0,progress:0,brace:false,bracedOnce:false,steer:0,ended:false,ready:false,frame:0};
  let W=0,H=0,dpr=1,last=performance.now(),bgCrop=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
  const noise=n=>{const x=Math.sin(n*127.1+42.31)*43758.5453;return x-Math.floor(x)};
  function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(W*dpr));canvas.height=Math.max(1,Math.round(H*dpr));canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize,{passive:true});resize();
  function begin(){state.time=0;state.heading=0;state.headingVelocity=0;state.wind=0;state.progress=0;state.brace=false;state.bracedOnce=false;state.steer=0;state.ended=false;$('result').classList.remove('show');$('guide').style.opacity='1';last=performance.now();}
  $('restart').addEventListener('click',begin);
  const setSteer=(dir,pressed)=>{if(state.ended)return;state.steer=pressed?dir:state.steer===dir?0:state.steer;$(dir<0?'left':'right').classList.toggle('active',pressed);if(pressed){state.heading=clamp(state.heading+dir*.035,-1,1);$('guide').style.opacity='.38';}};
  for(const [id,dir] of [['left',-1],['right',1]]){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);setSteer(dir,true)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>setSteer(dir,false));}
  function setBrace(on){if(state.ended)return;state.brace=on;if(on){state.bracedOnce=true;$('guide').style.opacity='.25'}$('brace').classList.toggle('active',on)}
  const brace=$('brace');brace.addEventListener('pointerdown',e=>{e.preventDefault();brace.setPointerCapture(e.pointerId);setBrace(true)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])brace.addEventListener(ev,()=>setBrace(false));
  const keys=new Set();addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','KeyA','KeyD','Space','Enter'].includes(e.code))e.preventDefault();if(keys.has(e.code))return;keys.add(e.code);if(e.code==='ArrowLeft'||e.code==='KeyA')setSteer(-1,true);if(e.code==='ArrowRight'||e.code==='KeyD')setSteer(1,true);if(e.code==='Space'||e.code==='Enter')setBrace(true);if(e.code==='KeyR'&&state.ended)begin()});addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='ArrowLeft'||e.code==='KeyA')setSteer(-1,false);if(e.code==='ArrowRight'||e.code==='KeyD')setSteer(1,false);if(e.code==='Space'||e.code==='Enter')setBrace(false)});
  canvas.addEventListener('pointerdown',e=>{if(state.ended)return;const dir=e.clientX<W*.5?-1:1;state.heading=clamp(state.heading+dir*.10,-1,1);$('guide').style.opacity='.35'});
  function update(dt){if(!state.ready||state.ended)return;state.time=Math.min(10,state.time+dt);const t=state.time;
    state.wind=Math.sin(t*.82+.4)*.42+(t>5.1?.23*Math.sin((t-5.1)*2.4):0);
    state.headingVelocity+=(state.steer*.78+state.wind*.36-state.heading*.22)*dt;
    state.headingVelocity*=Math.exp(-2.7*dt);state.heading=clamp(state.heading+state.headingVelocity*dt*2.4,-1,1);
    const alignment=1-.24*Math.abs(state.heading-state.wind*.38);
    const speed=(7.8+(state.brace?4.1:0)+(state.wind>.25?.45:0))*alignment;
    state.progress=clamp(state.progress+speed*dt,0,100);
    if(t>=10){state.ended=true;const win=state.progress>=77&&Math.abs(state.heading)<.68&&state.bracedOnce;$('resultTitle').textContent=win?'바람문 통과':'바람길을 놓쳤다';$('resultBody').textContent=win?'돛을 살리고 바람을 읽어 항로를 완주했습니다.':'조타와 돛 당기기를 함께 써서 바람문 정면으로 항해하세요.';$('result').querySelector('small').textContent=win?'VOYAGE COMPLETE':'VOYAGE RETRY';$('result').classList.add('show');}
  }
  function background(t){if(!sea.complete||!sea.naturalWidth){ctx.fillStyle='#0a3047';ctx.fillRect(0,0,W,H);return;}const iw=sea.naturalWidth,ih=sea.naturalHeight;let scale=Math.max(W/iw,H/ih)*1.055;let sw=W/scale,sh=H/scale;let sx=(iw-sw)*(W/H<.8?.28:.5)+state.heading*20;let sy=(ih-sh)*.47+Math.sin(t*1.4)*3; sx=clamp(sx,0,iw-sw);sy=clamp(sy,0,ih-sh);bgCrop={sx,sy,sw,sh};ctx.drawImage(sea,sx,sy,sw,sh,0,0,W,H);
    const h=H*(W/H<.8?.48:.52);const g=ctx.createLinearGradient(0,h,0,H);g.addColorStop(0,'#0b526400');g.addColorStop(.5,'#083b4a08');g.addColorStop(1,'#001b28b4');ctx.fillStyle=g;ctx.fillRect(0,h,W,H-h);
  }
  function waveBands(t){
    const narrow=W/H<.8,horizon=H*(narrow?.43:.52),depth=H-horizon;
    ctx.save();ctx.beginPath();ctx.rect(0,horizon,W,depth);ctx.clip();
    ctx.globalCompositeOperation='screen';
    // Short moving whitecaps float over the irregular breakers painted in the sea plate.
    for(let i=0;i<48;i++){
      const z=.08+noise(i*37+4)*.88;
      const life=(t*(.06+.03*z)+noise(i*17+9))%1;
      const x=((noise(i*31+3)*1.35+life*.13)%1.35)*W-W*.15;
      const y=horizon+depth*z+Math.sin(t*(.6+z*.3)+i*2.8)*z*7;
      const len=(6+noise(i*97+5)*42)*(.4+z*1.5)*(narrow?.7:1);
      const alpha=(.045+z*.13)*(1-smooth(.78,1,life));
      ctx.beginPath();ctx.moveTo(x-len*.52,y+z*2);
      ctx.quadraticCurveTo(x-len*.2,y-z*(1+noise(i*13)*4),x+len*.1,y+z*2);
      ctx.quadraticCurveTo(x+len*.3,y+z*4,x+len*.5,y-z*noise(i*23)*3);
      ctx.strokeStyle=`rgba(200,249,239,${alpha})`;ctx.lineWidth=.6+z*1.5;ctx.stroke();
      if(noise(i*43+2)>.7){for(let j=0;j<3;j++){
        const px=x+(noise(i*103+j*7)-.5)*len,py=y+(noise(i*71+j*13)-.5)*z*9;
        ctx.fillStyle=`rgba(237,255,246,${alpha*.8})`;ctx.fillRect(px,py,1+z,1);
      }}
    }
    // Moon reflection separates into isolated glints, each with its own rhythm.
    for(let i=0;i<38;i++){
      const z=noise(i*29+13),yy=horizon+depth*(.1+z*.75),spread=(.025+z*.15)*W;
      const xx=W*(narrow?.74:.76)+(noise(i*63+8)-.5)*spread*2+Math.sin(t*.7+i)*3;
      const flicker=.3+.7*Math.sin(t*(.9+noise(i*19)*1.1)+i*5.7)**2;
      ctx.fillStyle=`rgba(255,240,210,${(.025+z*.1)*flicker})`;
      ctx.fillRect(xx,yy,(1+z*12)*(narrow?.7:1),.5+z*1.2);
    }
    ctx.restore();
  }
  function foam(t){
    const narrow=W/H<.8;
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let side=0;side<2;side++)for(let i=0;i<14;i++){
      const z=(i+.5)/14,phase=(noise(i*57+side*31)+t*(.042+z*.025))%1;
      const y=H*(.53+z*.43)+Math.sin(i*2.7+t*1.2)*7;
      const edge=side?W:0,sign=side?-1:1;
      const x=edge+sign*(W*(.025+.16*phase)+Math.sin(i*4.3+t*.55)*W*.018);
      const len=(8+z*55)*(narrow?.55:1)*(1+noise(i*35+side)*.7);
      ctx.beginPath();ctx.moveTo(x-len*.5,y);
      ctx.quadraticCurveTo(x,y-(3+z*9),x+len*.5,y+2);
      ctx.strokeStyle=`rgba(225,255,249,${.09+z*.19})`;ctx.lineWidth=1+z*2.4;ctx.stroke();
      for(let j=0;j<8;j++){
        const px=x+(noise(i*41+j*17+side*11)-.5)*len*1.5;
        const py=y+(noise(i*91+j*13+side*3)-.5)*(5+z*20);
        ctx.fillStyle=`rgba(240,255,250,${.07+z*.24})`;
        ctx.fillRect(px,py,.6+noise(j*17+i)*2,.6+z);
      }
    }
    ctx.restore();
  }
  function wake(t,boatX,boatY,shipW,shipH){
    const start=boatY+shipH*.08, span=Math.max(1,H-start), surge=state.brace?1.35:1;
    ctx.save();
    // The wake is a loose field of foam rather than a solid graphic wedge.
    ctx.globalCompositeOperation='screen';
    // Flecks drift apart at unequal speeds; there is no fixed V outline.
    for(let i=0;i<160;i++){
      const seed=noise(i*37+6), p=(noise(i*17+9)+t*(.13+seed*.12)*surge)%1;
      const side=i%2?-1:1, spread=shipW*(.12+.48*p);
      const x=boatX+side*(spread+(noise(i*73+3)-.5)*shipW*(.07+.13*p))+state.heading*W*.014*p;
      const y=start+span*p+(noise(i*41+12)-.5)*(4+13*p);
      const alpha=(.06+.4*noise(i*59+4))*(1-p*.72);
      const size=(.8+noise(i*83+3)*3.8)*(1+p*.6);
      ctx.fillStyle=`rgba(225,255,247,${alpha})`;
      ctx.beginPath();ctx.ellipse(x,y,size*(1+noise(i*11)*1.8),Math.max(.5,size*.34),side*.18,0,7);ctx.fill();
    }
    for(let i=0;i<32;i++){
      const seed=noise(i*13+7),p=(seed+t*(.08+noise(i*23)*.06)*surge)%1;
      const side=i%2?-1:1,x=boatX+side*shipW*(.13+.4*p),y=start+span*p;
      const len=(5+noise(i*43)*21)*(1+p*.6);
      ctx.beginPath();ctx.moveTo(x-side*len*.45,y+2);
      ctx.quadraticCurveTo(x,y-2-noise(i*19)*5,x+side*len*.55,y+noise(i*61)*4);
      ctx.strokeStyle=`rgba(221,255,247,${(.07+.23*noise(i*71))*(1-p)})`;
      ctx.lineWidth=.7+noise(i*97)*1.5;ctx.stroke();
    }
    ctx.restore();
  }
  function contactFoam(t,boat){
    if(!boat)return;const {x,y,sw,sh}=boat;
    const waterY=y+sh*.225+Math.sin(t*2.1+1.1)*4;
    ctx.save();
    // Repaint the same underlying sea through an uneven mask so water partly covers the stern.
    ctx.beginPath();
    for(let j=0;j<=20;j++){
      const q=j/20,px=x+sw*(q-.5)*.78;
      const crest=waterY+Math.sin(q*13+t*2.3)*3+Math.sin(q*31-t*1.4)*1.7
        +(noise(j*17+3)-.5)*2.5;
      if(j===0)ctx.moveTo(px,crest);else ctx.lineTo(px,crest);
    }
    ctx.lineTo(x+sw*.4,y+sh*.38);ctx.lineTo(x-sw*.4,y+sh*.38);ctx.closePath();
    ctx.clip();
    if(bgCrop&&sea.naturalWidth){ctx.globalAlpha=.72;ctx.drawImage(sea,bgCrop.sx,bgCrop.sy,bgCrop.sw,bgCrop.sh,0,0,W,H);ctx.globalAlpha=1;}
    ctx.restore();ctx.save();
    ctx.globalCompositeOperation='screen';
    for(let i=0;i<22;i++){
      const q=(i+.5)/22,px=x+sw*(q-.5)*.43+(noise(i*17+4)-.5)*sw*.03;
      const py=waterY+(noise(i*31+7)-.5)*9+Math.sin(t*3+i)*2;
      const size=.7+noise(i*43+5)*3.5;
      ctx.fillStyle=`rgba(237,255,249,${.08+.34*noise(i*67+2)})`;
      ctx.beginPath();ctx.ellipse(px,py,size*(1+noise(i*13)),Math.max(.5,size*.42),0,0,7);ctx.fill();
    }
    for(let side of [-1,1]){
      for(let i=0;i<13;i++){
        const q=(i+.5)/13;
        const px=x+side*sw*(.09+.27*q)+(noise(i*37+side*5)-.5)*sw*.035;
        const py=waterY+(noise(i*29+side*7)-.5)*(9+q*12);
        const size=(1.2+noise(i*41+side*17)*4.5)*(1+q*.4);
        ctx.fillStyle=`rgba(229,255,248,${.12+.42*noise(i*71+side*3)})`;
        ctx.beginPath();ctx.ellipse(px,py,size*1.6,Math.max(.6,size*.45),side*.15,0,7);ctx.fill();
      }
      for(let k=0;k<5;k++){
        const q=(k+.4)/5,px=x+side*sw*(.17+.13*q),py=waterY-sh*.06+q*sh*.075;
        ctx.beginPath();ctx.moveTo(px-side*3,py+1);
        ctx.quadraticCurveTo(px,py-3-noise(k*11)*3,px+side*(4+noise(k*19)*8),py+2);
        ctx.strokeStyle=`rgba(230,255,249,${.16+.2*noise(k*23+side)})`;
        ctx.lineWidth=1+noise(k*43);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function vessel(t){
    if(!ship.complete||!ship.naturalWidth)return;
    const narrow=W/H<.8;
    const sh=Math.min(H*(narrow?.49:.48),W*(narrow?1.08:.65));
    const sw=sh*(ship.naturalWidth/ship.naturalHeight);
    const bob=Math.sin(t*2.25)*13+Math.sin(t*4.7+1)*4;
    const x=W*(narrow?.53:.57)+state.heading*W*(narrow?.12:.13)+Math.sin(t*1.35)*5;
    const y=H*(narrow?.68:.72)+bob;
    wake(t,x,y,sw,sh);
    ctx.save();ctx.translate(x,y);
    ctx.rotate(-state.heading*.15+Math.sin(t*1.8)*.075+Math.sin(t*4.1+.7)*.025+state.wind*.03);
    ctx.transform(1,state.heading*.015,state.heading*.12,1+Math.sin(t*2.25)*.012,0,0);
    ctx.shadowColor='#001924';ctx.shadowBlur=18;ctx.shadowOffsetY=8;
    ctx.drawImage(ship,-sw/2,-sh*.69,sw,sh);ctx.restore();
    if(state.brace){ctx.save();ctx.globalCompositeOperation='screen';const gx=x-sw*.18,gy=y-sh*.24;
      const grad=ctx.createRadialGradient(gx,gy,3,gx,gy,sw*.48);
      grad.addColorStop(0,'#d2fff03b');grad.addColorStop(1,'#a8fff000');ctx.fillStyle=grad;
      ctx.beginPath();ctx.arc(gx,gy,sw*.48,0,7);ctx.fill();ctx.restore();}
    return {x,y,sw,sh};
  }
  function spray(t,boat){if(!boat)return;ctx.save();ctx.globalCompositeOperation='screen';const speed=state.brace?1.6:1;for(let i=0;i<90;i++){const seed=noise(i*91+7),cycle=(t*(.4+seed*.4)*speed+noise(i*3))%1;const side=i%2?-1:1;const x=boat.x+side*(boat.sw*.27+cycle*W*.18)+(noise(i*73)-.5)*W*.025;const y=boat.y+boat.sw*.24+cycle*H*.28-(Math.sin(cycle*Math.PI)*12);if(y>H+10)continue;const a=(1-cycle)*(.18+seed*.52);ctx.fillStyle=`rgba(221,255,247,${a})`;ctx.beginPath();ctx.arc(x,y,(.5+seed*2.1)*(W/H<.8?.75:1),0,7);ctx.fill();}ctx.restore();}
  function gust(t){if(t<5.1||t>7.8)return;const a=smooth(5.1,5.6,t)*(1-smooth(7.1,7.8,t));ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<15;i++){const y=H*(.22+noise(i*41)*.64);const x=((t*240+i*113)%(W+320))-160;ctx.strokeStyle=`rgba(211,251,243,${a*(.06+noise(i*9)*.1)})`;ctx.lineWidth=1+noise(i*51)*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+50+noise(i*7)*100,y-15);ctx.stroke();}ctx.restore();}
  function render(){if(!W||!H)return;const t=state.time;ctx.setTransform(dpr,0,0,dpr,0,0);background(t);waveBands(t);foam(t);gust(t);const boat=vessel(t);contactFoam(t,boat);spray(t,boat);const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#071f3000');grad.addColorStop(1,'#00152370');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);}
  function hud(){const t=state.time;$('seconds').textContent=(10-t).toFixed(1);$('distance').textContent=Math.floor(state.progress)+'%';$('routeFill').style.width=state.progress+'%';$('needle').style.left=(50+state.heading*42)+'%';$('headingText').textContent=Math.abs(state.heading)<.18?'바람문 정면':state.heading<0?'왼쪽으로 '+Math.round(Math.abs(state.heading)*38)+'°':'오른쪽으로 '+Math.round(Math.abs(state.heading)*38)+'°';$('windArrow').style.transform=`rotate(${state.wind*75-25}deg)`;$('windText').textContent=state.wind>.33?'강한 돌풍':state.wind<-.24?'역풍':'순풍';if(t>5.1&&t<7.7)$('guide').textContent='돌풍! 조타를 유지하고 돛을 당겨라';else if(t>1.3)$('guide').textContent='바람문 정면을 유지하라';}
  function frame(now){let dt=clamp((now-last)/1000,0,.05);last=now;update(dt);render();hud();state.frame++;requestAnimationFrame(frame);}
  Promise.all([sea.decode(),ship.decode()]).then(()=>{state.ready=true;$('load').classList.add('hide');requestAnimationFrame(frame)}).catch(e=>{$('load').textContent='자산을 읽을 수 없습니다';console.error(e)});
  window.__pilot37={state,reset:begin,setTime(t){state.time=clamp(t,0,10)},render,assetsReady:()=>sea.complete&&ship.complete&&sea.naturalWidth>0&&ship.naturalWidth>0};
})();
