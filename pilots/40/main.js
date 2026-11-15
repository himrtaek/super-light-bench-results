(() => {
  'use strict';
  const COLS = 7, ROWS = 11;
  const chains = [
    {kind:'botanical', names:['Acorn','Luminous Seed','Copper Sprout','Starleaf Sapling'], images:['acorn','seed','sprout','sapling']},
    {kind:'crystal', names:['Raw Quartz','Moonstone','Prismatic Lens','Crystal Lantern'], images:['quartz','moonstone','prism','lantern']},
    {kind:'clockwork', names:['Brass Gear','Pocket Clock','Astrolabe','Mini Observatory'], images:['gear','clock','astrolabe','observatory']}
  ];
  const orders = [
    {type:1, level:2, reward:100, title:'Prismatic Lens', detail:'Merge two Moonstones to craft it'},
    {type:0, level:3, reward:150, title:'Starleaf Sapling', detail:'Merge two Copper Sprouts to craft it'},
    {type:2, level:2, reward:120, title:'Astrolabe', detail:'Merge two Pocket Clocks to craft it'}
  ];
  const $ = id => document.getElementById(id);
  const boardEl=$('board'), effects=$('effects'), ghost=$('drag-ghost');
  let cells=[], score=0, coins=240, energy=12, orderStep=0, discovery=0, selected=-1, drag=null;
  const item=(type,level)=>({type,level});
  const same=(a,b)=>a&&b&&a.type===b.type&&a.level===b.level&&a.level<3;
  const imageFor=v=>`assets/${chains[v.type].images[v.level]}.webp`;
  const titleFor=v=>chains[v.type].names[v.level];
  function initialBoard(){
    let state=7941;
    const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
    const empty=new Set([0,7,14,27,41,48,69,76]);
    const out=Array.from({length:COLS*ROWS},(_,i)=>{
      if(empty.has(i))return null;
      const type=Math.floor(random()*3),r=random();
      let level=r<.34?0:r<.64?1:r<.87?2:3;
      if(type===1&&level===2)level=3;
      if(type===0&&level===3)level=2;
      return item(type,level);
    });
    out[32]=item(1,1);out[33]=item(1,1);
    out[60]=item(0,2);out[61]=item(0,2);
    out[18]=item(2,1);out[19]=item(2,1);
    out[10]=item(2,3);
    return out;
  }
  function setMessage(text){$('message').textContent=text;$('announcer').textContent=text}
  function updateHUD(){
    $('score').textContent=score.toLocaleString();$('score').dataset.score=String(score);
    $('coins').textContent=coins.toLocaleString();$('energy').textContent=String(energy);
    const order=orders[orderStep%orders.length];
    $('order-title').textContent=order.title;$('order-desc').textContent=order.detail;
    document.querySelector('.order-prize span').textContent=`✧ ${order.reward}`;
    const ready=cells.some(v=>v&&v.type===order.type&&v.level===order.level);
    $('deliver').disabled=!ready;$('deliver').classList.toggle('ready',ready);
    $('create').disabled=energy<=0||!cells.some(v=>!v);
    $('progress-fill').style.width=`${Math.min(100,(score%600)/6)}%`;
  }
  function render(){
    boardEl.replaceChildren();
    cells.forEach((v,index)=>{
      const el=document.createElement('button');el.type='button';el.className='cell'+(!v?' empty':'')+(selected===index?' selected':'')+(v&&v.level>=2?' rare':'');
      el.setAttribute('role','gridcell');el.dataset.index=String(index);
      el.setAttribute('aria-label',v?`${titleFor(v)}, row ${Math.floor(index/COLS)+1}, column ${index%COLS+1}`:`Empty cell, row ${Math.floor(index/COLS)+1}, column ${index%COLS+1}`);
      if(v){el.dataset.kind=chains[v.type].kind;el.dataset.level=String(v.level);const tile=document.createElement('span');tile.className='tile';const img=document.createElement('img');img.src=imageFor(v);img.alt='';img.draggable=false;tile.append(img);el.append(tile)}
      if(selected>=0&&v&&same(cells[selected],v)&&selected!==index)el.classList.add('match');
      boardEl.append(el);
    });
    updateHUD();
  }
  function floatAt(index,text){
    const el=boardEl.children[index],a=el.getBoundingClientRect(),root=document.querySelector('.game').getBoundingClientRect();
    const f=document.createElement('div');f.className='float-score';f.textContent=text;f.style.left=`${a.left-root.left+a.width/2-20}px`;f.style.top=`${a.top-root.top+5}px`;effects.append(f);setTimeout(()=>f.remove(),850);
  }
  function sparkle(index){
    const a=boardEl.children[index].getBoundingClientRect(),root=document.querySelector('.game').getBoundingClientRect();
    const x=a.left-root.left+a.width/2,y=a.top-root.top+a.height/2;
    for(let i=0;i<14;i++){
      const s=document.createElement('i');s.className='burst';const angle=i*2.39996,dist=25+(i%4)*8;
      s.style.left=`${x-5}px`;s.style.top=`${y-5}px`;s.style.setProperty('--dx',`${Math.cos(angle)*dist}px`);s.style.setProperty('--dy',`${Math.sin(angle)*dist}px`);
      effects.append(s);setTimeout(()=>s.remove(),700);
    }
  }
  function toast(text){const el=document.createElement('div');el.className='toast';el.textContent=text;effects.append(el);setTimeout(()=>el.remove(),1000)}
  function merge(from,to){
    if(from===to||!same(cells[from],cells[to]))return false;
    const old=cells[to],newLevel=old.level+1;
    cells[to]=item(old.type,newLevel);cells[from]=null;selected=-1;
    const gained=30*(newLevel+1);score+=gained;
    render();boardEl.children[to].classList.add('merging');sparkle(to);floatAt(to,`+${gained}`);
    setMessage(`${titleFor(cells[to])} crafted! Check your order.`);
    return true;
  }
  function tap(index){
    const v=cells[index];
    if(!v){selected=-1;render();return}
    if(selected>=0&&selected!==index&&merge(selected,index))return;
    if(selected===index){selected=-1;setMessage(`${titleFor(v)} tucked away.`)}
    else{selected=index;setMessage(`Tap a matching ${titleFor(v)} to merge.`)}
    render();
  }
  function move(from,to){
    if(from===to)return;
    if(merge(from,to))return;
    if(!cells[to]){cells[to]=cells[from];cells[from]=null;selected=-1;render();setMessage(`${titleFor(cells[to])} moved.`);return}
    selected=from;render();setMessage('Match identical relics of the same level.');
  }
  function cellAt(x,y){const el=document.elementFromPoint(x,y)?.closest('.cell');return el&&boardEl.contains(el)?Number(el.dataset.index):-1}
  boardEl.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const from=cellAt(e.clientX,e.clientY);if(from<0)return;
    drag={from,x:e.clientX,y:e.clientY,moved:false};boardEl.setPointerCapture(e.pointerId);
  });
  boardEl.addEventListener('pointermove',e=>{
    if(!drag)return;const distance=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
    if(distance>8&&cells[drag.from]){drag.moved=true;ghost.replaceChildren();const img=document.createElement('img');img.src=imageFor(cells[drag.from]);ghost.append(img);ghost.style.display='grid';ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`}
  });
  boardEl.addEventListener('pointerup',e=>{
    if(!drag)return;const {from,moved}=drag,to=cellAt(e.clientX,e.clientY);drag=null;ghost.style.display='none';
    if(moved&&to>=0)move(from,to);else if(!moved)tap(from);
  });
  boardEl.addEventListener('pointercancel',()=>{drag=null;ghost.style.display='none'});
  boardEl.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.cell')){e.preventDefault();tap(Number(e.target.dataset.index))}});
  $('create').addEventListener('click',()=>{
    const empty=cells.findIndex(v=>!v);if(empty<0||energy<=0)return;
    const sequence=[1,0,2,1,2,0];const type=sequence[discovery++%sequence.length];
    cells[empty]=item(type,0);energy--;selected=-1;render();sparkle(empty);setMessage(`${titleFor(cells[empty])} discovered.`);
  });
  $('deliver').addEventListener('click',()=>{
    const order=orders[orderStep%orders.length];const index=cells.findIndex(v=>v&&v.type===order.type&&v.level===order.level);if(index<0)return;
    cells[index]=null;coins+=order.reward;score+=order.reward*2;energy=Math.min(20,energy+2);orderStep++;selected=-1;
    render();sparkle(index);floatAt(index,`+${order.reward*2}`);toast('Order fulfilled!');
    setMessage(`Order complete! +${order.reward} coins, +2 energy.`);
  });
  $('reset').addEventListener('click',()=>{cells=initialBoard();score=0;coins=240;energy=12;orderStep=0;discovery=0;selected=-1;render();setMessage('Fresh board. Drag or tap matching relics.')});
  cells=initialBoard();render();
})();
