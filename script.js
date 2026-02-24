/* ============================
   1) Effet titre : lettres qui tombent et s'arrêtent
   ============================ */
const titleText = "TEST";
const titleContainer = document.getElementById('titleContainer');

const letters = [];
const gravity = 0.9;
const bounce = 0.25;
const groundY = 70; // position where letters should rest (px)

function createTitle(){
  titleContainer.innerHTML = '';
  for(let i=0;i<titleText.length;i++){
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = titleText[i];
    span.style.position = 'relative';
    span.style.top = '-200px';
    span.style.opacity = '0';
    titleContainer.appendChild(span);
    letters.push({
      el: span,
      x: i * (titleText.length>1?72:0),
      y: -200,
      vy: 0,
      targetX: i * 72,
      targetY: 0,
      stopped: false,
      delay: i * 120
    });
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
    // simple falling physics
    L.vy += gravity * 0.12;
    L.y += L.vy;
    if(L.y >= groundY){
      L.y = groundY;
      L.vy *= -bounce;
      if(Math.abs(L.vy) < 1.2){
        L.vy = 0;
        L.stopped = true;
      }
    } else {
      allStopped = false;
    }
    // apply to DOM
    L.el.style.transform = `translateY(${L.y}px) rotate(${Math.min(8, L.vy*2)}deg)`;
    L.el.style.opacity = '1';
  }
  if(!allStopped) requestAnimationFrame(animateTitle);
  else {
    // final settle: align letters nicely
    letters.forEach((L,i)=> L.el.style.transform = `translateY(${groundY}px)`);
  }
}
requestAnimationFrame(animateTitle);

/* ============================
   2) Jeu platformer (canvas)
   ============================ */
const playBtn = document.getElementById('playBtn');
const gameWrap = document.getElementById('gameWrap');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');

let gameRunning = false;
let keys = {};
let scaleW = canvas.width;
let scaleH = canvas.height;

/* Level definition */
const level = {
  width: 4000, // long horizontal level
  height: canvas.height,
  platforms: [],
  lavaY: canvas.height - 40,
  portal: { x: 3800, y: canvas.height - 140, w: 60, h: 100 }
};

/* Create platforms spaced across the level */
function generatePlatforms(){
  level.platforms = [];
  // ground platform across entire level (thin)
  level.platforms.push({x:0,y:level.lavaY-20,w:level.width,h:20});
  // floating platforms
  const gaps = [200, 400, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600];
  for(let i=0;i<gaps.length;i++){
    const x = gaps[i];
    const y = level.lavaY - 120 - (i%3)*40;
    level.platforms.push({x:x,y:y,w:140,h:18});
  }
  // some higher platforms
  level.platforms.push({x:900,y:level.lavaY-220,w:120,h:18});
  level.platforms.push({x:2000,y:level.lavaY-260,w:160,h:18});
  level.platforms.push({x:2600,y:level.lavaY-200,w:120,h:18});
}
generatePlatforms();

/* Player */
const player = {
  x: 40, y: level.lavaY - 60, w: 36, h: 36,
  vx: 0, vy: 0, speed: 5, jumpPower: 13, onGround: false,
  color: '#ff3b3b'
};

/* Camera */
const camera = { x:0, y:0, w:canvas.width, h:canvas.height };

/* Input */
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

/* Start game */
playBtn.addEventListener('click', () => {
  // hide title and show game
  gameWrap.style.display = 'block';
  // scroll to game
  gameWrap.scrollIntoView({behavior:'smooth',block:'center'});
  // reset player and camera
  player.x = 40; player.y = level.lavaY - 60; player.vx = 0; player.vy = 0; player.onGround = false;
  camera.x = 0;
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
});

