// ===== LIGHTBOX WITH METADATA AND SHARE BUTTONS =====
const lightbox = document.getElementById("lightbox");
const lightboxContent = lightbox.querySelector(".lightbox-content");
const lightboxImg = lightbox.querySelector("img");
const lightboxTitle = lightbox.querySelector(".lightbox-title");
const lightboxDate = lightbox.querySelector(".lightbox-date");
const lightboxDescription = lightbox.querySelector(".lightbox-description");
const lightboxMetadata = lightbox.querySelector(".lightbox-metadata");

let currentImageSrc = "";
let currentImageTitle = "";
let currentImageId = "";

// Function to open lightbox for a specific image
function openLightbox(img) {
  // Set image
  lightboxImg.src = img.src;
  currentImageSrc = img.src;
  
  // Set metadata from data attributes
  const title = img.dataset.title || "Untitled";
  currentImageTitle = title;
  currentImageId = img.dataset.id || "";
  
  lightboxTitle.textContent = title;
  lightboxDate.textContent = img.dataset.date || "";
  lightboxDescription.textContent = img.dataset.description || "";
  
  // Build metadata string (dimensions and medium)
  const dimensions = img.dataset.dimensions || "";
  const medium = img.dataset.medium || "";
  
  let metadataText = "";
  if (dimensions && medium) {
    metadataText = `${dimensions} • ${medium}`;
  } else if (dimensions) {
    metadataText = dimensions;
  } else if (medium) {
    metadataText = medium;
  }
  
  // Show or hide metadata section
  if (metadataText) {
    lightboxMetadata.textContent = metadataText;
    lightboxMetadata.style.display = "block";
  } else {
    lightboxMetadata.style.display = "none";
  }
  
  // Update URL hash without scrolling
  if (currentImageId) {
    history.replaceState(null, null, `#${currentImageId}`);
  }
  
  // Show lightbox
  lightbox.classList.add("active");
}

// Add click listener to all gallery images
document.querySelectorAll(".gallery img").forEach(img => {
  img.addEventListener("click", () => {
    openLightbox(img);
  });
});

// Close lightbox on click (but not on image or info box)
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// Close lightbox function
function closeLightbox() {
  lightbox.classList.remove("active");
  // Remove hash from URL when closing
  history.replaceState(null, null, window.location.pathname);
}

// Also close on ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox.classList.contains("active")) {
    closeLightbox();
  }
});

// Check if URL has hash on page load and open corresponding lightbox
window.addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash.substring(1); // Remove #
  if (hash) {
    // Find the artwork with this ID
    const artBlock = document.getElementById(hash);
    if (artBlock) {
      const img = artBlock.querySelector("img");
      if (img) {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
          openLightbox(img);
        }, 300);
      }
    }
  }
});


// ===== SHARE FUNCTIONS =====
function getArtworkURL() {
  const baseUrl = window.location.origin + window.location.pathname;
  return currentImageId ? `${baseUrl}#${currentImageId}` : baseUrl;
}

function shareOnFacebook() {
  const url = encodeURIComponent(getArtworkURL());
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
  const url = encodeURIComponent(getArtworkURL());
  const text = encodeURIComponent(`Check out "${currentImageTitle}" by aparfenen`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
}

function shareOnPinterest() {
  const url = encodeURIComponent(getArtworkURL());
  const imageUrl = encodeURIComponent(window.location.origin + window.location.pathname.replace('index.html', '') + currentImageSrc);
  const description = encodeURIComponent(currentImageTitle);
  window.open(`https://pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${description}`, '_blank', 'width=600,height=400');
}

function copyLink() {
  const copyButton = document.querySelector('.share-button.copy');
  const url = getArtworkURL();
  
  navigator.clipboard.writeText(url).then(() => {
    const originalText = copyButton.innerHTML;
    copyButton.innerHTML = '✓ Copied!';
    copyButton.classList.add('copied');
    
    setTimeout(() => {
      copyButton.innerHTML = originalText;
      copyButton.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Link copied to clipboard:\n' + url);
  });
}


// ===== BACK TO TOP BUTTON =====
const backToTopBtn = document.createElement('button');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '↑';
backToTopBtn.setAttribute('aria-label', 'Back to top');
document.body.appendChild(backToTopBtn);

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Show/hide back to top button on scroll
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  if (scrollTop > 300) {
    backToTopBtn.classList.add('visible');
  } else {
    backToTopBtn.classList.remove('visible');
  }
  
  lastScrollTop = scrollTop;
});


// ===== CATEGORY INDICATOR =====
const categoryIndicator = document.createElement('div');
categoryIndicator.className = 'category-indicator';
document.body.appendChild(categoryIndicator);

// Get all section titles
const sections = document.querySelectorAll('h3.section-title');

// Update category indicator on scroll
function updateCategoryIndicator() {
  const scrollPosition = window.pageYOffset + 150;
  
  let currentSection = null;
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionBottom = sectionTop + section.offsetHeight + 400; // Include some gallery height
    
    if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
      currentSection = section.textContent;
    }
  });
  
  if (currentSection && window.pageYOffset > 500) {
    categoryIndicator.textContent = currentSection;
    categoryIndicator.classList.add('visible');
  } else {
    categoryIndicator.classList.remove('visible');
  }
}

window.addEventListener('scroll', updateCategoryIndicator);
updateCategoryIndicator(); // Initial check
