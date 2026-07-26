let cameraStream = null;
let takingPhoto = false;

const PHOTO_SIZE = 650;
const PHOTO_QUALITY = 0.72;
const FACE_MAX_FILE_SIZE = 8 * 1024 * 1024;
const FACE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SCAN_HISTORY_KEY = "skinscopeScanHistory";

function getPageUrl(pathFromRoot) {
  const path = window.location.pathname;

  if (path.includes("/ScinScope/")) {
    return "/ScinScope/" + pathFromRoot;
  }

  if (path.includes("/pages/")) {
    return pathFromRoot.replace("pages/", "");
  }

  return pathFromRoot;
}

function setFaceMessage(text, type = "info") {
  const message = document.getElementById("face-scan-message");
  if (!message) return;

  message.textContent = text;
  message.classList.remove("error", "success", "info");
  message.classList.add(type);
}

function compressImageFromSource(source, sourceWidth, sourceHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const size = Math.min(sourceWidth, sourceHeight);
  const startX = (sourceWidth - size) / 2;
  const startY = (sourceHeight - size) / 2;
  const lightFilter = getGentleLightFilter(source, startX, startY, size, size);

  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;

  context.filter = lightFilter;
  context.drawImage(source, startX, startY, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  context.filter = "none";
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

function getGentleLightFilter(source, startX, startY, width, height) {
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
      averageLuminance < 72 ? 1.24 :
      averageLuminance < 105 ? 1.18 :
      averageLuminance < 140 ? 1.10 :
      1.04;

    return "brightness(" + brightness + ") contrast(1.035) saturate(1.025)";
  } catch (error) {
    return "brightness(1.08) contrast(1.03) saturate(1.02)";
  }
}

function setAnalyzeButton(enabled) {
  const button = document.getElementById("analyze-face-button");
  if (!button) return;

  button.disabled = !enabled;
  button.classList.toggle("disabled-button", !enabled);
}

function showFacePreview(photoData) {
  const previewBox = document.getElementById("selected-photo-box");
  const previewImage = document.getElementById("selected-face-photo");

  if (!previewBox || !previewImage) return;

  previewImage.src = photoData;
  previewBox.hidden = false;
  setAnalyzeButton(true);
}

function saveFacePhoto(photoData) {
  try {
    localStorage.removeItem("skinscopeProductPhoto");
    localStorage.setItem("skinscopeFacePhoto", photoData);
    showFacePreview(photoData);
    setFaceMessage("Face photo is ready. You can analyze it now.", "success");
  } catch (error) {
    setFaceMessage("Photo is still too large. Please try another JPG, PNG, or WebP photo.", "error");
  }
}

function clearSelectedPhoto() {
  const input = document.getElementById("face-file-input");
  const previewBox = document.getElementById("selected-photo-box");
  const previewImage = document.getElementById("selected-face-photo");

  localStorage.removeItem("skinscopeFacePhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.removeAttribute("src");
  if (previewBox) previewBox.hidden = true;

  setAnalyzeButton(false);
  setFaceMessage("Take or upload a face photo to begin.", "info");
}

function validateImageFile(file) {
  if (!FACE_ALLOWED_TYPES.includes(file.type)) {
    return "This photo format is not supported yet. Please use JPG, PNG, or WebP.";
  }

  if (file.size > FACE_MAX_FILE_SIZE) {
    return "This photo is too large. Please choose an image under 8 MB.";
  }

  return "";
}

function handleFaceFile(file, input) {
  const validationError = validateImageFile(file);

  if (validationError) {
    if (input) input.value = "";
    setFaceMessage(validationError, "error");
    return;
  }

  const image = new Image();
  const imageUrl = URL.createObjectURL(file);

  image.onload = function () {
    const compressedPhoto = compressImageFromSource(image, image.naturalWidth, image.naturalHeight);
    URL.revokeObjectURL(imageUrl);
    saveFacePhoto(compressedPhoto);
  };

  image.onerror = function () {
    URL.revokeObjectURL(imageUrl);
    if (input) input.value = "";
    setFaceMessage("This image could not be loaded. Please try JPG, PNG, or WebP.", "error");
  };

  image.src = imageUrl;
}

function setupUploadFile() {
  const input = document.getElementById("face-file-input");
  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];
    if (!file) return;
    handleFaceFile(file, input);
  });
}

function setupUploadLabelKeyboard() {
  const label = document.querySelector("label[for='face-file-input']");
  const input = document.getElementById("face-file-input");

  if (!label || !input) return;

  label.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
}

function stopCameraStream() {
  if (!cameraStream) return;

  cameraStream.getTracks().forEach(function (track) {
    track.stop();
  });

  cameraStream = null;
}

