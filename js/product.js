let productCameraStream = null;
let takingProductPhoto = false;

const PRODUCT_PHOTO_WIDTH = 420;
const PRODUCT_PHOTO_HEIGHT = 600;
const PRODUCT_PHOTO_QUALITY = 0.68;
const PRODUCT_MAX_FILE_SIZE = 8 * 1024 * 1024;
const PRODUCT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_SCAN_HISTORY_KEY = "skinscopeScanHistory";

function getProductPageUrl(pathFromRoot) {
  const path = window.location.pathname;

  if (path.includes("/ScinScope/")) {
    return "/ScinScope/" + pathFromRoot;
  }

  if (path.includes("/pages/")) {
    return pathFromRoot.replace("pages/", "");
  }

  return pathFromRoot;
}

function setProductMessage(text, type = "info") {
  const message = document.getElementById("product-scan-message");
  if (!message) return;

  message.textContent = text;
  message.classList.remove("error", "success", "info");
  message.classList.add(type);
}

function compressProductImage(source, sourceWidth, sourceHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const targetRatio = PRODUCT_PHOTO_WIDTH / PRODUCT_PHOTO_HEIGHT;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let startX = 0;
  let startY = 0;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    startX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    startY = (sourceHeight - cropHeight) / 2;
  }

  canvas.width = PRODUCT_PHOTO_WIDTH;
  canvas.height = PRODUCT_PHOTO_HEIGHT;

  context.filter = getGentleProductLightFilter(source, startX, startY, cropWidth, cropHeight);
  context.drawImage(source, startX, startY, cropWidth, cropHeight, 0, 0, PRODUCT_PHOTO_WIDTH, PRODUCT_PHOTO_HEIGHT);
  context.filter = "none";
  return canvas.toDataURL("image/jpeg", PRODUCT_PHOTO_QUALITY);
}

function getGentleProductLightFilter(source, startX, startY, width, height) {
  const sampleCanvas = document.createElement("canvas");
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });

  if (!sampleContext) return "brightness(1.06) contrast(1.03) saturate(1.02)";

  sampleCanvas.width = 24;
  sampleCanvas.height = 24;

  try {
    sampleContext.drawImage(source, startX, startY, width, height, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
    let luminanceTotal = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      luminanceTotal += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
    }

    const averageLuminance = luminanceTotal / (pixels.length / 4);
    const brightness =
      averageLuminance < 72 ? 1.22 :
      averageLuminance < 105 ? 1.16 :
      averageLuminance < 140 ? 1.09 :
      1.03;

    return "brightness(" + brightness + ") contrast(1.035) saturate(1.02)";
  } catch (error) {
    return "brightness(1.07) contrast(1.03) saturate(1.02)";
  }
}

function setProductAnalyzeButton(enabled) {
  const button = document.getElementById("analyze-product-button");
  if (!button) return;

  button.disabled = !enabled;
  button.classList.toggle("disabled-button", !enabled);
}

function showProductPreview(photoData) {
  const previewBox = document.getElementById("selected-product-box");
  const previewImage = document.getElementById("selected-product-photo");

  if (!previewBox || !previewImage) return;

  previewImage.src = photoData;
  previewBox.hidden = false;
  setProductAnalyzeButton(true);
}

function saveProductPhoto(photoData) {
  try {
    localStorage.removeItem("skinscopeFacePhoto");
    localStorage.setItem("skinscopeProductPhoto", photoData);
    showProductPreview(photoData);
    setProductMessage("Product photo is ready. You can analyze it now.", "success");
  } catch (error) {
    setProductMessage("Photo is still too large. Please try another JPG, PNG, or WebP photo.", "error");
  }
}

function clearProductPhoto() {
  const input = document.getElementById("product-file-input");
  const previewBox = document.getElementById("selected-product-box");
  const previewImage = document.getElementById("selected-product-photo");

  localStorage.removeItem("skinscopeProductPhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.removeAttribute("src");
  if (previewBox) previewBox.hidden = true;

  setProductAnalyzeButton(false);
  setProductMessage("Take or upload a product photo to begin.", "info");
}

function validateProductFile(file) {
  if (!PRODUCT_ALLOWED_TYPES.includes(file.type)) {
    return "This product photo format is not supported yet. Please use JPG, PNG, or WebP.";
  }

  if (file.size > PRODUCT_MAX_FILE_SIZE) {
    return "This product photo is too large. Please choose an image under 8 MB.";
  }

  return "";
}

function handleProductFile(file, input) {
  const validationError = validateProductFile(file);

  if (validationError) {
    if (input) input.value = "";
    setProductMessage(validationError, "error");
    return;
  }

  const image = new Image();
  const imageUrl = URL.createObjectURL(file);

  image.onload = function () {
    const compressedPhoto = compressProductImage(image, image.naturalWidth, image.naturalHeight);
    URL.revokeObjectURL(imageUrl);
    saveProductPhoto(compressedPhoto);
  };

  image.onerror = function () {
    URL.revokeObjectURL(imageUrl);
    if (input) input.value = "";
    setProductMessage("This image could not be loaded. Please try JPG, PNG, or WebP.", "error");
  };

  image.src = imageUrl;
}

function setupProductUpload() {
  const input = document.getElementById("product-file-input");
  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];
    if (!file) return;
    handleProductFile(file, input);
  });
}

