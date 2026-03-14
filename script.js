/* ============================
   TITRE ANIMÉ : lettres qui tombent et s'arrêtent
   ============================ */
const titleText = "TEST";
const titleContainer = document.getElementById('titleContainer');
const letters = [];
const gravity = 0.9;
const bounce = 0.25;
const groundY = 70;

function createTitle(){
  titleContainer.innerHTML = '';
  letters.length = 0;
  for(let i=0;i<titleText.length;i++){
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = titleText[i];
    span.style.position = 'relative';
    span.style.top = '-220px';
    span.style.opacity = '0';
    titleContainer.appendChild(span);
    letters.push({ el: span, y: -220, vy: 0, stopped: false, delay: i * 120 });
  }
}
createTitle();

let titleStart = null;
function animateTitle(ts){
  if(!titleStart) titleStart = ts;
  const elapsed = ts - titleStart;
  let allStopped = true;
  for(const L of letters){
    if(elapsed < L.delay){ allStopped = false; continue; }
    if(L.stopped) continue;
    L.vy += gravity * 0.12;
    L.y += L.vy;
    if(L.y >= groundY){
      L.y = groundY;
      L.vy *= -bounce;
      if(Math.abs(L.vy) < 1.2){ L.vy = 0; L.stopped = true; }
    } else { allStopped = false; }
    L.el.style.transform = `translateY(${L.y}px) rotate(${Math.min(8, L.vy*2)}deg)`;
    L.el.style.opacity = '1';
  }
  if(!allStopped) requestAnimationFrame(animateTitle);
  else letters.forEach(L => L.el.style.transform = `translateY(${groundY}px)`);
}
requestAnimationFrame(animateTitle);

/* ============================
   JEU : plateformes, joueur, pièces, portail, traînée, joystick tactile
   (implémentation complète, basée sur versions précédentes)
   ============================ */

/* DOM refs */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('playBtn');
const gameWrap = document.getElementById('gameWrap');
const hud = document.getElementById('hud');
const coinHud = document.getElementById('coinHud');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');

const touchControls = document.getElementById('touchControls');
const joystickArea = document.getElementById('joystickArea');
const joystickBase = document.getElementById('joystickBase');
const joystickKnob = document.getElementById('joystickKnob');
const jumpButton = document.getElementById('jumpButton');

/* Level and platforms */
const level = { width:4000, height:canvas.height, platforms:[], lavaY: canvas.height - 40, portal:{x:3800,y:canvas.height-140,w:60,h:100} };
function generatePlatforms(){ level.platforms=[]; const startW=320; const startX=0; const startY=level.lavaY - 10 - 36; level.startPlatform={x:startX,y:startY,w:startW,h:18}; level.platforms.push(level.startPlatform); const gaps=[220,480,760,1040,1320,1600,1880,2160,2440,2720,3000,3280,3560]; for(let i=0;i<gaps.length;i++){ const x=gaps[i]; const y=level.lavaY - 120 - (i%3)*40; level.platforms.push({x:x,y:y,w:140,h:18}); } level.platforms.push({x:900,y:level.lavaY-220,w:120,h:18}); level.platforms.push({x:2000,y:level.lavaY-260,w:160,h:18}); level.platforms.push({x:2600,y:level.lavaY-200,w:120,h:18}); }
generatePlatforms();

/* Coins */
const coins = [];
function generateCoins(){ coins.length=0; for(const p of level.platforms){ if(p===level.startPlatform){ coins.push({x:p.x+140,y:p.y-28,r:10,collected:false,phase:Math.random()*Math.PI*2}); coins.push({x:p.x+240,y:p.y-28,r:10,collected:false,phase:Math.random()*Math.PI*2}); continue; } coins.push({x:p.x+Math.min(80,p.w/2),y:p.y-28,r:10,collected:false,phase:Math.random()*Math.PI*2}); } coins.push({x:1200,y:level.lavaY-180,r:10,collected:false,phase:Math.random()*Math.PI*2}); coins.push({x:2400,y:level.lavaY-240,r:10,collected:false,phase:Math.random()*Math.PI*2}); }
generateCoins();
function totalCoins(){ return coins.length; }
function collectedCoins(){ return coins.filter(c=>c.collected).length; }
function updateCoinHud(){ coinHud.textContent = `Pièces: ${collectedCoins()} / ${totalCoins()}`; }

