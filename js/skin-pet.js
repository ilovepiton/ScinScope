(function () {
  const DEFAULT_SKIN_PERCENT = 68;
  const SCORE_STORAGE_KEY = "skinscopeSkinPercent";
  const SCAN_HISTORY_KEY = "skinscopeScanHistory";
  let globalControlsBound = false;

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

  function scoreBarHtml(percent, className, label) {
    return [
      '<div class="' + className + '" role="meter" aria-valuemin="1" aria-valuemax="100" aria-valuenow="' + percent + '" aria-label="' + label + '">',
      '  <span style="width: ' + percent + '%;"></span>',
      '</div>'
    ].join("");
  }

  function getSkinStatus(percent) {
    if (percent >= 80) return "Strong";
    if (percent >= 60) return "Balanced";
    if (percent >= 40) return "Needs care";
    return "Low";
  }

  function renderScorePanel(percent) {
    if (document.querySelector(".skin-score-panel")) return;

    const panel = document.createElement("section");
    panel.id = "skin-score-panel";
    panel.className = "skin-score-panel";
    panel.setAttribute("aria-label", "Your SkinScope score");
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="skin-score-panel-head">',
      '  <span>Your Skin Score</span>',
      '  <strong>' + percent + '%</strong>',
      '</div>',
      scoreBarHtml(percent, "skin-score-track", "Your skin score"),
      '<div class="skin-score-range">',
      '  <span>1</span>',
      '  <span>100</span>',
      '</div>',
      '<p class="skin-score-status">' + getSkinStatus(percent) + ' skin score from your latest SkinScope scan.</p>'
    ].join("");
    document.body.appendChild(panel);
  }

  function renderNavScore(percent) {
    const nav = document.querySelector("nav");
    if (!nav || document.querySelector(".nav-skin-score-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-skin-score-button";
    button.setAttribute("aria-label", "Open your Skin Score, " + percent + " percent");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "skin-score-panel");
    button.innerHTML = [
      '<span class="nav-score-dot" aria-hidden="true"></span>',
      '<span class="nav-score-text">Skin Score</span>',
      '<strong>' + percent + '%</strong>'
    ].join("");

    const accountLink = document.querySelector("#account-nav-link") || Array.from(nav.querySelectorAll("a")).find(function (link) {
      return link.textContent.trim().toLowerCase() === "account";
    });
    nav.insertBefore(button, accountLink || null);
  }

  function updatePanelState(open) {
    const panel = document.querySelector(".skin-score-panel");
    const button = document.querySelector(".nav-skin-score-button");

    if (!panel) return;
    panel.hidden = !open;

    if (button) {
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.classList.toggle("is-open", open);
    }
  }

  function pulseNavScore() {
    const button = document.querySelector(".nav-skin-score-button");
    if (!button) return;

    button.classList.remove("score-pulse");
    window.setTimeout(function () {
      button.classList.add("score-pulse");
      window.setTimeout(function () {
        button.classList.remove("score-pulse");
      }, 760);
    }, 20);
  }

  function openScorePanel(options) {
    const shouldTeleport = options && options.teleport;
    const button = document.querySelector(".nav-skin-score-button");

    updatePanelState(true);
    pulseNavScore();

    if (shouldTeleport) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (button) {
        window.setTimeout(function () {
          button.scrollIntoView({ block: "nearest", inline: "end", behavior: "smooth" });
        }, 140);
      }
    }
  }

  function bindScoreControls() {
    const navScore = document.querySelector(".nav-skin-score-button");
    const pet = document.querySelector(".skin-pet-widget");

    if (navScore && !navScore.dataset.bound) {
      navScore.dataset.bound = "true";
      navScore.addEventListener("click", function (event) {
        event.stopPropagation();
        const panel = document.querySelector(".skin-score-panel");
        updatePanelState(panel ? panel.hidden : true);
      });
    }

    if (pet && !pet.dataset.bound) {
      pet.dataset.bound = "true";
      pet.addEventListener("click", function (event) {
        event.stopPropagation();
        pet.classList.add("is-teleporting");
        openScorePanel({ teleport: true });
        window.setTimeout(function () {
          pet.classList.remove("is-teleporting");
        }, 620);
      });
    }

    if (globalControlsBound) return;
    globalControlsBound = true;

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".skin-score-panel") && !target.closest(".nav-skin-score-button") && !target.closest(".skin-pet-widget")) {
        updatePanelState(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") updatePanelState(false);
    });
  }

  function renderSkinPet() {
    const percent = getSkinPercent();
    renderNavScore(percent);
    renderScorePanel(percent);

    if (document.querySelector(".skin-pet-widget")) {
      bindScoreControls();
      return;
    }

    const widget = document.createElement("button");
    widget.type = "button";
    widget.className = "skin-pet-widget";
    widget.setAttribute("aria-label", "Open your SkinScope score");
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
      scoreBarHtml(percent, "skin-pet-bar", "Your skin percentage"),
      '</div>'
    ].join("");

    document.body.appendChild(widget);
    bindScoreControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSkinPet);
  } else {
    renderSkinPet();
  }
})();
