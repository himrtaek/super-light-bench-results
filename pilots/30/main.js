// NEON RIFF: original 2.5D character art over a dependency-free WebGL2 stage.
// Character asset provenance and prompts are recorded in ASSETS.md.
const canvas = document.querySelector('#stage');
const overlay = document.querySelector('#fx');
const ink = overlay.getContext('2d');
const art={};
for(const name of ['hero-idle','hero-strike','robot-idle','robot-hit']){
  const img=new Image();img.decoding='async';img.src=`./assets/${name}.webp`;art[name]=img;
}
const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance' });
if (!gl) {
  document.querySelector('#prompt').textContent = 'WebGL 2 is required to play';
  throw new Error('WebGL 2 unavailable');
}

const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel, uViewProj;
uniform float uOutline;
out vec3 vNormal;
out vec3 vWorld;
void main(){
  vec4 world = uModel * vec4(aPosition + aNormal*uOutline, 1.0);
  vWorld=world.xyz;
  vNormal=mat3(uModel)*aNormal;
  gl_Position=uViewProj*world;
}`;
const fs = `#version 300 es
precision highp float;
in vec3 vNormal, vWorld;
uniform vec3 uColor;
uniform float uEmissive, uInk;
out vec4 outColor;
void main(){
  if(uInk>0.5){outColor=vec4(0.038,0.026,0.095,1.0);return;}
  vec3 n=normalize(vNormal);
  float light=max(dot(n,normalize(vec3(-0.55,0.9,0.7))),0.0);
  float shade=light>0.75?1.18:light>0.38?0.98:0.73;
  float rim=pow(1.0-max(dot(n,normalize(vec3(0.0,0.25,1.0))),0.0),3.0);
  vec3 c=uColor*mix(shade,1.0,uEmissive)+uColor*rim*0.18;
  float fog=clamp((length(vWorld.xz)-7.0)/18.0,0.0,0.65);
  outColor=vec4(mix(c,vec3(0.13,0.07,0.24),fog),1.0);
}`;
function shader(type, source) {
  const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const U=Object.fromEntries(['uModel','uViewProj','uOutline','uColor','uEmissive','uInk'].map(k=>[k,gl.getUniformLocation(program,k)]));

const M={
  id:()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o},
  t(x,y,z){let m=M.id();m[12]=x;m[13]=y;m[14]=z;return m},
  s(x,y,z){let m=M.id();m[0]=x;m[5]=y;m[10]=z;return m},
  rx(a){let m=M.id(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m},
  ry(a){let m=M.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m},
  rz(a){let m=M.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m},
  compose(p,t=[0,0,0],r=[0,0,0],s=[1,1,1]){let m=M.mul(p,M.t(...t));m=M.mul(m,M.rz(r[2]));m=M.mul(m,M.ry(r[1]));m=M.mul(m,M.rx(r[0]));return M.mul(m,M.s(...s))},
  perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o},
  look(eye,target){const norm=v=>{let l=Math.hypot(...v);return v.map(a=>a/l)},sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];let z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((a,v,i)=>a+v*eye[i],0),-y.reduce((a,v,i)=>a+v*eye[i],0),-z.reduce((a,v,i)=>a+v*eye[i],0),1])},
  point(m,p){let [x,y,z]=p;return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]]}
};
const I=M.id();
function makeGeometry(data){
  let vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
  gl.bindVertexArray(null);return {vao,count:data.length/6};
}
function addTri(a,b,c,n,out){for(const p of [a,b,c])out.push(...p,...n)}
function box(){let o=[];for(const [n,pts] of [
 [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
 [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
 [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],
 [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
 [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
 [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
 ]){addTri(pts[0],pts[1],pts[2],n,o);addTri(pts[0],pts[2],pts[3],n,o)}return makeGeometry(o)}
function cylinder(segments=12,top=.5,bottom=.5){let o=[];for(let i=0;i<segments;i++){let a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;let p=[Math.cos(a),Math.sin(a)],q=[Math.cos(b),Math.sin(b)];let n=[Math.cos((a+b)/2),0,Math.sin((a+b)/2)];let v0=[p[0]*bottom,-.5,p[1]*bottom],v1=[q[0]*bottom,-.5,q[1]*bottom],v2=[q[0]*top,.5,q[1]*top],v3=[p[0]*top,.5,p[1]*top];addTri(v0,v1,v2,n,o);addTri(v0,v2,v3,n,o);addTri([0,.5,0],v3,v2,[0,1,0],o);addTri([0,-.5,0],v1,v0,[0,-1,0],o)}return makeGeometry(o)}
function sphere(lat=8,lon=12){let o=[];for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){let a=j*Math.PI/lat,b=(j+1)*Math.PI/lat,p=i*2*Math.PI/lon,q=(i+1)*2*Math.PI/lon;let v=(t,u)=>[Math.sin(t)*Math.cos(u)*.5,Math.cos(t)*.5,Math.sin(t)*Math.sin(u)*.5];let A=v(a,p),B=v(b,p),C=v(b,q),D=v(a,q);for(const [x,y,z] of [[A,B,C],[A,C,D]]){for(let h of [x,y,z])o.push(...h,...h.map(k=>k*2))}}return makeGeometry(o)}
const G={box:box(),cyl:cylinder(),sphere:sphere()};
const C={ink:'#120d29',floor:'#413061',floor2:'#5d3d7b',purple:'#523787',violet:'#9060b9',pink:'#ff3d8c',orange:'#ff8a37',yellow:'#ffe341',teal:'#3ef0e1',blue:'#4f9bf8',white:'#f8f2ee',dark:'#20233f',steel:'#646b8c',skin:'#f6a36f',hair:'#45d8c9',shadow:'#22162f'};
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)}
const colors=Object.fromEntries(Object.entries(C).map(([k,v])=>[k,rgb(v)]));
let staticParts=[];
function queue(g,t,r,s,c,outline=.025,em=0){staticParts.push({g,m:M.compose(I,t,r,s),c,outline,em})}
function render(g,m,c,outline=.03,em=0){
  const geom=G[g];gl.bindVertexArray(geom.vao);gl.uniformMatrix4fv(U.uModel,false,m);gl.uniform3fv(U.uColor,colors[c]);gl.uniform1f(U.uEmissive,em);
  if(outline){gl.cullFace(gl.FRONT);gl.uniform1f(U.uInk,1);gl.uniform1f(U.uOutline,outline);gl.drawArrays(gl.TRIANGLES,0,geom.count)}
  gl.cullFace(gl.BACK);gl.uniform1f(U.uInk,0);gl.uniform1f(U.uOutline,0);gl.drawArrays(gl.TRIANGLES,0,geom.count);
}
// Sparse perspective floor accents sit over the painted arena and remain true 3D.
for(let i=-3;i<=3;i++){
  const x=i*1.7;
  queue('box',[x,-.07,3.9],[0,0,(i%3-1)*.08],[.72,.018,.055],i%2?'pink':'teal',0,1);
  queue('box',[x*.73,-.065,-.75],[0,0,(i%3-1)*.15],[.35,.02,.06],i%2?'yellow':'teal',0,1);
}
for(const x of [-5.1,5.1]){
  queue('box',[x,.16,1.7],[0,0,0],[.46,.22,.55],'dark',.02);
  queue('box',[x,.29,1.85],[0,0,0],[.39,.045,.07],'pink',0,1);
}

const state={score:0,combo:0,hp:1,rank:'C',lastStrike:-9,attackAt:-9,impactAt:-9,koAt:-9,beatIndex:-1,perfect:false,strikes:0,start:performance.now(),time:0,shake:0,audio:null,cameraYaw:.14};
const beat=0.5;
function audioStrike(good){
  try{
    const ac=state.audio||(state.audio=new (window.AudioContext||window.webkitAudioContext)());
    if(ac.state==='suspended')ac.resume();
    const now=ac.currentTime;
    for(let i=0;i<2;i++){
      let osc=ac.createOscillator(),gain=ac.createGain();osc.type=i?'sawtooth':'triangle';
      osc.frequency.setValueAtTime((good?460:290)*(i?1.5:1),now);osc.frequency.exponentialRampToValueAtTime(i?95:58,now+.22);
      gain.gain.setValueAtTime(i?.09:.18,now);gain.gain.exponentialRampToValueAtTime(.001,now+.27);
      osc.connect(gain).connect(ac.destination);osc.start(now);osc.stop(now+.28);
    }
  }catch(e){}
}
function audioBeat(){
  const ac=state.audio;if(!ac)return;
  try{
    let now=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(120,now);osc.frequency.exponentialRampToValueAtTime(50,now+.1);
    gain.gain.setValueAtTime(.08,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);
    osc.connect(gain).connect(ac.destination);osc.start(now);osc.stop(now+.13);
  }catch(e){}
}
function strike(){
  const t=state.time;if(t-state.lastStrike<.27||t-state.koAt<1.1)return;
  const offset=Math.min(t%beat,beat-(t%beat));
  const good=offset<.13;
  state.lastStrike=t;state.attackAt=t;state.impactAt=t+.1;state.perfect=good;state.strikes++;
  state.score+=good?1250+state.combo*120:320;
  state.combo=good?state.combo+1:0;
  state.hp=Math.max(0,state.hp-(good?.34:.11));
  if(state.hp<=0){state.hp=0;state.koAt=t;state.score+=2500}
  state.rank=state.combo>=6?'S':state.combo>=3?'A':state.combo>=1?'B':'C';
  state.shake=good?1:.42;
  audioStrike(good);
  state.beatIndex=Math.floor(t/beat);
  document.querySelector('#score').textContent=String(state.score).padStart(6,'0');
  document.querySelector('#combo').innerHTML=state.combo+' <small>COMBO</small>';
  document.querySelector('#rank').textContent=state.rank;
  document.querySelector('#target>span').style.width=(state.hp*100)+'%';
  document.querySelector('#prompt').style.opacity=state.strikes?'.35':'1';
}
window.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)strike()}},{passive:false});
window.addEventListener('pointerdown',e=>{e.preventDefault();strike()},{passive:false});
window.__pilot30={state,strike,setCameraAngle(angle){state.cameraYaw=angle;cameraView()},get assetsReady(){return Object.values(art).every(img=>img.complete&&img.naturalWidth>0)}};

let heroX=-2.05,enemyX=1.65,portrait=false;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function attackMotion(t){
  const dt=t-state.attackAt;
  if(dt<0||dt>.55)return {pose:0,blade:1.3};
  const pose=dt<.12?smooth(dt/.12):dt<.32?1:1-smooth((dt-.32)/.23);
  const blade=dt<.12?1.3-.6*smooth(dt/.12):dt<.32?.7:dt<.43?.7-.92*smooth((dt-.32)/.11):-.22+1.52*smooth((dt-.43)/.12);
  return {pose,blade};
}
let viewProj=I,width=1,height=1,dpr=1;
function resize(){
  width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
  portrait=width/height<1.1;
  heroX=portrait?-1.03:-2.05;
  enemyX=portrait?1.18:1.65;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  overlay.width=canvas.width;overlay.height=canvas.height;
  canvas.style.width=overlay.style.width=width+'px';canvas.style.height=overlay.style.height=height+'px';
  gl.viewport(0,0,canvas.width,canvas.height);
  cameraView(state.time);
}
function cameraView(t=state.time){
  const aspect=width/height;
  const age=t-state.impactAt,hitFocus=age>-.04&&age<.32?1-smooth(Math.max(0,age)/.32):0;
  const dist=(portrait?13.9:8.9)-hitFocus*(portrait?.55:.65);
  const focusX=hitFocus*(portrait?.2:.43);
  const cam=[Math.sin(state.cameraYaw)*dist+focusX,portrait?3.15:3.7,Math.cos(state.cameraYaw)*dist];
  viewProj=M.mul(M.perspective((portrait?50:43)*Math.PI/180,aspect,.1,80),M.look(cam,[focusX,portrait?1.0:1.65,-.3]));
  gl.uniformMatrix4fv(U.uViewProj,false,viewProj);
}
window.addEventListener('resize',resize);resize();
function screen(p){const q=M.point(viewProj,p);return [(q[0]/q[3]*.5+.5)*overlay.width,(-q[1]/q[3]*.5+.5)*overlay.height]}
function sprite(name,x,footY,height,anchor,alpha=1,rotation=0){
  const img=art[name];if(!img.complete||!img.naturalWidth||alpha<=0)return;
  const width=height*img.naturalWidth/img.naturalHeight;
  ink.save();ink.globalAlpha=alpha;ink.translate(x,footY);ink.rotate(rotation);ink.drawImage(img,-width*anchor,-height,width,height);ink.restore();
}
function fx(t){
  ink.clearRect(0,0,overlay.width,overlay.height);ink.save();ink.scale(dpr,dpr);
  const b=1-Math.min((t%beat)/.22,1);
  // Pulsing floor halo and the repeated stage-rhythm echo.
  const lunge=attackMotion(t).pose*(portrait?.2:.58);
  let [hx,hy]=screen([heroX+lunge,.05,.9]);hx/=dpr;hy/=dpr;
  let [rx,ry]=screen([enemyX,.05,-.42]);rx/=dpr;ry/=dpr;
  const heroTop=screen([heroX,3.2,.9])[1]/dpr;
  const robotTop=screen([enemyX,3.2,-.42])[1]/dpr;
  const heroH=(hy-heroTop)*1.08*(portrait?1.08:1),robotH=(ry-robotTop)*1.06*(portrait?1.08:1);
  if(portrait){hy+=32;ry+=32}
  const robotW=robotH*(art['robot-idle'].naturalWidth||1)/(art['robot-idle'].naturalHeight||1);
  const hitAge=t-state.impactAt,attackAge=t-state.attackAt;
  const hitMix=state.koAt>0&&t-state.koAt<1.1?1:hitAge>=0&&hitAge<.52?1-smooth(Math.max(0,hitAge-.34)/.18):0;
  const strikeMix=attackAge>=0&&attackAge<.55?Math.min(1,attackAge/.055,1-smooth(Math.max(0,attackAge-.36)/.19)):0;
  const lean=hitMix*(portrait?.10:.19),recoilX=hitMix*(portrait?-8:16);
  const hitH=robotH*1.04,hitW=hitH*(art['robot-hit'].naturalWidth||1)/(art['robot-hit'].naturalHeight||1);
  const idleCx=rx-robotW*.045,idleCy=ry-robotH*.73;
  const hitCx=rx+recoilX-hitW*.034*Math.cos(lean)+hitH*.746*Math.sin(lean);
  const hitCy=ry+hitMix*3-hitW*.034*Math.sin(lean)-hitH*.746*Math.cos(lean);
  const cx=idleCx*(1-hitMix)+hitCx*hitMix,cy=idleCy*(1-hitMix)+hitCy*hitMix;
  ink.globalAlpha=.35+b*.24;ink.strokeStyle='#7df9eb';ink.lineWidth=3+b*4;ink.beginPath();ink.ellipse(hx,hy+3,60+b*14,16+b*4,0,0,Math.PI*2);ink.stroke();ink.globalAlpha=1;
  ink.fillStyle='rgba(8,5,27,.52)';ink.beginPath();ink.ellipse(rx,ry+2,robotH*.35,robotH*.07,0,0,Math.PI*2);ink.fill();
  const a=t-state.impactAt;
  if(a>=0&&a<.46){
    const strength=a<.17?1:1-smooth((a-.17)/.29),S=portrait?.73:1;
    ink.save();ink.translate(cx,cy);ink.rotate(-.2);ink.globalAlpha=strength;
    // The large white crescent sits behind the robot, preserving its recoil silhouette.
    for(const [color,width] of [['#15102b',51],['#ff469c',43],['#32dff1',34],['#fff',22]]){
      ink.strokeStyle=color;ink.lineWidth=width*S;ink.lineCap='round';ink.beginPath();
      ink.ellipse(0,0,148*S,107*S,-.25,2.28,5.68);ink.stroke();
    }
    ink.restore();
  }
  sprite('robot-idle',rx,ry,robotH,.45,1-hitMix);
  sprite('robot-hit',rx+recoilX,ry+hitMix*3,hitH,.49,hitMix,lean);
  sprite('hero-idle',hx,hy,heroH,.49,1-strikeMix);
  sprite('hero-strike',hx+strikeMix*(portrait?35:10),hy,heroH*(portrait?.75:1.02),portrait?.44:.55,strikeMix);
  // The arc starts at the player's wrist and terminates on the robot's core.
  const swing=t-state.attackAt;
  if(swing>=0&&swing<.42){
    let sx=hx+(portrait?15:25),sy=hy-heroH*.58;
    const reveal=smooth(Math.min(1,swing/.11));
    const ex=sx+(cx-sx)*reveal,ey=sy+(cy-sy)*reveal;
    ink.save();ink.globalAlpha=(1-smooth(Math.max(0,swing-.1)/.32))*.95;
    for(const [color,lineWidth] of [['#15102f',34],['#ff4b94',27],['#ffae33',19],['#fff1a5',9],['#fff',3]]){
      ink.strokeStyle=color;ink.lineWidth=lineWidth;ink.lineCap='round';ink.beginPath();ink.moveTo(sx,sy);
      ink.quadraticCurveTo((sx+ex)/2,Math.min(sy,ey)-43,ex,ey);ink.stroke();
    }
    ink.restore();
  }
  if(a>=0&&a<.48){
    const strength=a<.16?1:1-smooth((a-.16)/.32),S=portrait?.72:1;
    ink.save();ink.translate(cx,cy);ink.rotate(-.14);ink.globalAlpha=strength;
    // Three crisp radial layers all originate at the animated chest contact.
    const glow=ink.createRadialGradient(0,0,2,0,0,132*S);
    glow.addColorStop(0,'rgba(255,255,255,.95)');glow.addColorStop(.26,'rgba(255,228,57,.8)');
    glow.addColorStop(.62,'rgba(255,57,144,.35)');glow.addColorStop(1,'rgba(255,57,144,0)');
    ink.fillStyle=glow;ink.fillRect(-135*S,-135*S,270*S,270*S);
    for(let i=0;i<20;i++){
      const theta=i*Math.PI*2/20+state.strikes*.09,outer=(i%4===0?172:i%2?116:141)*S*(1+a*.5);
      const inner=24*S,half=(i%3===0?.085:.053);
      ink.fillStyle=i%4===0?'#fff':i%3===0?'#ffe354':i%2?'#25e9f0':'#ff378b';
      ink.beginPath();ink.moveTo(Math.cos(theta-half)*inner,Math.sin(theta-half)*inner);
      ink.lineTo(Math.cos(theta)*outer,Math.sin(theta)*outer);
      ink.lineTo(Math.cos(theta+half)*inner,Math.sin(theta+half)*inner);ink.closePath();ink.fill();
    }
    // A short blade glint crosses the core without hiding the recoil pose.
    for(const [color,lineWidth] of [['#17102b',34],['#fa3e8b',29],['#29ecf0',22],['#fff',15]]){
      ink.strokeStyle=color;ink.lineWidth=lineWidth*S;ink.lineCap='round';ink.beginPath();
      ink.moveTo(-66*S,43*S);ink.quadraticCurveTo(-5*S,-8*S,70*S,-42*S);ink.stroke();
    }
    ink.fillStyle='#fff';ink.beginPath();ink.arc(0,0,27*S,0,Math.PI*2);ink.fill();
    ink.fillStyle='#fff4b5';ink.beginPath();ink.arc(0,0,14*S,0,Math.PI*2);ink.fill();
    ink.restore();
    // Recover armor contours through the flare while keeping the core white-hot.
    sprite('robot-hit',rx+recoilX,ry+hitMix*3,hitH,.49,hitMix*.48,lean);
    ink.fillStyle='#fff';ink.beginPath();ink.arc(cx,cy,8*S,0,Math.PI*2);ink.fill();
  }
  ink.restore();
  const flash=document.querySelector('#flash');
  if(a>=0&&a<.55){flash.textContent=state.koAt===state.lastStrike?'OVERLOAD!':state.perfect?'PERFECT!':'HIT!';flash.style.color=state.perfect?'#ffe43a':'#fff';flash.style.left=(cx+(portrait?-10:95))+'px';flash.style.top=(cy+(portrait?138:112))+'px';flash.style.opacity=String(Math.max(0,1-a/.55));flash.style.transform=`translate(-50%,-50%) rotate(-8deg) scale(${1.12-a*.32})`}
  else flash.style.opacity='0';
  const pulse=document.querySelector('#pulse');pulse.style.transform=`translate(-50%,-50%) scale(${1+b*.33})`;pulse.style.background=b>.35?'#ffe341':'#fb447d';
}
function frame(now){
  const t=state.time=Number.isFinite(state.freezeAt)?state.freezeAt:(now-state.start)/1000;
  if(state.koAt>0&&t-state.koAt>1.1){state.koAt=-9;state.hp=1;document.querySelector('#target>span').style.width='100%'}
  const beatIndex=Math.floor(t/beat);
  if(state.audio&&beatIndex!==state.beatIndex){audioBeat();state.beatIndex=beatIndex}
  cameraView(t);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);gl.uniformMatrix4fv(U.uViewProj,false,viewProj);
  for(let o of staticParts)render(o.g,o.m,o.c,o.outline,o.em);
  fx(t);
  state.shake*=.9;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