/* Audio */
let audioCtx = null;
function playCoinSound(){ try{ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(880,audioCtx.currentTime); g.gain.setValueAtTime(0.0001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.12,audioCtx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+0.22); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.25); }catch(e){} }

/* Player */
const player = { x:40,y:0,w:36,h:36,vx:0,vy:0,speed:5,jumpPower:13,onGround:false,color:'#ff3b3b',angle:0,targetAngle:0,alpha:1.0,collectCooldown:0 };
const camera = { x:0,y:0,w:canvas.width,h:canvas.height };
const trail = []; const TRAIL_MAX = 100; const TRAIL_FADE = 0.06;
let keys = {}; window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; }); window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

function spawnPlayerOnStart(){ const sp = level.startPlatform; player.x = sp.x + 40; player.y = sp.y - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.angle = 0; player.targetAngle = 0; player.alpha = 1.0; player.collectCooldown = performance.now() + 400; trail.length = 0; for(const c of coins) c.collected = false; updateCoinHud(); }
spawnPlayerOnStart();

function rectsOverlap(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circleRectOverlap(cx,cy,r,rx,ry,rw,rh){ const closestX = Math.max(rx, Math.min(cx, rx + rw)); const closestY = Math.max(ry, Math.min(cy, ry + rh)); const dx = cx - closestX; const dy = cy - closestY; return (dx*dx + dy*dy) <= r*r; }
function roundRectPath(ctx,x,y,w,h,r){ const radius = Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+radius,y); ctx.arcTo(x+w,y,x+w,y+h,radius); ctx.arcTo(x+w,y+h,x,y+h,radius); ctx.arcTo(x,y+h,x,y,radius); ctx.arcTo(x,y,x+w,y,radius); ctx.closePath(); }

/* Portal effect */
let enteringPortal = false; let portalStartTime = 0; const PORTAL_EFFECT_DURATION = 700; let portalRays = []; let coinsCollectedAtFinish = 0;
function startPortalEffect(portalX,portalY){ enteringPortal = true; portalStartTime = performance.now(); portalRays = []; const rayCount = 18; for(let i=0;i<rayCount;i++){ const angle = (i/rayCount)*Math.PI*2; portalRays.push({angle,length:0,maxLength:220+Math.random()*80,alpha:1.0}); } }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

/* --- Touch joystick logic --- */
let touchDetected = false;
let joystickTouchId = null;
let joystickCenter = {x:0,y:0};
let knobMax = 36;
function showTouchControls(){ touchControls.style.display = 'block'; touchControls.setAttribute('aria-hidden','false'); }
function onFirstTouch(e){ if(touchDetected) return; touchDetected = true; showTouchControls(); const baseRect = joystickBase.getBoundingClientRect(); joystickCenter.x = baseRect.left + baseRect.width/2; joystickCenter.y = baseRect.top + baseRect.height/2; window.removeEventListener('touchstart', onFirstTouch); }
window.addEventListener('touchstart', onFirstTouch, {passive:true});

joystickArea.addEventListener('touchstart', function(e){ e.preventDefault(); for(const t of e.changedTouches){ if(joystickTouchId === null){ joystickTouchId = t.identifier; updateKnobPosition(t.clientX, t.clientY); break; } } }, {passive:false});
joystickArea.addEventListener('touchmove', function(e){ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier === joystickTouchId){ updateKnobPosition(t.clientX, t.clientY); break; } } }, {passive:false});
joystickArea.addEventListener('touchend', function(e){ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier === joystickTouchId){ joystickTouchId = null; resetKnob(); break; } } }, {passive:false});