/* Collision helpers */
function rectsOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Game loop */
let lastTime = 0;
function gameLoop(ts){
  if(!gameRunning) return;
  const dt = Math.min(34, ts - lastTime) / 16.666; // normalized
  lastTime = ts;

  // Controls
  if(keys['arrowleft'] || keys['a']) player.vx = -player.speed;
  else if(keys['arrowright'] || keys['d']) player.vx = player.speed;
  else player.vx = 0;
  if((keys['arrowup'] || keys['w'] || keys[' ']) && player.onGround){
    player.vy = -player.jumpPower;
    player.onGround = false;
  }

  // Physics
  player.vy += 0.8 * dt; // gravity
  player.x += player.vx * dt * 1.0;
  player.y += player.vy * dt * 1.0;

  // Simple world bounds
  if(player.x < 0) player.x = 0;
  if(player.x + player.w > level.width) player.x = level.width - player.w;

  // Platform collisions (simple AABB)
  player.onGround = false;
  for(const p of level.platforms){
    const plat = {x:p.x, y:p.y, w:p.w, h:p.h};
    const future = {x:player.x, y:player.y, w:player.w, h:player.h};
    if(rectsOverlap(future, plat)){
      // collision from top?
      const prevY = player.y - player.vy * dt;
      if(prevY + player.h <= plat.y + 6){
        player.y = plat.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else {
        // side collision: push out
        if(player.x < plat.x) player.x = plat.x - player.w;
        else player.x = plat.x + plat.w;
        player.vx = 0;
      }
    }
  }

  // Lava death
  if(player.y + player.h > level.lavaY + 10){
    // reset to start
    player.x = 40; player.y = level.lavaY - 60; player.vx = 0; player.vy = 0;
  }

  // Portal check
  const portalRect = {x: level.portal.x, y: level.portal.y, w: level.portal.w, h: level.portal.h};
  if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h}, portalRect)){
    // show modal and stop game
    showModal();
    gameRunning = false;
  }

  // Camera follows player (centered with clamp)
  const camTargetX = player.x - canvas.width/2 + player.w/2;
  camera.x += (camTargetX - camera.x) * 0.12;
  camera.x = Math.max(0, Math.min(level.width - canvas.width, camera.x));

  // Background color changes with progress (0..1)
  const progress = Math.min(1, player.x / (level.width - player.w));
  // compute a smooth color between dark purple and orange using HSL
  const hue = 260 - progress * 200; // from 260 (purple) to 60 (orange)
  const bgColor = `hsl(${hue} 60% 8%)`;
  // draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Draw lava
  ctx.fillStyle = '#ff5a2b';
  const lavaScreenY = level.lavaY - camera.y;
  ctx.fillRect(0, lavaScreenY, canvas.width, canvas.height - lavaScreenY);

  // Draw platforms
  ctx.fillStyle = '#8b8b8b';
  for(const p of level.platforms){
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    if(sx + p.w < -200 || sx > canvas.width + 200) continue;
    ctx.fillRect(Math.round(sx), Math.round(sy), p.w, p.h);
  }

  // Draw portal (blue glowing)
  const portalScreenX = level.portal.x - camera.x;
  const portalScreenY = level.portal.y - camera.y;
  // glow
  const grad = ctx.createRadialGradient(portalScreenX + level.portal.w/2, portalScreenY + level.portal.h/2, 10, portalScreenX + level.portal.w/2, portalScreenY + level.portal.h/2, 80);
  grad.addColorStop(0, 'rgba(80,170,255,0.9)');
  grad.addColorStop(1, 'rgba(80,170,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(portalScreenX - 40, portalScreenY - 40, level.portal.w + 80, level.portal.h + 80);
  // portal body
  ctx.fillStyle = '#3aa0ff';
  ctx.fillRect(portalScreenX, portalScreenY, level.portal.w, level.portal.h);

  // Draw player (red cube)
  const playerScreenX = player.x - camera.x;
  const playerScreenY = player.y - camera.y;
  ctx.fillStyle = player.color;
  ctx.fillRect(Math.round(playerScreenX), Math.round(playerScreenY), player.w, player.h);
  // small shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(playerScreenX+6), Math.round(playerScreenY+player.h-6), player.w-12, 6);

  // HUD update
  hud.textContent = `Progression: ${Math.round(progress*100)}%`;

  // next frame
  requestAnimationFrame(gameLoop);
}

/* Modal handling */
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');

function showModal(){
  modalOverlay.style.display = 'flex';
  modalOverlay.setAttribute('aria-hidden','false');
}
function hideModal(){
  modalOverlay.style.display = 'none';
  modalOverlay.setAttribute('aria-hidden','true');
}
closeModal.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', (e) => {
  if(e.target === modalOverlay) hideModal();
});

/* Accessibility: allow Enter on play button */
playBtn.addEventListener('keyup', (e) => { if(e.key === 'Enter') playBtn.click(); });

/* Resize handling to keep canvas crisp */
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  // keep internal resolution fixed for consistent gameplay; canvas CSS scales it
  // but we can adapt if desired. For simplicity we keep width/height attributes.
}
window.addEventListener('resize', resizeCanvas);
