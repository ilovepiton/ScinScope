let cameraStream = null;
let cameraReady = false;

const PHOTO_SIZE = 900;
const PHOTO_QUALITY = 0.82;

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
  localStorage.setItem("skinscopeFacePhoto", photoData);
  showFacePreview(photoData);
  enableAnalyzeButton();
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

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const image = new Image();

      image.onload = function () {
        const compressedPhoto = compressImageFromSource(
          image,
          image.naturalWidth,
          image.naturalHeight
        );

        saveFacePhoto(compressedPhoto);
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

function setTakePhotoButtonLoading() {
  const button = document.getElementById("take-camera-photo-button");

  if (!button) return;

  cameraReady = false;
  button.textContent = "Loading camera...";
  button.disabled = true;
  button.classList.add("disabled-button");
}

function setTakePhotoButtonReady() {
  const button = document.getElementById("take-camera-photo-button");

  if (!button) return;

  cameraReady = true;
  button.textContent = "Take Photo";
  button.disabled = false;
  button.classList.remove("disabled-button");
}

async function openCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");

  if (!modal || !video) return;

  setTakePhotoButtonLoading();

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

    await video.play();

    setTimeout(function () {
      if (video.videoWidth && video.videoHeight) {
        setTakePhotoButtonReady();
      }
    }, 500);
  } catch (error) {
    alert("Camera is not available. Please use Upload File.");
    closeCameraModal();
  }
}

function closeCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");

  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) {
      track.stop();
    });

    cameraStream = null;
  }

  cameraReady = false;

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (modal) modal.hidden = true;
}

function takeCameraPhoto() {
  const video = document.getElementById("camera-video");

  if (!video) return;

  if (!cameraReady || !video.videoWidth || !video.videoHeight) {
    setTimeout(takeCameraPhoto, 300);
    return;
  }

  const compressedPhoto = compressImageFromSource(
    video,
    video.videoWidth,
    video.videoHeight
  );

  saveFacePhoto(compressedPhoto);
  closeCameraModal();
}

function analyzeFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (!savedPhoto) {
    alert("Take a photo or upload a file first.");
    return;
  }

  window.location.href = "/ScinScope/pages/result.html?v=320";
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
    openCameraButton.addEventListener("click", openCameraModal);
  }

  if (takeCameraPhotoButton) {
    takeCameraPhotoButton.addEventListener("click", takeCameraPhoto);
    takeCameraPhotoButton.addEventListener("touchend", function (event) {
      event.preventDefault();
      takeCameraPhoto();
    });
  }

  if (closeCameraButton) {
    closeCameraButton.addEventListener("click", closeCameraModal);
  }

  if (cancelPhotoButton) {
    cancelPhotoButton.addEventListener("click", clearSelectedPhoto);
  }

  if (analyzeButton) {
    analyzeButton.addEventListener("click", analyzeFacePhoto);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  resetScanPage();
  setupUploadFile();
  setupButtons();
  loadResultFacePhoto();
});