function updateKnobPosition(clientX, clientY){ const dx = clientX - joystickCenter.x; const dy = clientY - joystickCenter.y; const dist = Math.sqrt(dx*dx + dy*dy); const nx = dist > knobMax ? dx * (knobMax/dist) : dx; const ny = dist > knobMax ? dy * (knobMax/dist) : dy; joystickKnob.style.transform = `translate(${nx}px, ${ny}px)`; const inputX = Math.max(-1, Math.min(1, nx / knobMax)); player.vx = inputX * player.speed; }
function resetKnob(){ joystickKnob.style.transform = `translate(0,0)`; if(!(keys['arrowleft']||keys['a']||keys['arrowright']||keys['d'])) player.vx = 0; }

let jumpTouchId = null;
jumpButton.addEventListener('touchstart', function(e){ e.preventDefault(); for(const t of e.changedTouches){ if(jumpTouchId===null){ jumpTouchId = t.identifier; doJump(); break; } } }, {passive:false});
jumpButton.addEventListener('touchend', function(e){ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===jumpTouchId){ jumpTouchId = null; } } }, {passive:false});
jumpButton.addEventListener('mousedown', function(){ doJump(); });

function doJump(){ if(player.onGround && !enteringPortal){ player.vy = -player.jumpPower; player.onGround = false; player.targetAngle += Math.PI/2; trail.push({x:player.x+player.w/2,y:player.y+player.h/2,alpha:1.0}); } }

