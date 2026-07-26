(function () {
  const DEFAULT_SKIN_PERCENT = 68;
  const SCORE_STORAGE_KEY = "skinscopeSkinPercent";
  const SCAN_HISTORY_KEY = "skinscopeScanHistory";

  function clampPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return DEFAULT_SKIN_PERCENT;
    if (number <= 0) return DEFAULT_SKIN_PERCENT;
    return Math.min(100, Math.max(1, Math.round(number)));
  }

  function getStoredPercent() {
    try {
      const stored = localStorage.getItem(SCORE_STORAGE_KEY);
      if (stored) return clampPercent(stored);

      const history = JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY)) || [];
      const scoredItem = history.find(function (item) {
        return item && (item.skinPercent || item.skinScore || item.score || item.percent);
      });

      if (scoredItem) {
        return clampPercent(scoredItem.skinPercent || scoredItem.skinScore || scoredItem.score || scoredItem.percent);
      }
    } catch (error) {
      return DEFAULT_SKIN_PERCENT;
    }

    return DEFAULT_SKIN_PERCENT;
  }

  function getResultPagePercent() {
    const scoreCard = Array.from(document.querySelectorAll(".metric-card")).find(function (card) {
      return card.textContent.toLowerCase().includes("skin score");
    });

    const scoreText = scoreCard && scoreCard.querySelector("strong")
      ? scoreCard.querySelector("strong").textContent
      : "";

    const score = Number(String(scoreText).replace(/[^\d.]/g, ""));
    return Number.isFinite(score) ? clampPercent(score) : null;
  }

  function getSkinPercent() {
    const resultPagePercent = getResultPagePercent();

    if (resultPagePercent) {
      localStorage.setItem(SCORE_STORAGE_KEY, String(resultPagePercent));
      return resultPagePercent;
    }

    return getStoredPercent();
  }

  function renderSkinPet() {
    if (document.querySelector(".skin-pet-widget")) return;

    const percent = getSkinPercent();
    const widget = document.createElement("aside");
    widget.className = "skin-pet-widget";
    widget.setAttribute("aria-label", "Your SkinScope skin percentage");
    widget.innerHTML = [
      '<div class="skin-pet-bot" aria-hidden="true">',
      '  <div class="skin-pet-antenna"></div>',
      '  <div class="skin-pet-head">',
      '    <span class="skin-pet-eye skin-pet-eye-left"></span>',
      '    <span class="skin-pet-eye skin-pet-eye-right"></span>',
      '    <span class="skin-pet-mouth"></span>',
      '  </div>',
      '  <div class="skin-pet-body">',
      '    <span></span>',
      '  </div>',
      '  <div class="skin-pet-arms"></div>',
      '  <div class="skin-pet-feet"></div>',
      '</div>',
      '<div class="skin-pet-meter">',
      '  <div class="skin-pet-label-row">',
      '    <span>Your skin</span>',
      '    <strong>' + percent + '%</strong>',
      '  </div>',
      '  <div class="skin-pet-scale">',
      '    <span>1</span>',
      '    <span>100</span>',
      '  </div>',
      '  <div class="skin-pet-bar" role="meter" aria-valuemin="1" aria-valuemax="100" aria-valuenow="' + percent + '" aria-label="Your skin percentage">',
      '    <span class="skin-pet-marker" style="left: ' + percent + '%;"></span>',
      '  </div>',
      '</div>'
    ].join("");

    document.body.appendChild(widget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSkinPet);
  } else {
    renderSkinPet();
  }
})();
