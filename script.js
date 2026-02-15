let score = 0;
  let autoClick = 0;
  let autoPrice = 20;

  const scoreEl = document.getElementById("score");
  const autoPriceEl = document.getElementById("autoPrice");

  document.getElementById("clickBtn").onclick = () => {
    score++;
    update();
  };

  document.getElementById("buyAuto").onclick = () => {
    if (score >= autoPrice) {
      score -= autoPrice;
      autoClick++;
      autoPrice = Math.floor(autoPrice * 1.5);
      autoPriceEl.textContent = autoPrice;
      update();
    }
  };

  function update() {
    scoreEl.textContent = "Score : " + score;
  }

  // Auto-click toutes les secondes
  setInterval(() => {
    score += autoClick;
    update();
  }, 1000);