/* --- Game loop --- */
let gameRunning = false; let lastTime = 0;
function gameLoop(ts){
  if(!gameRunning) return;
  const dt = Math.min(34, ts - lastTime) / 16.666;
  lastTime = ts;

  if(!touchDetected || joystickTouchId === null){
    if(!enteringPortal){
      if(keys['arrowleft'] || keys['a']) player.vx = -player.speed;
      else if(keys['arrowright'] || keys['d']) player.vx = player.speed;
      else if(joystickTouchId === null) player.vx = 0;
      if((keys['arrowup'] || keys['w'] || keys[' ']) && player.onGround){ player.vy = -player.jumpPower; player.onGround = false; player.targetAngle += Math.PI/2; trail.push({x:player.x+player.w/2,y:player.y+player.h/2,alpha:1.0}); }
    }
  }

  player.vy += 0.8 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if(player.x < 0) player.x = 0;
  if(player.x + player.w > level.width) player.x = level.width - player.w;

  player.onGround = false;
  for(const p of level.platforms){
    const plat = {x:p.x,y:p.y,w:p.w,h:p.h};
    const future = {x:player.x,y:player.y,w:player.w,h:player.h};
    if(rectsOverlap(future,plat)){
      const prevY = player.y - player.vy * dt;
      const prevBottom = prevY + player.h;
      const platTop = plat.y;
      const platBottom = plat.y + plat.h;
      if(prevBottom <= platTop + 2){ player.y = platTop - player.h; player.vy = 0; player.onGround = true; }
      else if(prevY >= platBottom - 2){ player.y = platBottom; player.vy = 0; }
      else { if(player.x + player.w/2 < plat.x + plat.w/2) player.x = plat.x - player.w; else player.x = plat.x + plat.w; player.vx = 0; }
    }
  }

  if(player.y + player.h > level.lavaY){ spawnPlayerOnStart(); }

  for(const c of coins){
    if(c.collected) continue;
    if(performance.now() < player.collectCooldown) continue;
    if(circleRectOverlap(c.x, c.y, c.r + 2, player.x, player.y, player.w, player.h)){ c.collected = true; playCoinSound(); updateCoinHud(); }
  }

  const portalRect = {x:level.portal.x,y:level.portal.y,w:level.portal.w,h:level.portal.h};
  if(!enteringPortal && rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h}, portalRect)){
    coinsCollectedAtFinish = collectedCoins();
    const portalCenterX = level.portal.x + level.portal.w/2;
    const portalCenterY = level.portal.y + level.portal.h/2;
    startPortalEffect(portalCenterX, portalCenterY);
  }

  const camTargetX = player.x - canvas.width/2 + player.w/2;
  camera.x += (camTargetX - camera.x) * 0.12;
  camera.x = Math.max(0, Math.min(level.width - canvas.width, camera.x));

  const progress = Math.min(1, player.x / (level.width - player.w));
  const hue = 260 - progress * 200;
  ctx.fillStyle = `hsl(${hue} 60% 8%)`;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = '#ff5a2b';
  const lavaScreenY = level.lavaY - camera.y;
  ctx.fillRect(0, lavaScreenY, canvas.width, canvas.height - lavaScreenY);

  ctx.fillStyle = '#8b8b8b';
  for(const p of level.platforms){
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    if(sx + p.w < -200 || sx > canvas.width + 200) continue;
    ctx.fillRect(Math.round(sx), Math.round(sy), p.w, p.h);
  }

  const portalScreenX = level.portal.x - camera.x;
  const portalScreenY = level.portal.y - camera.y;
  const grad = ctx.createRadialGradient(portalScreenX + level.portal.w/2, portalScreenY + level.portal.h/2, 10, portalScreenX + level.portal.w/2, portalScreenY + level.portal.h/2, 120);
  grad.addColorStop(0, 'rgba(80,170,255,0.95)');
  grad.addColorStop(0.6, 'rgba(80,170,255,0.25)');
  grad.addColorStop(1, 'rgba(80,170,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(portalScreenX - 60, portalScreenY - 60, level.portal.w + 120, level.portal.h + 120);
  ctx.fillStyle = '#3aa0ff';
  ctx.fillRect(portalScreenX, portalScreenY, level.portal.w, level.portal.h);

  trail.push({x:player.x+player.w/2,y:player.y+player.h/2,alpha:1.0});
  if(trail.length > TRAIL_MAX) trail.shift();
  for(let i=0;i<trail.length;i++) trail[i].alpha -= TRAIL_FADE * dt;
  while(trail.length && trail[0].alpha <= 0) trail.shift();

  if(trail.length > 1){
    ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
    for(let i=1;i<trail.length;i++){
      const a=trail[i-1], b=trail[i];
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x - camera.x), Math.round(a.y - camera.y));
      ctx.lineTo(Math.round(b.x - camera.x), Math.round(b.y - camera.y));
      const width = 12 * (0.4 + b.alpha * 0.6);
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(255,40,40,${Math.max(0,b.alpha)})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  for(const c of coins){
    if(c.collected) continue;
    c.phase += 0.08 * dt;
    const bob = Math.sin(c.phase) * 4;
    const sx = c.x - camera.x;
    const sy = c.y + bob - camera.y;
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, c.r*3);
    g.addColorStop(0, 'rgba(255,230,120,0.95)');
    g.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, c.r*1.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffd24d'; ctx.beginPath(); ctx.arc(sx, sy, c.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(sx - c.r*0.35, sy - c.r*0.35, c.r*0.45, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#b37a00'; ctx.beginPath(); ctx.arc(sx, sy, c.r, 0, Math.PI*2); ctx.stroke();
  }

  if(enteringPortal){
    const now = performance.now();
    const elapsed = now - portalStartTime;
    const t = Math.min(1, elapsed / PORTAL_EFFECT_DURATION);
    player.alpha = 1 - Math.pow(t,2) * 1.2; if(player.alpha < 0) player.alpha = 0;
    for(const r of portalRays){ r.length = r.maxLength * easeOutCubic(t) * (0.8 + Math.random()*0.4); r.alpha = 1 - t; }
    const portalCenterScreenX = (level.portal.x + level.portal.w/2) - camera.x;
    const portalCenterScreenY = (level.portal.y + level.portal.h/2) - camera.y;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(const r of portalRays){
      ctx.beginPath();
      const ex = portalCenterScreenX + Math.cos(r.angle) * r.length;
      const ey = portalCenterScreenY + Math.sin(r.angle) * r.length;
      ctx.moveTo(portalCenterScreenX, portalCenterScreenY);
      ctx.lineTo(ex, ey);
      ctx.lineWidth = 6 * (r.alpha) * (0.6 + Math.random()*0.8);
      ctx.strokeStyle = `rgba(100,200,255,${0.9 * r.alpha})`;
      ctx.stroke();
    }
    ctx.restore();
    if(performance.now() - portalStartTime >= PORTAL_EFFECT_DURATION){
      enteringPortal = false; player.alpha = 0; gameRunning = false;
      modalTitle.textContent = 'Bravo !';
      modalText.textContent = `Tu as terminé le parcours. Pièces collectées : ${coinsCollectedAtFinish} / ${totalCoins()}.`;
      showModal();
    }
  }

  const rotateSpeed = 0.18;
  const diff = player.targetAngle - player.angle;
  player.angle += diff * rotateSpeed * dt;
  if(Math.abs(diff) < 0.001) player.angle = player.targetAngle;

  const px = Math.round(player.x - camera.x);
  const py = Math.round(player.y - camera.y);
  ctx.save(); ctx.translate(px + player.w/2, py + player.h/2); ctx.rotate(player.angle); ctx.globalAlpha = player.alpha;
  const r = 6; ctx.fillStyle = player.color; roundRectPath(ctx, -player.w/2, -player.h/2, player.w, player.h, r); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#7a0000'; roundRectPath(ctx, -player.w/2, -player.h/2, player.w, player.h, r); ctx.stroke();
  const faceLeft = -player.w/2; const faceTop = -player.h/2; const pxSize = 3; const eyeOffsetY = 8; const eyeOffsetX = 8;
  ctx.fillStyle = '#000';
  ctx.fillRect(Math.round(faceLeft + eyeOffsetX), Math.round(faceTop + eyeOffsetY), pxSize, pxSize);
  ctx.fillRect(Math.round(faceLeft + eyeOffsetX + pxSize), Math.round(faceTop + eyeOffsetY), pxSize, pxSize);
  ctx.fillRect(Math.round(faceLeft + eyeOffsetX), Math.round(faceTop + eyeOffsetY + pxSize), pxSize, pxSize);
  const rightEyeX = player.w - eyeOffsetX - pxSize*2;
  ctx.fillRect(Math.round(faceLeft + rightEyeX), Math.round(faceTop + eyeOffsetY), pxSize, pxSize);
  ctx.fillRect(Math.round(faceLeft + rightEyeX + pxSize), Math.round(faceTop + eyeOffsetY), pxSize, pxSize);
  ctx.fillRect(Math.round(faceLeft + rightEyeX), Math.round(faceTop + eyeOffsetY + pxSize), pxSize, pxSize);
  const mouthWidth = 5; const mouthX = Math.round(faceLeft + (player.w - mouthWidth*pxSize)/2); const mouthY = Math.round(faceTop + player.h/2 + 6);
  for(let i=0;i<mouthWidth;i++) ctx.fillRect(mouthX + i*pxSize, mouthY, pxSize, pxSize);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-player.w/2 + 6, player.h/2 - 6, player.w - 12, 6);
  ctx.restore(); ctx.globalAlpha = 1.0;

  hud.textContent = `Progression: ${Math.round(progress*100)}%`;
  updateCoinHud();

  requestAnimationFrame(gameLoop);
}

/* UI helpers */
function showModal(){ modalOverlay.style.display = 'flex'; modalOverlay.setAttribute('aria-hidden','false'); }
function hideModalAndReturnHome(){ modalOverlay.style.display = 'none'; modalOverlay.setAttribute('aria-hidden','true'); gameWrap.style.display = 'none'; spawnPlayerOnStart(); camera.x = 0; playBtn.style.display = 'inline-block'; window.scrollTo({top:0,behavior:'smooth'}); }
closeModal.addEventListener('click', hideModalAndReturnHome);
modalOverlay.addEventListener('click', (e)=>{ if(e.target === modalOverlay) hideModalAndReturnHome(); });

playBtn.addEventListener('click', ()=>{ playBtn.style.display = 'none'; gameWrap.style.display = 'block'; gameWrap.scrollIntoView({behavior:'smooth',block:'center'}); spawnPlayerOnStart(); camera.x = 0; gameRunning = true; lastTime = performance.now(); requestAnimationFrame(gameLoop); });
playBtn.addEventListener('keyup', (e)=>{ if(e.key === 'Enter') playBtn.click(); });

updateCoinHud();
window.addEventListener('contextmenu', e => { if(touchDetected) e.preventDefault(); });
