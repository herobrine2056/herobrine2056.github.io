// main.js
// Prototype FPS simple avec blocs et gravité
// Assurez-vous d'avoir un dossier Textures/ avec des fichiers .png (ex: grass.png, dirt.png)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// lumières
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemi.position.set(0, 200, 0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(-1, 1.75, 1);
scene.add(dir);

// variables joueur / physique
const player = {
  height: 1.6,
  speed: 5.0,
  jumpSpeed: 6.0,
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  canJump: false,
  yaw: 0,
  pitch: 0
};

// container pour la caméra (permet rotation indépendante)
const playerObject = new THREE.Object3D();
playerObject.position.set(0, player.height, 0);
playerObject.add(camera);
scene.add(playerObject);

// gestion des blocs
const blockSize = 1;
const blocks = {}; // map "x,y,z" -> mesh
const loader = new THREE.TextureLoader();

// fonction pour créer un bloc
function createBlock(x, y, z, name = 'grass') {
  const key = `${x},${y},${z}`;
  if (blocks[key]) return blocks[key];

  const texturePath = `Textures/${name}.png`;
  const tex = loader.load(texturePath);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipMapNearestFilter;

  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const geo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    x * blockSize + blockSize / 2,
    y * blockSize + blockSize / 2,
    z * blockSize + blockSize / 2
  );
  mesh.userData.gridPos = { x, y, z };
  scene.add(mesh);
  blocks[key] = mesh;
  return mesh;
}

// helper pour récupérer AABB d'un bloc
function getBlockAABB(mesh) {
  const p = mesh.position;
  const half = blockSize / 2;
  return {
    min: new THREE.Vector3(p.x - half, p.y - half, p.z - half),
    max: new THREE.Vector3(p.x + half, p.y + half, p.z + half)
  };
}

// création d'un petit terrain initial et spawn du joueur
createBlock(0, 0, 0, 'grass'); // bloc sous le joueur
createBlock(1, 0, 0, 'dirt');
createBlock(-1, 0, 0, 'stone');
createBlock(0, 0, 1, 'wood');
createBlock(0, -1, 0, 'dirt'); // sous-sol

// position initiale du joueur : au-dessus du bloc (0,0,0)
playerObject.position.set(0, player.height + 0.01, 0);

// contrôles clavier
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// pointer lock pour la souris
const startBtn = document.getElementById('startBtn');
startBtn.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    document.addEventListener('mousemove', onMouseMove);
    startBtn.style.display = 'none';
  } else {
    document.removeEventListener('mousemove', onMouseMove);
    startBtn.style.display = '';
  }
});

function onMouseMove(e) {
  const movementX = e.movementX || 0;
  const movementY = e.movementY || 0;
  const sensitivity = 0.002;
  player.yaw -= movementX * sensitivity;
  player.pitch -= movementY * sensitivity;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
  playerObject.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

// simple AABB collision test between point (player) and blocks
function checkCollisions(nextPos) {
  // player bounding box (approximation : capsule -> use box for simplicity)
  const halfWidth = 0.25;
  const min = new THREE.Vector3(
    nextPos.x - halfWidth,
    nextPos.y - player.height,
    nextPos.z - halfWidth
  );
  const max = new THREE.Vector3(
    nextPos.x + halfWidth,
    nextPos.y,
    nextPos.z + halfWidth
  );

  let onGround = false;

  for (const key in blocks) {
    const mesh = blocks[key];
    const aabb = getBlockAABB(mesh);

    // overlap test
    const overlapX = (min.x <= aabb.max.x) && (max.x >= aabb.min.x);
    const overlapY = (min.y <= aabb.max.y) && (max.y >= aabb.min.y);
    const overlapZ = (min.z <= aabb.max.z) && (max.z >= aabb.min.z);

    if (overlapX && overlapY && overlapZ) {
      // collision detected -> resolve simply by pushing player up if colliding from above/below
      // if player's feet are below or touching top of block, consider onGround
      const feetY = min.y;
      const blockTop = aabb.max.y;
      const blockBottom = aabb.min.y;

      // if player is falling onto block
      if (player.velocity.y <= 0 && feetY <= blockTop + 0.01 && feetY >= blockBottom - player.height) {
        // snap player on top
        nextPos.y = blockTop + player.height;
        player.velocity.y = 0;
        onGround = true;
      } else {
        // simple horizontal push out: move player back along direction of penetration
        // compute penetration depths
        const penX = Math.min(max.x - aabb.min.x, aabb.max.x - min.x);
        const penY = Math.min(max.y - aabb.min.y, aabb.max.y - min.y);
        const penZ = Math.min(max.z - aabb.min.z, aabb.max.z - min.z);
        // choose smallest penetration to resolve
        if (penY <= penX && penY <= penZ) {
          // vertical resolution
          if (min.y < aabb.min.y) {
            nextPos.y = aabb.min.y - (max.y - min.y) + player.height;
          } else {
            nextPos.y = aabb.max.y + player.height;
          }
          player.velocity.y = 0;
        } else if (penX <= penZ) {
          // push in X
          if (nextPos.x > mesh.position.x) nextPos.x += penX + 0.01;
          else nextPos.x -= penX + 0.01;
        } else {
          // push in Z
          if (nextPos.z > mesh.position.z) nextPos.z += penZ + 0.01;
          else nextPos.z -= penZ + 0.01;
        }
      }
    }
  }

  return { nextPos, onGround };
}

// boucle principale
const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(0.05, clock.getDelta()); // clamp delta

  // mouvement horizontal selon orientation
  const forward = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
  const backward = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
  const left = (keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0;
  const right = (keys['KeyD'] || keys['ArrowRight']) ? 1 : 0;

  player.direction.set(0, 0, 0);
  if (forward) player.direction.z -= 1;
  if (backward) player.direction.z += 1;
  if (left) player.direction.x -= 1;
  if (right) player.direction.x += 1;
  player.direction.normalize();

  // rotate direction by player yaw
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const dx = player.direction.x * cosY - player.direction.z * sinY;
  const dz = player.direction.x * sinY + player.direction.z * cosY;

  // apply horizontal velocity
  const targetSpeed = player.speed;
  player.velocity.x = dx * targetSpeed;
  player.velocity.z = dz * targetSpeed;

  // gravity
  const gravity = -9.8;
  player.velocity.y += gravity * delta;

  // jump
  if ((keys['Space'] || keys['Spacebar']) && player.canJump) {
    player.velocity.y = player.jumpSpeed;
    player.canJump = false;
  }

  // compute tentative next position
  const nextPos = playerObject.position.clone().addScaledVector(player.velocity, delta);

  // collision detection & resolution
  const result = checkCollisions(nextPos);
  playerObject.position.copy(result.nextPos);
  player.canJump = result.onGround;

  // keep camera height consistent
  camera.position.set(0, 0, 0);

  // simple camera follow (playerObject already contains camera)
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

// adapt to resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
