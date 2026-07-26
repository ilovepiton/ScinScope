const PLAN_STORAGE_KEY = "skinscopeSelectedPlan";

const PLAN_LABELS = {
  free: "Free beta",
  monthly: "Premium Monthly",
  lifetime: "Lifetime"
};

function getStoredPlan() {
  const storedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
  return PLAN_LABELS[storedPlan] ? storedPlan : "free";
}

function setPlanMessage(text, type = "info") {
  const message = document.getElementById("plan-message");
  if (!message) return;

  message.textContent = text;
  message.classList.remove("error", "success", "info");
  message.classList.add(type);
}

function renderPlanState(plan) {
  const currentPlanName = document.getElementById("current-plan-name");
  const currentPlanNote = document.getElementById("current-plan-note");
  const cards = document.querySelectorAll("[data-plan-card]");
  const buttons = document.querySelectorAll("[data-plan]");

  if (currentPlanName) {
    currentPlanName.textContent = PLAN_LABELS[plan];
  }

  if (currentPlanNote) {
    currentPlanNote.textContent =
      plan === "free"
        ? "Demo plan state stored on this device."
        : "Selected locally for demo only. No payment has been processed.";
  }

  cards.forEach(function (card) {
    const isActive = card.dataset.planCard === plan;
    card.classList.toggle("featured-plan", isActive);
    card.setAttribute("aria-current", isActive ? "true" : "false");
  });

  buttons.forEach(function (button) {
    const isActive = button.dataset.plan === plan;
    button.textContent = isActive ? "Selected" : button.dataset.plan === "monthly" ? "Choose Monthly" : "Choose Lifetime";
    button.classList.toggle("disabled-button", isActive);
    button.disabled = isActive;
  });
}

function selectPlan(plan) {
  localStorage.setItem(PLAN_STORAGE_KEY, plan);
  renderPlanState(plan);
  setPlanMessage(
    PLAN_LABELS[plan] + " is selected as demo state. Checkout is not connected, so no charge was made.",
    "success"
  );
}

function setupPlanPage() {
  document.querySelectorAll("[data-plan]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectPlan(button.dataset.plan);
    });
  });

  const upgradeLaterButton = document.getElementById("upgrade-later-button");

  if (upgradeLaterButton) {
    upgradeLaterButton.addEventListener("click", function () {
      localStorage.setItem(PLAN_STORAGE_KEY, "free");
      renderPlanState("free");
      setPlanMessage("Upgrade saved for later. You are still on the Free beta demo state.", "info");
    });
  }

  renderPlanState(getStoredPlan());
}

document.addEventListener("DOMContentLoaded", setupPlanPage);
