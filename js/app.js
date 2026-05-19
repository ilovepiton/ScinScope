let cameraStream = null;

function setupPhotoPreview() {
  const input = document.getElementById("face-photo");

  if (!input) return;

  input.addEventListener("change", function () {
    const file = input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
      const photoData = event.target.result;

      localStorage.setItem("skinscopeFacePhoto", photoData);
      showSelectedPhoto(photoData);
    };

    reader.readAsDataURL(file);
  });
}

function showSelectedPhoto(photoData) {
  const previewBox = document.getElementById("photo-preview");
  const previewImage = document.getElementById("preview-image");
  const actions = document.getElementById("selected-photo-actions");

  if (!previewBox || !previewImage || !actions) return;

  previewImage.src = photoData;
  previewBox.classList.remove("hidden");
  actions.classList.remove("hidden");
}

function clearSelectedPhoto() {
  const input = document.getElementById("face-photo");
  const previewBox = document.getElementById("photo-preview");
  const previewImage = document.getElementById("preview-image");
  const actions = document.getElementById("selected-photo-actions");

  localStorage.removeItem("skinscopeFacePhoto");

  if (input) input.value = "";
  if (previewImage) previewImage.src = "";
  if (previewBox) previewBox.classList.add("hidden");
  if (actions) actions.classList.add("hidden");
}

function analyzeFacePhoto() {
  const savedPhoto = localStorage.getItem("skinscopeFacePhoto");

  if (!savedPhoto) {
    alert("Please take or upload a face photo first.");
    return;
  }

  window.location.href = "result.html?v=30";
}

async function openCameraModal() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");

  if (!modal || !video) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: false
    });

    video.srcObject = cameraStream;
    modal.classList.remove("hidden");
  } catch (error) {
    alert("Camera is not available. Please upload a photo instead.");
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

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const photoData = canvas.toDataURL("image/png");

  localStorage.setItem("skinscopeFacePhoto", photoData);
  showSelectedPhoto(photoData);
  closeCameraModal();
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

document.addEventListener("DOMContentLoaded", function () {
  setupPhotoPreview();
  loadResultFacePhoto();
});
