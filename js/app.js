let cameraStream = null;

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
  previewBox.classList.remove("hidden");
  controlButtons.classList.remove("hidden");
}

function enableAnalyzeButton() {
  const analyzeButton = document.getElementById("analyze-photo-button");

  if (!analyzeButton) return;

  analyzeButton.classList.remove("disabled-button");
}

function disableAnalyzeButton() {
  const analyzeButton = document.getElementById("analyze-photo-button");

  if (!analyzeButton) return;

  analyzeButton.classList.add("disabled-button");
}

function clearSelectedPhoto() {
  const input = document.getElementById("face-photo-input");
  const previewBox = document.getElementById("photo-preview-box");
  const previewImage = document.getElementById("photo-preview-image");
  const controlButtons = document.getElementById("photo-control-buttons");

  localStorage.removeItem("skinscopeFacePhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.src = "";
  if (previewBox) previewBox.classList.add("hidden");
  if (controlButtons) controlButtons.classList.add("hidden");

  disableAnalyzeButton();
}

function setupUploadFile() {
  const input = document.getElementById("face-photo-input");

  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files && input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
      saveFacePhoto(event.target.result);
    };

    reader.readAsDataURL(file);
  });
}

async function openCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");

  if (!modal || !video) return;

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
    modal.classList.remove("hidden");
  } catch (error) {
    alert("Camera is not available. Please use Upload File.");
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

  if (video) video.srcObject = null;
  if (modal) modal.classList.add("hidden");
}

function takeCameraPhoto() {
  const video = document.getElementById("camera-video");
  const canvas = document.getElementById("camera-canvas");

  if (!video || !canvas) return;

  if (!video.videoWidth || !video.videoHeight) {
    alert("Camera is still loading. Wait one second and try again.");
    return;
  }

  const size = Math.min(video.videoWidth, video.videoHeight);
  const startX = (video.videoWidth - size) / 2;
  const startY = (video.videoHeight - size) / 2;

  canvas.width = 900;
  canvas.height = 900;

  const context = canvas.getContext("2d");

  context.drawImage(
    video,
    startX,
    startY,
    size,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const photoData = canvas.toDataURL("image/jpeg", 0.92);

  saveFacePhoto(photoData);
  closeCameraModal();
}

function analyzeFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (!savedPhoto) {
    alert("Take a photo or upload a file first.");
    return;
  }

  window.location.href = "/ScinScope/pages/result.html?v=50";
}

function loadSavedPhotoOnScanPage() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (!savedPhoto) {
    disableAnalyzeButton();
    return;
  }

  showFacePreview(savedPhoto);
  enableAnalyzeButton();
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
  setupUploadFile();
  setupButtons();
  loadSavedPhotoOnScanPage();
  loadResultFacePhoto();
});
