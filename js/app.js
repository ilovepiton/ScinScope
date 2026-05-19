function analyzeFacePhoto() {
  const input = document.getElementById("face-photo");

  if (!input || !input.files || !input.files[0]) {
    alert("Please take or upload a face photo first.");
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(event) {
    localStorage.setItem("skinscopeFacePhoto", event.target.result);
    window.location.href = "result.html";
  };

  reader.readAsDataURL(file);
}

function setupPhotoPreview() {
  const input = document.getElementById("face-photo");
  const previewBox = document.getElementById("photo-preview");
  const previewImage = document.getElementById("preview-image");

  if (!input || !previewBox || !previewImage) return;

  input.addEventListener("change", function() {
    const file = input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
      previewImage.src = event.target.result;
      previewBox.classList.remove("hidden");
    };

    reader.readAsDataURL(file);
  });
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
