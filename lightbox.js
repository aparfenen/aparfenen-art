// Lightbox with metadata functionality
const lightbox = document.getElementById("lightbox");
const lightboxContent = lightbox.querySelector(".lightbox-content");
const lightboxImg = lightbox.querySelector("img");
const lightboxTitle = lightbox.querySelector(".lightbox-title");
const lightboxDate = lightbox.querySelector(".lightbox-date");
const lightboxDescription = lightbox.querySelector(".lightbox-description");

// Add click listener to all gallery images
document.querySelectorAll(".gallery img").forEach(img => {
  img.addEventListener("click", () => {
    // Set image
    lightboxImg.src = img.src;
    
    // Set metadata from data attributes
    lightboxTitle.textContent = img.dataset.title || "Untitled";
    lightboxDate.textContent = img.dataset.date || "";
    lightboxDescription.textContent = img.dataset.description || "";
    
    // Show lightbox
    lightbox.classList.add("active");
  });
});

// Close lightbox on click (but not on image or info box)
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    lightbox.classList.remove("active");
  }
});

// Also close on ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox.classList.contains("active")) {
    lightbox.classList.remove("active");
  }
});