async function openCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const takeButton = document.getElementById("take-camera-photo-button");

  if (!modal || !video) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setFaceMessage("Camera is not supported in this browser. Please use Upload File.", "error");
    return;
  }

  takingPhoto = false;
  stopCameraStream();

  if (takeButton) {
    takeButton.textContent = "Take Photo";
    takeButton.disabled = false;
    takeButton.classList.remove("disabled-button");
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 900 },
        height: { ideal: 900 }
      },
      audio: false
    });

    video.srcObject = cameraStream;
    modal.hidden = false;
    setFaceMessage("Camera is ready. Capture a clear face photo.", "info");

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  } catch (error) {
    closeCameraModal();
    setFaceMessage("Camera permission was denied or unavailable. Please use Upload File.", "error");
  }
}

function closeCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const takeButton = document.getElementById("take-camera-photo-button");

  stopCameraStream();
  takingPhoto = false;

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (takeButton) {
    takeButton.textContent = "Take Photo";
    takeButton.disabled = false;
    takeButton.classList.remove("disabled-button");
  }

  if (modal) modal.hidden = true;
}

function takeCameraPhoto() {
  const video = document.getElementById("camera-video");
  const takeButton = document.getElementById("take-camera-photo-button");

  if (!video || takingPhoto) return;

  takingPhoto = true;

  if (takeButton) {
    takeButton.textContent = "Taking...";
    takeButton.disabled = true;
    takeButton.classList.add("disabled-button");
  }

  let attempts = 0;

  function tryCapture() {
    attempts += 1;

    if (video.videoWidth && video.videoHeight) {
      const compressedPhoto = compressImageFromSource(video, video.videoWidth, video.videoHeight);
      saveFacePhoto(compressedPhoto);
      closeCameraModal();
      return;
    }

    if (attempts >= 8) {
      takingPhoto = false;

      if (takeButton) {
        takeButton.textContent = "Take Photo";
        takeButton.disabled = false;
        takeButton.classList.remove("disabled-button");
      }

      setFaceMessage("Camera is still loading. Try again in one second.", "error");
      return;
    }

    setTimeout(tryCapture, 250);
  }

  tryCapture();
}

function getScanHistory() {
  try {
    return JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function storeScanHistory(type) {
  const history = getScanHistory();
  const label = type === "face" ? "Face scan" : "Product scan";

  history.unshift({
    type: type,
    label: label,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
}

function analyzeFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");
  const button = document.getElementById("analyze-face-button");

  if (!savedPhoto) {
    setFaceMessage("Take a photo or upload a file first.", "error");
    setAnalyzeButton(false);
    return;
  }

  if (button) {
    button.textContent = "Analyzing...";
    button.disabled = true;
    button.classList.add("disabled-button");
  }

  setFaceMessage("Preparing your cosmetic demo report...", "info");
  storeScanHistory("face");

  window.setTimeout(function () {
    window.location.assign(getPageUrl("pages/loading.html"));
  }, 250);
}

function loadSavedFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (savedPhoto) {
    showFacePreview(savedPhoto);
    setFaceMessage("Face photo is ready. You can analyze it now.", "success");
  } else {
    setAnalyzeButton(false);
  }
}

function loadResultFacePhoto() {
  const resultImage = document.getElementById("result-face-image");
  const placeholder = document.getElementById("face-placeholder");

  if (!resultImage || !placeholder) return;

  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (savedPhoto) {
    resultImage.src = savedPhoto;
    resultImage.style.display = "block";
    placeholder.style.display = "none";
  } else {
    resultImage.style.display = "none";
    placeholder.style.display = "block";
  }
}

function setupButtons() {
  const openCameraButton = document.getElementById("open-camera-button");
  const takeCameraPhotoButton = document.getElementById("take-camera-photo-button");
  const closeCameraButton = document.getElementById("close-camera-button");
  const changePhotoButton = document.getElementById("change-photo-button");
  const analyzeButton = document.getElementById("analyze-face-button");

  if (openCameraButton) openCameraButton.addEventListener("click", openCameraModal);
  if (takeCameraPhotoButton) takeCameraPhotoButton.addEventListener("click", takeCameraPhoto);
  if (closeCameraButton) closeCameraButton.addEventListener("click", closeCameraModal);
  if (changePhotoButton) changePhotoButton.addEventListener("click", clearSelectedPhoto);
  if (analyzeButton) analyzeButton.addEventListener("click", analyzeFacePhoto);
}

function setupCameraCleanup() {
  window.addEventListener("pagehide", closeCameraModal);
  window.addEventListener("beforeunload", closeCameraModal);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeCameraModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  setupUploadFile();
  setupUploadLabelKeyboard();
  setupButtons();
  setupCameraCleanup();
  loadSavedFacePhoto();
  loadResultFacePhoto();
});
