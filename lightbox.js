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

// Add click listener to all gallery images
document.querySelectorAll(".gallery img").forEach(img => {
  img.addEventListener("click", () => {
    // Set image
    lightboxImg.src = img.src;
    currentImageSrc = img.src;
    
    // Set metadata from data attributes
    const title = img.dataset.title || "Untitled";
    currentImageTitle = title;
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


// ===== SHARE FUNCTIONS =====
function shareOnFacebook() {
  const url = encodeURIComponent(window.location.href);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(`Check out "${currentImageTitle}" on aparfenen.art`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
}

function shareOnPinterest() {
  const url = encodeURIComponent(window.location.href);
  const imageUrl = encodeURIComponent(window.location.origin + '/' + currentImageSrc);
  const description = encodeURIComponent(currentImageTitle);
  window.open(`https://pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${description}`, '_blank', 'width=600,height=400');
}

function copyLink() {
  const copyButton = document.querySelector('.share-button.copy');
  const url = window.location.href;
  
  navigator.clipboard.writeText(url).then(() => {
    copyButton.textContent = '✓ Copied!';
    copyButton.classList.add('copied');
    
    setTimeout(() => {
      copyButton.innerHTML = '🔗 Copy Link';
      copyButton.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}


// ===== LIKES SYSTEM =====
const LIKES_KEY = 'aparfenen_art_likes';

// Load likes from localStorage
function loadLikes() {
  const stored = localStorage.getItem(LIKES_KEY);
  return stored ? JSON.parse(stored) : {};
}

// Save likes to localStorage
function saveLikes(likes) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
}

// Initialize likes
const likes = loadLikes();

// Add like buttons to all art blocks
document.querySelectorAll('.art-block').forEach((block, index) => {
  const img = block.querySelector('img');
  const artId = img.dataset.title || `art_${index}`;
  
  // Create like button
  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-button';
  likeBtn.setAttribute('aria-label', 'Like this artwork');
  likeBtn.innerHTML = likes[artId] ? '❤️' : '🤍';
  
  if (likes[artId]) {
    likeBtn.classList.add('liked');
  }
  
  // Handle like toggle
  likeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (likes[artId]) {
      delete likes[artId];
      likeBtn.innerHTML = '🤍';
      likeBtn.classList.remove('liked');
    } else {
      likes[artId] = true;
      likeBtn.innerHTML = '❤️';
      likeBtn.classList.add('liked');
    }
    
    saveLikes(likes);
  });
  
  block.appendChild(likeBtn);
});


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
