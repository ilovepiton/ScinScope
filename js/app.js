function goToScan() {
  window.location.href = "pages/scan.html";
}

function goToResult() {
  window.location.href = "result.html";
}

function goToAccount() {
  window.location.href = "pages/account.html";
}

function showDemoResult() {
  const scoreElement = document.getElementById("skin-score");
  const statusElement = document.getElementById("skin-status");
  const observationsElement = document.getElementById("skin-observations");
  const adviceElement = document.getElementById("skin-advice");
  const productsElement = document.getElementById("skin-products");

  if (!scoreElement) return;

  scoreElement.textContent = mockSkinReport.score + "/100";
  statusElement.textContent = mockSkinReport.status;

  observationsElement.innerHTML = mockSkinReport.observations
    .map(item => `<li>${item}</li>`)
    .join("");

  adviceElement.innerHTML = mockSkinReport.advice
    .map(item => `<li>${item}</li>`)
    .join("");

  productsElement.innerHTML = mockSkinReport.products
    .map(item => `<li>${item}</li>`)
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  showDemoResult();
});
