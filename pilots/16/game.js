/* Original, playable visual pilot. No reference media or third-party assets. */
(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  const params = new URLSearchParams(location.search);
  const capture = params.has('capture');
  let seed = Number(params.get('seed') || 1607) >>> 0;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const atlas = new Image();
  let artReady = false;
  atlas.onload = () => { artReady = true; draw(); };
  atlas.onerror = () => { artReady = false; draw(); };
  atlas.src = 'assets/astral-pieces-v2.webp';
  const cols = 7, rows = 8, kinds = 5;
  const icons = ['✦','☾','✧','✿','◉'];
  const colors = ['#f6a23c','#29c79d','#397ef3','#ed55ad','#42cad5'];
  const board = Array.from({ length: rows }, () => Array(cols).fill(0));
  let moves = 24, score = 0, combo = 0, selected = null, pressed = null;
  const collected = [0,0,0];
  let busy = false, pulse = [], newest = [], stableAt = 0, lastFrame = 0;
  let logicalW = 390, logicalH = 700, dpr = 1, cell = 43, boardX = 0, boardY = 0;
  const key = (r, c) => `${r}:${c}`;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const capTime = Number(params.get('t') || 0);
  const now = () => capture ? capTime * 1000 : performance.now();
  function rounded(x, y, w, h, r, fill, stroke, sw = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function text(s, x, y, size, color = '#fff9e8', weight = 700, align = 'center') {
    ctx.font = `${weight} ${size}px system-ui,-apple-system,sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#101327'; ctx.fillText(s, x + 1.5, y + 2);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function matches() {
    const found = new Set();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = board[r][c];
      if (k < 0) continue;
      if (c < cols - 2 && board[r][c+1] === k && board[r][c+2] === k) {
        let i = c; while (i < cols && board[r][i] === k) found.add(key(r, i++));
      }
      if (r < rows - 2 && board[r+1][c] === k && board[r+2][c] === k) {
        let i = r; while (i < rows && board[i][c] === k) found.add(key(i++, c));
      }
    }
    return found;
  }
  function initialize() {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let choice;
      do { choice = Math.floor(rand() * kinds); }
      while ((c >= 2 && board[r][c-1] === choice && board[r][c-2] === choice) ||
             (r >= 2 && board[r-1][c] === choice && board[r-2][c] === choice));
      board[r][c] = choice;
    }
    // Guarantee a productive first move without making the board a scripted image.
    if (!hasMove()) {
      board[2][2] = 0; board[2][3] = 0; board[3][4] = 0; board[2][4] = 1; board[3][3] = 1;
    }
  }
  function swap(a, b) {
    [board[a.r][a.c], board[b.r][b.c]] = [board[b.r][b.c], board[a.r][a.c]];
  }
  function hasMove() {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of [[0,1],[1,0]]) {
        const nr = r+dr, nc = c+dc;
        if (nr >= rows || nc >= cols) continue;
        swap({r,c}, {r:nr,c:nc});
        const works = matches().size > 0;
        swap({r,c}, {r:nr,c:nc});
        if (works) return true;
      }
    }
    return false;
  }
  function firstLegalMove() {
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) for (const [dr,dc] of [[0,1],[1,0]]) {
      const nr=r+dr,nc=c+dc; if(nr>=rows||nc>=cols) continue;
      const a={r,c},b={r:nr,c:nc}; swap(a,b); const legal=matches().size>0; swap(a,b);
      if(legal) return [a,b];
    }
    return null;
  }
  function advanceCapture(seconds) {
    const count=seconds<3?0:seconds<7?1:2;
    for(let i=0;i<count;i++) {
      const move=firstLegalMove(); if(!move)break;
      swap(...move); moves--; let chain=0;
      while(chain<12) {
        const hit=matches(); if(!hit.size) break;
        chain++; score+=hit.size*100*chain;
        for(const id of hit) { const [r,c]=id.split(':').map(Number); const type=board[r][c]; if(type===0)collected[0]++; if(type===2)collected[1]++; if(type===3)collected[2]++; }
        for(const id of hit) { const [r,c]=id.split(':').map(Number); board[r][c]=-1; }
        for(let c=0;c<cols;c++) {
          const old=[];for(let r=rows-1;r>=0;r--)if(board[r][c]>=0)old.push(board[r][c]);
          for(let r=rows-1,j=0;r>=0;r--,j++)board[r][c]=j<old.length?old[j]:Math.floor(rand()*kinds);
        }
      }
    }
    combo=count;
  }
  function resize() {
    const width = innerWidth, height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const landscape = width > height * 1.22;
    logicalW = landscape ? 720 : 390;
    logicalH = landscape ? 400 : 700;
    ctx.setTransform(canvas.width/logicalW,0,0,canvas.height/logicalH,0,0);
    cell = landscape ? Math.min(37, (logicalH - 70) / rows) : Math.min(47, (logicalH - 250) / rows);
    boardX = landscape ? 237 : (logicalW - cell*cols)/2;
    boardY = landscape ? (logicalH - cell*rows)/2 : 160;
    draw();
  }
  function boardHit(x, y) {
    const c = Math.floor((x-boardX)/cell), r = Math.floor((y-boardY)/cell);
    return c >= 0 && c < cols && r >= 0 && r < rows ? {r,c} : null;
  }
  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*logicalW/rect.width, y:(e.clientY-rect.top)*logicalH/rect.height };
  }
  async function makeMove(a, b) {
    if (busy || moves <= 0 || !a || !b || Math.abs(a.r-b.r)+Math.abs(a.c-b.c) !== 1) return;
    busy = true; selected = null; swap(a,b); stableAt = performance.now();
    await sleep(150);
    if (!matches().size) { swap(a,b); busy = false; draw(); return; }
    moves--; combo = 0;
    for (let chain = 0; chain < 12; chain++) {
      const hit = matches();
      if (!hit.size) break;
      combo++; pulse = [...hit]; score += hit.size * 100 * combo;
      for(const id of hit) { const [r,c]=id.split(':').map(Number); const type=board[r][c]; if(type===0)collected[0]++; if(type===2)collected[1]++; if(type===3)collected[2]++; }
      draw(); await sleep(230);
      for (const id of hit) { const [r,c] = id.split(':').map(Number); board[r][c] = -1; }
      newest = [];
      for (let c = 0; c < cols; c++) {
        const old = [];
        for (let r = rows-1; r >= 0; r--) if (board[r][c] >= 0) old.push(board[r][c]);
        for (let r = rows-1, i = 0; r >= 0; r--, i++) {
          board[r][c] = i < old.length ? old[i] : Math.floor(rand()*kinds);
          if (i >= old.length) newest.push(key(r,c));
        }
      }
      pulse = []; draw(); await sleep(200);
    }
    if (!hasMove()) initialize();
    busy = false; stableAt = performance.now(); draw();
  }
  function drawPiece(r,c,t) {
    const k = board[r][c]; if (k < 0) return;
    const x = boardX+c*cell, y = boardY+r*cell;
    const pad = 2, size = cell-2*pad;
    const glow = selected?.r === r && selected?.c === c;
    const flash = pulse.includes(key(r,c));
    rounded(x+1,y+1,cell-2,cell-2,cell*.18,
      glow ? '#8170ba' : ((r+c)%2 ? '#293558ec':'#33416bed'),
      glow ? '#ffe09a' : '#7e85a970', glow ? 2 : 1);
    if (flash) { rounded(x+2,y+2,cell-4,cell-4,cell*.18,'#fff7d2'); return; }
    const entering = newest.includes(key(r,c)) && t-stableAt < 450;
    const scale = entering ? .8 + .2*Math.min(1,(t-stableAt)/450) : 1;
    const sz = size*scale, px=x+(cell-sz)/2, py=y+(cell-sz)/2;
    if (artReady) {
      ctx.save();ctx.shadowColor='#020718bb';ctx.shadowBlur=5;ctx.shadowOffsetY=4;
      const src = k === 4 ? 4 : k;
      const sx = (src%3)*256, sy = Math.floor(src/3)*256;
      ctx.drawImage(atlas,sx,sy,256,256,px-5,py-5,sz+10,sz+10);ctx.restore();
    } else {
      rounded(px+3,py+3,sz-6,sz-6,sz*.28,colors[k],'#ffedb9',2);
      text(icons[k],x+cell/2,y+cell/2,cell*.52);
    }
  }
  function draw() {
    if (!canvas.width) return;
    const t = now();
    ctx.setTransform(canvas.width/logicalW,0,0,canvas.height/logicalH,0,0);
    ctx.clearRect(0,0,logicalW,logicalH);
    const landscape = logicalW > logicalH;
    // Original header and mission panels; the reference's UI arrangement is not copied.
    const hud=ctx.createLinearGradient(0,20,0,170);hud.addColorStop(0,'#253354f2');hud.addColorStop(.46,'#151f3be9');hud.addColorStop(1,'#0a122ae9');
    const footer=ctx.createLinearGradient(0,boardY+rows*cell,0,logicalH);footer.addColorStop(0,'#1d2b4ce9');footer.addColorStop(1,'#0b1229f1');
    if (landscape) {
      rounded(18,20,190,360,22,hud,'#d6b371',2);
      text('ASTRAL',113,64,27,'#ffe5a0',800); text('ARCHIVE',113,94,15,'#d8e8ff',700);
      text('별의 조각을 모으세요',113,143,13,'#d8d2e6',500);
      text('점수',113,203,13,'#deceaf',600); text(String(score).padStart(6,'0'),113,237,27);
      text('남은 이동',113,289,13,'#deceaf',600); text(String(moves),113,327,33,'#ffe5a0');
      rounded(552,30,145,320,20,hud,'#d6b371',2);
      text('✦',624,119,65,'#e4c36c'); text(combo>1?`${combo} 연쇄!`:'별자리를 깨우세요',624,213,16,'#ffe7a6');
    } else {
      rounded(24,20,logicalW-48,125,22,hud,'#d6b371',2);
      text('ASTRAL ARCHIVE',logicalW/2,47,22,'#ffe5a0',800);
      rounded(86,64,218,2,1,'#bca067');
      text('✦',76,46,18,'#f9d97a');text('✦',314,46,18,'#f9d97a');
      text('별의 조각을 모으세요',logicalW/2,76,13,'#d8d2e6',500);
      text('✧',48,115,27,'#82dafa');
      text('점수',105,110,11,'#deceaf',600); text(String(score).padStart(6,'0'),105,130,19);
      text('☼',340,115,27,'#f9d97a');
      text('남은 이동',285,110,11,'#deceaf',600); text(String(moves),285,130,19,'#ffe5a0');
    }
    const bx = boardX-8, by = boardY-8, bw = cols*cell+16, bh=rows*cell+16;
    rounded(bx-5,by-5,bw+10,bh+10,17,'#080e25df','#f0c979',4);
    for (const corner of [[bx,by],[bx+bw,by],[bx,by+bh],[bx+bw,by+bh]]) {
      ctx.beginPath();ctx.arc(corner[0],corner[1],4,0,Math.PI*2);ctx.fillStyle='#ffe39a';ctx.fill();
    }
    rounded(bx,by,bw,bh,12,'#1a2550f0','#718dc1',2);
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) drawPiece(r,c,t);
    if (!landscape) {
      const bottom = boardY+rows*cell+28;
      rounded(24,bottom,logicalW-48,88,21,footer,'#d6b371',2);
      text(combo>1?`${combo} 연쇄!`:'관측 목표',logicalW/2,bottom+17,14,'#ffe1a1');
      const types=[0,2,3], objectives=[8,8,8];
      for(let i=0;i<3;i++){
        const x=70+i*125,y=bottom+54;
        rounded(x-48,y-21,96,42,12,'#304269e9','#7d9dd0',1);
        if(artReady)ctx.drawImage(atlas,(types[i]%3)*256,Math.floor(types[i]/3)*256,256,256,x-38,y-19,38,38);
        else text(icons[types[i]],x-20,y,24,colors[types[i]]);
        text(`${Math.min(collected[i],objectives[i])}/${objectives[i]}`,x+24,y+1,15,'#f9e9c1');
      }
    }
    if(moves<=0) {
      rounded(logicalW*.13,logicalH*.39,logicalW*.74,115,20,'#151932f0','#edc073',3);
      text('관측 완료',logicalW/2,logicalH*.39+43,25,'#ffe5a0');
      text('화면을 탭해 다시 시작',logicalW/2,logicalH*.39+82,13);
    }
  }
  canvas.addEventListener('pointerdown', e => {
    if(moves<=0) { moves=24; score=0; collected.fill(0); initialize(); draw(); return; }
    const p=pointer(e); pressed=boardHit(p.x,p.y);
    if(pressed && !busy) { selected=pressed; canvas.setPointerCapture(e.pointerId); draw(); }
  });
  canvas.addEventListener('pointerup', e => {
    if(!pressed || busy) return;
    const p=pointer(e), end=boardHit(p.x,p.y), start=pressed;
    pressed=null;
    if(end && (end.r!==start.r || end.c!==start.c)) makeMove(start,end);
    else if(end && selected && (selected.r!==end.r || selected.c!==end.c)) makeMove(selected,end);
    else selected=start;
    draw();
  });
  canvas.addEventListener('pointercancel', () => { pressed=null; selected=null; draw(); });
  window.addEventListener('resize',resize);
  window.addEventListener('orientationchange',() => setTimeout(resize,80));
  function frame(t) { if(t-lastFrame>32) { draw(); lastFrame=t; } requestAnimationFrame(frame); }
  initialize(); if(capture) advanceCapture(capTime); resize(); requestAnimationFrame(frame);
  window.__pilot = { board, get moves(){return moves;}, get score(){return score;}, get artReady(){return artReady;}, get logicalSize(){return [logicalW,logicalH];}, get layout(){return {boardX,boardY,cell,logicalW,logicalH};}, move:(r,c,nr,nc)=>makeMove({r,c},{r:nr,c:nc}) };
})();
