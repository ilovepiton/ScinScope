let cameraStream = null;
let takingPhoto = false;

const PHOTO_SIZE = 650;
const PHOTO_QUALITY = 0.7;

function compressImageFromSource(source, sourceWidth, sourceHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const size = Math.min(sourceWidth, sourceHeight);
  const startX = (sourceWidth - size) / 2;
  const startY = (sourceHeight - size) / 2;

  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;

  context.drawImage(
    source,
    startX,
    startY,
    size,
    size,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE
  );

  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

function saveFacePhoto(photoData) {
  try {
    localStorage.removeItem("skinscopeProductPhoto");
    localStorage.setItem("skinscopeFacePhoto", photoData);
    showFacePreview(photoData);
    enableAnalyzeButton();
  } catch (error) {
    alert("Photo is still too large. Please try another JPG, PNG, or WebP photo.");
  }
}

function showFacePreview(photoData) {
  const previewBox = document.getElementById("photo-preview-box");
  const previewImage = document.getElementById("photo-preview-image");
  const controlButtons = document.getElementById("photo-control-buttons");

  if (!previewBox || !previewImage || !controlButtons) return;

  previewImage.src = photoData;
  previewBox.hidden = false;
  controlButtons.hidden = false;
}

function enableAnalyzeButton() {
  const button = document.getElementById("analyze-photo-button");
  if (!button) return;

  button.classList.remove("disabled-button");
  button.disabled = false;
}

function disableAnalyzeButton() {
  const button = document.getElementById("analyze-photo-button");
  if (!button) return;

  button.classList.add("disabled-button");
  button.disabled = true;
}

function clearSelectedPhoto() {
  const input = document.getElementById("face-photo-input");
  const previewBox = document.getElementById("photo-preview-box");
  const previewImage = document.getElementById("photo-preview-image");
  const controlButtons = document.getElementById("photo-control-buttons");

  localStorage.removeItem("skinscopeFacePhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.src = "";
  if (previewBox) previewBox.hidden = true;
  if (controlButtons) controlButtons.hidden = true;

  disableAnalyzeButton();
}

function resetScanPage() {
  const input = document.getElementById("face-photo-input");
  if (!input) return;

  localStorage.removeItem("skinscopeFacePhoto");
  clearSelectedPhoto();
}

function setupUploadFile() {
  const input = document.getElementById("face-photo-input");
  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      alert("This photo format is not supported yet. Please use JPG, PNG, or WebP.");
      input.value = "";
      return;
    }

    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = function () {
      const compressedPhoto = compressImageFromSource(
        image,
        image.naturalWidth,
        image.naturalHeight
      );

      URL.revokeObjectURL(imageUrl);
      saveFacePhoto(compressedPhoto);
    };

    image.onerror = function () {
      URL.revokeObjectURL(imageUrl);
      alert("This image could not be loaded. Please try JPG, PNG, or WebP.");
      input.value = "";
    };

    image.src = imageUrl;
  });
}

async function openCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const takeButton = document.getElementById("take-camera-photo-button");

  if (!modal || !video) return;

  takingPhoto = false;

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

    try {
      await video.play();
    } catch (error) {}
  } catch (error) {
    alert("Camera is not available. Please use Upload File.");
    closeCameraModal();
  }
}

function closeCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const takeButton = document.getElementById("take-camera-photo-button");

  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) {
      track.stop();
    });

    cameraStream = null;
  }

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
    attempts++;

    if (video.videoWidth && video.videoHeight) {
      const compressedPhoto = compressImageFromSource(
        video,
        video.videoWidth,
        video.videoHeight
      );

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

      alert("Camera is still loading. Try again in one second.");
      return;
    }

    setTimeout(tryCapture, 250);
  }

  tryCapture();
}

function analyzeFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (!savedPhoto) {
    alert("Take a photo or upload a file first.");
    return;
  }

  window.location.href = "/ScinScope/pages/loading.html";
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
  const cancelPhotoButton = document.getElementById("cancel-photo-button");
  const analyzeButton = document.getElementById("analyze-photo-button");

  if (openCameraButton) {
    openCameraButton.onclick = openCameraModal;
  }

  if (takeCameraPhotoButton) {
    takeCameraPhotoButton.onclick = takeCameraPhoto;

    takeCameraPhotoButton.ontouchstart = function (event) {
      event.preventDefault();
      takeCameraPhoto();
    };
  }

  if (closeCameraButton) {
    closeCameraButton.onclick = closeCameraModal;
  }

  if (cancelPhotoButton) {
    cancelPhotoButton.onclick = clearSelectedPhoto;
  }

  if (analyzeButton) {
    analyzeButton.onclick = analyzeFacePhoto;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  resetScanPage();
  setupUploadFile();
  setupButtons();
  loadResultFacePhoto();
});
