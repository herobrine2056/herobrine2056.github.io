    const API_BASE = "https://bastiengramaize.wixsite.com/test_2056/_api/cloud-data/v2/items/update";
    const API_KEY  = "2056"; // même valeur que dans http-functions.js
    const PLAYER_ID = "player-" + Math.floor(Math.random() * 1e9);

    let x = 100, y = 100;
    const speed = 4;
    const keys = {};
    const otherPlayers = new Map(); // playerId -> {x,y}

    document.addEventListener("keydown", e => keys[e.key] = true);
    document.addEventListener("keyup",   e => keys[e.key] = false);

    async function api(path, options = {}) {
      const res = await fetch(API_BASE + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          ...(options.headers || {})
        }
      });
      return res.json();
    }

    async function createPlayer() {
      await api("/createPlayer", {
        method: "POST",
        body: JSON.stringify({
          playerId: PLAYER_ID,
          name: "Player " + PLAYER_ID.slice(-4),
          x, y,
          state: "idle"
        })
      });
    }

    async function updatePlayer() {
      await api("/updatePlayer", {
        method: "POST",
        body: JSON.stringify({
          playerId: PLAYER_ID,
          x, y,
          state: "moving"
        })
      });
    }

    async function fetchPlayers() {
      const data = await api("/players");
      otherPlayers.clear();
      for (const p of data.players) {
        if (p.playerId === PLAYER_ID) continue;
        otherPlayers.set(p.playerId, { x: p.x, y: p.y });
      }
    }

    function update() {
      if (keys["ArrowLeft"])  x -= speed;
      if (keys["ArrowRight"]) x += speed;
      if (keys["ArrowUp"])    y -= speed;
      if (keys["ArrowDown"])  y += speed;
    }

    function draw() {
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // toi
      ctx.fillStyle = "blue";
      ctx.fillRect(x - 10, y - 10, 20, 20);

      // les autres
      ctx.fillStyle = "red";
      for (const [id, p] of otherPlayers) {
        ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
      }
    }

    async function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    // boucle réseau : envoie ta position + récupère les autres
    setInterval(() => {
      updatePlayer().catch(console.error);
      fetchPlayers().catch(console.error);
    }, 300); // toutes les 300 ms

    // init
    (async () => {
      await createPlayer();
      gameLoop();
    })();
