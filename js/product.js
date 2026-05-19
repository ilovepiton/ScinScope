const PRODUCT_PHOTO_SIZE = 900;
const PRODUCT_PHOTO_QUALITY = 0.82;

function compressProductImage(source, sourceWidth, sourceHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const size = Math.min(sourceWidth, sourceHeight);
  const startX = (sourceWidth - size) / 2;
  const startY = (sourceHeight - size) / 2;

  canvas.width = PRODUCT_PHOTO_SIZE;
  canvas.height = PRODUCT_PHOTO_SIZE;

  context.drawImage(
    source,
    startX,
    startY,
    size,
    size,
    0,
    0,
    PRODUCT_PHOTO_SIZE,
    PRODUCT_PHOTO_SIZE
  );

  return canvas.toDataURL("image/jpeg", PRODUCT_PHOTO_QUALITY);
}

function saveProductPhoto(photoData) {
  localStorage.setItem("skinscopeProductPhoto", photoData);
  showProductPreview(photoData);
  enableProductAnalyzeButton();
}

function showProductPreview(photoData) {
  const previewBox = document.getElementById("product-preview-box");
  const previewImage = document.getElementById("product-preview-image");
  const controlButtons = document.getElementById("product-control-buttons");

  if (!previewBox || !previewImage || !controlButtons) return;

  previewImage.src = photoData;
  previewBox.hidden = false;
  controlButtons.hidden = false;
}

function enableProductAnalyzeButton() {
  const button = document.getElementById("analyze-product-button");
  if (!button) return;

  button.classList.remove("disabled-button");
  button.disabled = false;
}

function disableProductAnalyzeButton() {
  const button = document.getElementById("analyze-product-button");
  if (!button) return;

  button.classList.add("disabled-button");
  button.disabled = true;
}

function clearProductPhoto() {
  const input = document.getElementById("product-photo-input");
  const previewBox = document.getElementById("product-preview-box");
  const previewImage = document.getElementById("product-preview-image");
  const controlButtons = document.getElementById("product-control-buttons");

  localStorage.removeItem("skinscopeProductPhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.src = "";
  if (previewBox) previewBox.hidden = true;
  if (controlButtons) controlButtons.hidden = true;

  disableProductAnalyzeButton();
}

function setupProductUpload() {
  const input = document.getElementById("product-photo-input");

  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const image = new Image();

      image.onload = function () {
        const compressedPhoto = compressProductImage(
          image,
          image.naturalWidth,
          image.naturalHeight
        );

        saveProductPhoto(compressedPhoto);
      };

      image.onerror = function () {
        alert("This image format is not supported. Please try another photo.");
        input.value = "";
      };

      image.src = event.target.result;
    };

    reader.onerror = function () {
      alert("Could not read this file. Please try another photo.");
      input.value = "";
    };

    reader.readAsDataURL(file);
  });
}

function analyzeProductPhoto() {
  const savedPhoto = localStorage.getItem("skinscopeProductPhoto");

  if (!savedPhoto) {
    alert("Upload a product photo first.");
    return;
  }

  window.location.href = "/ScinScope/pages/product-result.html";
}

function loadProductResultPhoto() {
  const resultImage = document.getElementById("product-result-image");
  const placeholder = document.getElementById("product-placeholder");

  if (!resultImage || !placeholder) return;

  const savedPhoto = localStorage.getItem("skinscopeProductPhoto");

  if (savedPhoto) {
    resultImage.src = savedPhoto;
    resultImage.style.display = "block";
    placeholder.style.display = "none";
  } else {
    resultImage.style.display = "none";
    placeholder.style.display = "block";
  }
}

function setupProductButtons() {
  const cancelButton = document.getElementById("cancel-product-button");
  const analyzeButton = document.getElementById("analyze-product-button");

  if (cancelButton) {
    cancelButton.onclick = clearProductPhoto;
  }

  if (analyzeButton) {
    analyzeButton.onclick = analyzeProductPhoto;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  clearProductPhoto();
  setupProductUpload();
  setupProductButtons();
  loadProductResultPhoto();
});
