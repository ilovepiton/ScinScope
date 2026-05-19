let selectedFacePhoto = null;
let cameraStream = null;

function setupPhotoPreview() {
  const input = document.getElementById("face-photo");

  if (!input) return;

  input.addEventListener("change", function() {
    const file = input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
      selectedFacePhoto = event.target.result;
      showSelectedPhoto(selectedFacePhoto);
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
  selectedFacePhoto = null;

  const input = document.getElementById("face-photo");
  const previewBox = document.getElementById("photo-preview");
  const previewImage = document.getElementById("preview-image");
  const actions = document.getElementById("selected-photo-actions");

  if (input) input.value = "";
  if (previewImage) previewImage.src = "";
  if (previewBox) previewBox.classList.add("hidden");
  if (actions) actions.classList.add("hidden");

  localStorage.removeItem("skinscopeFacePhoto");
}

function analyzeFacePhoto() {
  if (!selectedFacePhoto) {
    alert("Please take or upload a face photo first.");
    return;
  }

  localStorage.setItem("skinscopeFacePhoto", selectedFacePhoto);
  window.location.href = "result.html";
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
    cameraStream.getTracks().forEach(track => track.stop());
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

  selectedFacePhoto = canvas.toDataURL("image/png");

  showSelectedPhoto(selectedFacePhoto);
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

document.addEventListener("DOMContentLoaded", function() {
  setupPhotoPreview();
  loadResultFacePhoto();
});