function setupProductUploadLabelKeyboard() {
  const label = document.querySelector("label[for='product-file-input']");
  const input = document.getElementById("product-file-input");

  if (!label || !input) return;

  label.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
}

function stopProductCameraStream() {
  if (!productCameraStream) return;

  productCameraStream.getTracks().forEach(function (track) {
    track.stop();
  });

  productCameraStream = null;
}

async function openProductCameraModal() {
  const modal = document.getElementById("product-camera-modal");
  const video = document.getElementById("product-camera-video");
  const button = document.getElementById("take-product-photo-button");

  if (!modal || !video) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setProductMessage("Camera is not supported in this browser. Please use Upload Product File.", "error");
    return;
  }

  takingProductPhoto = false;
  stopProductCameraStream();

  if (button) {
    button.textContent = "Take Photo";
    button.disabled = false;
    button.classList.remove("disabled-button");
  }

  try {
    productCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 900 },
        height: { ideal: 1200 }
      },
      audio: false
    });

    video.srcObject = productCameraStream;
    modal.hidden = false;
    setProductMessage("Camera is ready. Capture a clear product photo.", "info");

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  } catch (error) {
    closeProductCameraModal();
    setProductMessage("Camera permission was denied or unavailable. Please use Upload Product File.", "error");
  }
}

function closeProductCameraModal() {
  const modal = document.getElementById("product-camera-modal");
  const video = document.getElementById("product-camera-video");
  const button = document.getElementById("take-product-photo-button");

  stopProductCameraStream();
  takingProductPhoto = false;

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (button) {
    button.textContent = "Take Photo";
    button.disabled = false;
    button.classList.remove("disabled-button");
  }

  if (modal) modal.hidden = true;
}

function takeProductCameraPhoto() {
  const video = document.getElementById("product-camera-video");
  const button = document.getElementById("take-product-photo-button");

  if (!video || takingProductPhoto) return;

  takingProductPhoto = true;

  if (button) {
    button.textContent = "Taking...";
    button.disabled = true;
    button.classList.add("disabled-button");
  }

  let attempts = 0;

  function tryCapture() {
    attempts += 1;

    if (video.videoWidth && video.videoHeight) {
      const compressedPhoto = compressProductImage(video, video.videoWidth, video.videoHeight);
      saveProductPhoto(compressedPhoto);
      closeProductCameraModal();
      return;
    }

    if (attempts >= 8) {
      takingProductPhoto = false;

      if (button) {
        button.textContent = "Take Photo";
        button.disabled = false;
        button.classList.remove("disabled-button");
      }

      setProductMessage("Camera is still loading. Try again in one second.", "error");
      return;
    }

    setTimeout(tryCapture, 250);
  }

  tryCapture();
}

function getProductScanHistory() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCT_SCAN_HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function storeProductScanHistory() {
  const history = getProductScanHistory();

  history.unshift({
    type: "product",
    label: "Product scan",
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(PRODUCT_SCAN_HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
}

function analyzeProductPhoto() {
  const savedPhoto = localStorage.getItem("skinscopeProductPhoto");
  const button = document.getElementById("analyze-product-button");

  if (!savedPhoto) {
    setProductMessage("Take or upload a product photo first.", "error");
    setProductAnalyzeButton(false);
    return;
  }

  if (button) {
    button.textContent = "Analyzing...";
    button.disabled = true;
    button.classList.add("disabled-button");
  }

  setProductMessage("Preparing your demo compatibility report...", "info");
  storeProductScanHistory();

  window.setTimeout(function () {
    window.location.assign(getProductPageUrl("pages/product-loading.html"));
  }, 250);
}

function loadSavedProductPhoto() {
  const savedPhoto = localStorage.getItem("skinscopeProductPhoto");

  if (savedPhoto) {
    showProductPreview(savedPhoto);
    setProductMessage("Product photo is ready. You can analyze it now.", "success");
  } else {
    setProductAnalyzeButton(false);
  }
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
  const openCameraButton = document.getElementById("open-product-camera-button");
  const takePhotoButton = document.getElementById("take-product-photo-button");
  const closeCameraButton = document.getElementById("close-product-camera-button");
  const changeButton = document.getElementById("change-product-photo-button");
  const analyzeButton = document.getElementById("analyze-product-button");

  if (openCameraButton) openCameraButton.addEventListener("click", openProductCameraModal);
  if (takePhotoButton) takePhotoButton.addEventListener("click", takeProductCameraPhoto);
  if (closeCameraButton) closeCameraButton.addEventListener("click", closeProductCameraModal);
  if (changeButton) changeButton.addEventListener("click", clearProductPhoto);
  if (analyzeButton) analyzeButton.addEventListener("click", analyzeProductPhoto);
}

function setupProductCameraCleanup() {
  window.addEventListener("pagehide", closeProductCameraModal);
  window.addEventListener("beforeunload", closeProductCameraModal);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeProductCameraModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  setupProductUpload();
  setupProductUploadLabelKeyboard();
  setupProductButtons();
  setupProductCameraCleanup();
  loadSavedProductPhoto();
  loadProductResultPhoto();
});
