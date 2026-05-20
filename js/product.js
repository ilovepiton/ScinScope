let productCameraStream = null;
let takingProductPhoto = false;

const PRODUCT_PHOTO_WIDTH = 420;
const PRODUCT_PHOTO_HEIGHT = 600;
const PRODUCT_PHOTO_QUALITY = 0.65;

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

  context.drawImage(
    source,
    startX,
    startY,
    cropWidth,
    cropHeight,
    0,
    0,
    PRODUCT_PHOTO_WIDTH,
    PRODUCT_PHOTO_HEIGHT
  );

  return canvas.toDataURL("image/jpeg", PRODUCT_PHOTO_QUALITY);
}

function saveProductPhoto(photoData) {
  try {
    localStorage.removeItem("skinscopeFacePhoto");
    localStorage.setItem("skinscopeProductPhoto", photoData);
    showProductPreview(photoData);
    enableProductAnalyzeButton();
  } catch (error) {
    alert("Photo is still too large. Please try another JPG, PNG, or WebP photo.");
  }
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

function resetProductScanPage() {
  const input = document.getElementById("product-photo-input");
  if (!input) return;

  localStorage.removeItem("skinscopeProductPhoto");
  clearProductPhoto();
}

function setupProductUpload() {
  const input = document.getElementById("product-photo-input");

  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      alert("This product photo format is not supported yet. Please use JPG, PNG, or WebP.");
      input.value = "";
      return;
    }

    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = function () {
      const compressedPhoto = compressProductImage(
        image,
        image.naturalWidth,
        image.naturalHeight
      );

      URL.revokeObjectURL(imageUrl);
      saveProductPhoto(compressedPhoto);
    };

    image.onerror = function () {
      URL.revokeObjectURL(imageUrl);
      alert("This image could not be loaded. Please try JPG, PNG, or WebP.");
      input.value = "";
    };

    image.src = imageUrl;
  });
}

async function openProductCameraModal() {
  const modal = document.getElementById("product-camera-modal");
  const video = document.getElementById("product-camera-video");
  const button = document.getElementById("take-product-photo-button");

  if (!modal || !video) return;

  takingProductPhoto = false;

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

    try {
      await video.play();
    } catch (error) {}
  } catch (error) {
    alert("Camera is not available. Please use Upload File.");
    closeProductCameraModal();
  }
}

function closeProductCameraModal() {
  const modal = document.getElementById("product-camera-modal");
  const video = document.getElementById("product-camera-video");
  const button = document.getElementById("take-product-photo-button");

  if (productCameraStream) {
    productCameraStream.getTracks().forEach(function (track) {
      track.stop();
    });

    productCameraStream = null;
  }

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
    attempts++;

    if (video.videoWidth && video.videoHeight) {
      const compressedPhoto = compressProductImage(
        video,
        video.videoWidth,
        video.videoHeight
      );

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

      alert("Camera is still loading. Try again in one second.");
      return;
    }

    setTimeout(tryCapture, 250);
  }

  tryCapture();
}

function analyzeProductPhoto() {
  const savedPhoto = localStorage.getItem("skinscopeProductPhoto");

  if (!savedPhoto) {
    alert("Take or upload a product photo first.");
    return;
  }

  window.location.href = "/ScinScope/pages/product-loading.html";
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
  const cancelButton = document.getElementById("cancel-product-button");
  const analyzeButton = document.getElementById("analyze-product-button");

  if (openCameraButton) {
    openCameraButton.onclick = openProductCameraModal;
  }

  if (takePhotoButton) {
    takePhotoButton.onclick = takeProductCameraPhoto;

    takePhotoButton.ontouchstart = function (event) {
      event.preventDefault();
      takeProductCameraPhoto();
    };
  }

  if (closeCameraButton) {
    closeCameraButton.onclick = closeProductCameraModal;
  }

  if (cancelButton) {
    cancelButton.onclick = clearProductPhoto;
  }

  if (analyzeButton) {
    analyzeButton.onclick = analyzeProductPhoto;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  resetProductScanPage();
  setupProductUpload();
  setupProductButtons();
  loadProductResultPhoto();
});
