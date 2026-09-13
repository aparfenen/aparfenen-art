const lightbox = document.getElementById("lightbox");
const lightboxContent = lightbox.querySelector(".lightbox-content");
const lightboxImg = lightbox.querySelector("img");
const lightboxTitle = lightbox.querySelector(".lightbox-title");
const lightboxDate = lightbox.querySelector(".lightbox-date");
const lightboxDescription = lightbox.querySelector(".lightbox-description");
const lightboxMetadata = lightbox.querySelector(".lightbox-metadata");
const lightboxLoader = lightbox.querySelector(".lightbox-loader");
const lightboxDownload = lightbox.querySelector(".lightbox-download");
const lightboxToast = lightbox.querySelector(".lightbox-toast");

let currentImageSrc = "";
let currentImageTitle = "";
let currentImageId = "";
let allGalleryImages = [];
let currentImageIndex = -1;

let lightboxOwnsHistoryEntry = false;

function urlWithHash(id) {
  const base = `${window.location.pathname}${window.location.search}`;
  return id ? `${base}#${id}` : base;
}

function findImageById(id) {
  if (!id) return null;

  const activeGallery = document.querySelector('.gallery-container.active');
  if (activeGallery) {
    const img = Array.from(activeGallery.querySelectorAll('.art-block img'))
      .find(candidate => candidate.dataset.id === id);
    if (img) return img;
  }

  const artBlock = document.getElementById(id);
  return artBlock ? artBlock.querySelector('img') : null;
}

let lockedScrollY = 0;
let isScrollLocked = false;

function lockPageScroll() {
  if (isScrollLocked) return;
  lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.classList.add('scroll-locked');
  isScrollLocked = true;
}

function unlockPageScroll() {
  if (!isScrollLocked) return;
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  isScrollLocked = false;
  const root = document.documentElement;
  const prevScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, lockedScrollY);
  root.style.scrollBehavior = prevScrollBehavior;
}

function updateGalleryImagesArray() {
  const activeGallery = document.querySelector('.gallery-container.active');

  if (activeGallery) {
    allGalleryImages = Array.from(activeGallery.querySelectorAll('.art-block img'))
      .filter(img => {
        const artBlock = img.closest('.art-block');
        return artBlock && artBlock.style.display !== 'none'
          && !artBlock.classList.contains('is-preview-hidden');
      });
    console.log(`[Lightbox] Updated gallery images: ${allGalleryImages.length} visible images in active gallery`);
  } else {
    const chronoGallery = document.getElementById('chronological-gallery') ||
                          document.querySelector('.gallery-container');

    if (chronoGallery) {
      allGalleryImages = Array.from(chronoGallery.querySelectorAll('.art-block img'))
        .filter(img => {
          const artBlock = img.closest('.art-block');
          return artBlock && artBlock.style.display !== 'none';
        });
      console.log(`[Lightbox] Updated gallery images (fallback): ${allGalleryImages.length} visible images`);
    } else {
      console.error('[Lightbox] No gallery found!');
      allGalleryImages = [];
    }
  }
  
  return allGalleryImages.length;
}

function getFullImageSources(imgElement) {
  const jpgSrc = imgElement.dataset.fullSrc || imgElement.src;
  const webpSrc = imgElement.dataset.fullSrcWebp || "";
  return { jpgSrc, webpSrc };
}

function prefetchNeighborImages() {
  if (allGalleryImages.length < 2 || currentImageIndex === -1) return;

  const nextIdx = (currentImageIndex + 1) % allGalleryImages.length;
  const prevIdx = (currentImageIndex - 1 + allGalleryImages.length) % allGalleryImages.length;

  [nextIdx, prevIdx].forEach(idx => {
    const img = allGalleryImages[idx];
    if (!img) return;
    const { jpgSrc, webpSrc } = getFullImageSources(img);
    const prefetch = new Image();
    prefetch.src = webpSrc || jpgSrc;
  });
}

function loadImageWithLoader(imgElement, onLoadComplete) {
  lightboxLoader.style.display = "block";
  lightboxImg.classList.add("is-loading");
  lightboxImg.src = imgElement.currentSrc || imgElement.src;

  const { jpgSrc, webpSrc } = getFullImageSources(imgElement);
  let triedFallback = false;

  const preloadImg = new Image();

  preloadImg.onload = function() {
    lightboxImg.src = preloadImg.src;
    currentImageSrc = preloadImg.src;

    lightboxLoader.style.display = "none";
    lightboxImg.classList.remove("is-loading");

    if (onLoadComplete) {
      onLoadComplete(imgElement);
    }

    positionTouchNav();

    console.log(`[Lightbox] Image loaded: ${preloadImg.src}`);

    prefetchNeighborImages();
  };

  preloadImg.onerror = function() {
    if (!triedFallback && preloadImg.src !== jpgSrc) {
      triedFallback = true;
      preloadImg.src = jpgSrc;
      return;
    }

    console.error(`[Lightbox] Failed to load image: ${preloadImg.src}`);
    lightboxLoader.style.display = "none";
    lightboxImg.classList.remove("is-loading");
  };

  preloadImg.src = webpSrc || jpgSrc;
}

function positionTouchNav() {
  if (!lightbox.classList.contains('active')) return;
  const contentRect = lightboxContent.getBoundingClientRect();
  const imgRect = lightboxImg.getBoundingClientRect();
  if (!imgRect.height) return;
  const fromBottom = Math.max(0, Math.round(contentRect.bottom - imgRect.bottom));
  lightboxContent.style.setProperty('--lb-img-bottom', `${fromBottom}px`);
}

let touchNavResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(touchNavResizeTimer);
  touchNavResizeTimer = setTimeout(positionTouchNav, 120);
});

function updateLightboxMetadata(img) {
  const title = img.dataset.title || "Untitled";
  currentImageTitle = title;
  currentImageId = img.dataset.id || "";

  lightboxTitle.textContent = title;
  lightboxDate.textContent = img.dataset.dateExact || img.dataset.date || "";
  lightboxDescription.textContent = img.dataset.description || "";

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

  if (lightboxDownload) {
    const source = img.dataset.fullSrc || img.currentSrc || img.src;
    const extension = (source.split('.').pop() || 'jpg').split(/[?#]/)[0];
    const safeTitle = title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'artwork';
    lightboxDownload.href = source;
    lightboxDownload.setAttribute('download', `${safeTitle}.${extension}`);
    lightboxDownload.setAttribute('aria-label', `Download “${title}”`);
    lightboxDownload.setAttribute('title', `Download “${title}”`);
  }

  if (metadataText) {
    lightboxMetadata.textContent = metadataText;
    lightboxMetadata.style.display = "block";
  } else {
    lightboxMetadata.style.display = "none";
  }

  if (currentImageId) {
    history.replaceState({ artwork: currentImageId }, '', urlWithHash(currentImageId));
  }
}

function openLightbox(img, { fromHistory = false } = {}) {

  updateGalleryImagesArray();

  currentImageIndex = allGalleryImages.indexOf(img);

  if (currentImageIndex === -1) {
    console.warn('[Lightbox] Image not in the filtered set - showing it anyway');
    allGalleryImages = [img, ...allGalleryImages];
    currentImageIndex = 0;
  }

  if (!fromHistory) {
    const id = img.dataset.id || '';
    if (id) {
      history.pushState({ artwork: id }, '', urlWithHash(id));
      lightboxOwnsHistoryEntry = true;
    }
  }

  updateCounter();

  lightbox.classList.add("active");
  lockPageScroll();

  loadImageWithLoader(img, updateLightboxMetadata);

  const title = img.dataset.title || "Untitled";
  console.log(`[Lightbox] Opening image ${currentImageIndex + 1}/${allGalleryImages.length}: "${title}"`);
}

function navigateImage(direction) {
  if (allGalleryImages.length === 0) {
    console.warn('[Lightbox] No images available for navigation');
    return;
  }

  if (direction === 'next') {
    currentImageIndex = (currentImageIndex + 1) % allGalleryImages.length;
  } else if (direction === 'prev') {
    currentImageIndex = (currentImageIndex - 1 + allGalleryImages.length) % allGalleryImages.length;
  }

  if (currentImageIndex < 0 || currentImageIndex >= allGalleryImages.length) {
    console.error(`[Lightbox] Invalid image index: ${currentImageIndex}`);
    currentImageIndex = Math.max(0, Math.min(currentImageIndex, allGalleryImages.length - 1));
  }

  const newImg = allGalleryImages[currentImageIndex];
  if (newImg) {
    setZoomed(false);
    updateCounter();

    loadImageWithLoader(newImg, updateLightboxMetadata);

    const title = newImg.dataset.title || "Untitled";
    console.log(`[Lightbox] Navigating to image ${currentImageIndex + 1}/${allGalleryImages.length}: "${title}"`);
  } else {
    console.error(`[Lightbox] Image not found at index ${currentImageIndex}`);
  }
}

function updateCounter() {
  const counter = document.querySelector('.lightbox-counter');
  if (counter) {
    if (allGalleryImages.length > 0) {
      const current = currentImageIndex + 1;
      const total = allGalleryImages.length;
      counter.textContent = `${current} / ${total}`;
      console.log(`[Lightbox] Counter updated: ${current}/${total}`);
    } else {
      counter.textContent = '0 / 0';
      console.warn('[Lightbox] No images in gallery');
    }
  }
}

document.querySelectorAll(".gallery img").forEach(img => {
  img.addEventListener("click", () => {
    openLightbox(img);
  });
});

let lightboxToastTimer;
function showLightboxToast(message) {
  if (!lightboxToast) return;
  lightboxToast.textContent = message;
  lightboxToast.classList.add('is-visible');
  clearTimeout(lightboxToastTimer);
  lightboxToastTimer = setTimeout(() => lightboxToast.classList.remove('is-visible'), 2200);
}

function artworkShareURL() {
  const base = `${window.location.origin}${window.location.pathname}`;
  return currentImageId ? `${base}#${currentImageId}` : base;
}

function copyViaTextarea(text) {
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch (e) {
    return false;
  }
}

function copyArtworkLink() {
  const url = artworkShareURL();
  const confirmCopied = () => showLightboxToast('Link copied to clipboard');
  const tryFallback = () => {
    if (copyViaTextarea(url)) confirmCopied();
    else window.prompt('Copy this link:', url);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(confirmCopied).catch(tryFallback);
  } else {
    tryFallback();
  }
}

function openShareWindow(href) {
  window.open(href, '_blank', 'width=600,height=460,noopener,noreferrer');
}

const SHARE_TARGETS = {
  copy: copyArtworkLink,
  facebook() {
    openShareWindow('https://www.facebook.com/sharer/sharer.php?u=' +
      encodeURIComponent(artworkShareURL()));
  },
  x() {
    const text = encodeURIComponent(`“${currentImageTitle}” by aparfenen`);
    openShareWindow(`https://x.com/intent/tweet?url=${encodeURIComponent(artworkShareURL())}&text=${text}`);
  },
  pinterest() {
    openShareWindow('https://pinterest.com/pin/create/button/'
      + `?url=${encodeURIComponent(artworkShareURL())}`
      + `&media=${encodeURIComponent(currentImageSrc)}`
      + `&description=${encodeURIComponent(currentImageTitle)}`);
  }
};

const shareButton = lightbox.querySelector('.lightbox-share');
const shareMenu = lightbox.querySelector('.lightbox-share-menu');

function closeShareMenu() {
  if (!shareMenu) return;
  shareMenu.hidden = true;
  if (shareButton) shareButton.setAttribute('aria-expanded', 'false');
}

function toggleShareMenu() {
  if (!shareMenu) return;
  const willOpen = shareMenu.hidden;
  shareMenu.hidden = !willOpen;
  if (shareButton) shareButton.setAttribute('aria-expanded', String(willOpen));
}

if (shareButton && shareMenu) {
  shareButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleShareMenu();
  });

  shareMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-share]');
    if (!item) return;
    closeShareMenu();
    const run = SHARE_TARGETS[item.dataset.share];
    if (run) run();
  });

  lightbox.addEventListener('click', () => closeShareMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || shareMenu.hidden) return;
    e.stopPropagation();
    closeShareMenu();
    shareButton.focus();
  }, true);
}

let navPeekTimer;
function peekTouchNav() {
  lightbox.classList.add('nav-peek');
  clearTimeout(navPeekTimer);
  navPeekTimer = setTimeout(() => lightbox.classList.remove('nav-peek'), 1300);
}

lightbox.querySelectorAll('.lightbox-nav').forEach(btn => {
  btn.addEventListener('click', peekTouchNav);
});

function setZoomed(on) {
  lightbox.classList.toggle('is-zoomed', on);
  lightboxImg.style.cursor = on ? 'zoom-out' : 'zoom-in';
}

lightboxImg.addEventListener('click', (e) => {
  e.stopPropagation();
  setZoomed(!lightbox.classList.contains('is-zoomed'));
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

function closeLightbox(fromHistory = false) {
  lightbox.classList.remove("active");
  lightbox.classList.remove("nav-peek");
  clearTimeout(navPeekTimer);
  setZoomed(false);
  if (lightboxToast) lightboxToast.classList.remove('is-visible');
  clearTimeout(lightboxToastTimer);
  closeShareMenu();
  unlockPageScroll();
  lightboxLoader.style.display = "none";
  lightboxImg.classList.remove("is-loading");

  if (fromHistory) {
    lightboxOwnsHistoryEntry = false;
  } else if (lightboxOwnsHistoryEntry) {
    lightboxOwnsHistoryEntry = false;
    history.back();
  } else {
    history.replaceState(history.state, '', urlWithHash(''));
  }

  console.log('[Lightbox] Closed');
}

function handleLightboxPopState() {
  const id = window.location.hash.substring(1);
  const isOpen = lightbox.classList.contains('active');

  if (id) {
    const img = findImageById(id);
    if (img) {
      if (!isOpen || img !== allGalleryImages[currentImageIndex]) {
        openLightbox(img, { fromHistory: true });
      }
    }
  } else if (isOpen) {
    closeLightbox(true);
  }
}

document.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("active")) {
    switch(e.key) {
      case "Escape":
        closeLightbox();
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateImage('next');
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateImage('prev');
        break;
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const imageCount = updateGalleryImagesArray();
  console.log(`[Lightbox] Page loaded with ${imageCount} images`);

  window.addEventListener('popstate', handleLightboxPopState);

  const hash = window.location.hash.substring(1);
  if (hash) {
    console.log(`[Lightbox] Found hash in URL: ${hash}`);
    const img = findImageById(hash);
    if (img) {
      setTimeout(() => {
        openLightbox(img, { fromHistory: true });
      }, 300);
    } else {
      console.warn(`[Lightbox] Artwork not found: ${hash}`);
    }
  }
});


const HEADING_STOP = 0.32;
const SCREEN_STEP = 0.8;

function activeSectionOffsets() {
  const container = document.querySelector('.gallery-container.active');
  if (!container) return [];
  return Array.from(container.querySelectorAll('.section-title'))
    .filter(heading => heading.offsetParent !== null)
    .map(heading => heading.getBoundingClientRect().top + window.pageYOffset)
    .sort((a, b) => a - b);
}

function scrollByStep(direction) {
  const stops = activeSectionOffsets();
  const anchor = window.pageYOffset + window.innerHeight * HEADING_STOP;

  const target = direction > 0
    ? stops.find(top => top > anchor + 8)
    : stops.slice().reverse().find(top => top < anchor - 8);

  if (target !== undefined) {
    window.scrollTo({
      top: Math.max(0, target - window.innerHeight * HEADING_STOP),
      behavior: 'smooth'
    });
    return;
  }

  window.scrollBy({ top: direction * window.innerHeight * SCREEN_STEP, behavior: 'smooth' });
}

const scrollDownBtn = document.createElement('button');
scrollDownBtn.className = 'scroll-down';
scrollDownBtn.innerHTML = '↓';
scrollDownBtn.setAttribute('aria-label', 'Scroll down');
document.body.appendChild(scrollDownBtn);

scrollDownBtn.addEventListener('click', () => scrollByStep(1));

const backToTopBtn = document.createElement('button');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '↑';
backToTopBtn.setAttribute('aria-label', 'Scroll up');
document.body.appendChild(backToTopBtn);

const DOUBLE_CLICK_WINDOW = 450;
let lastUpClickAt = 0;

backToTopBtn.addEventListener('click', () => {
  const now = performance.now();
  const isDoubleClick = now - lastUpClickAt < DOUBLE_CLICK_WINDOW;
  lastUpClickAt = now;

  if (isDoubleClick) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  scrollByStep(-1);
});

let lastScrollTop = 0;
let navButtonsScrollTicking = false;
window.addEventListener('scroll', () => {
  if (navButtonsScrollTicking) return;
  navButtonsScrollTicking = true;

  requestAnimationFrame(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
  
    if (scrollTop > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }

    if (scrollTop + clientHeight >= scrollHeight - 200) {
      scrollDownBtn.classList.add('hidden');
    } else {
      scrollDownBtn.classList.remove('hidden');
    }

    lastScrollTop = scrollTop;
    navButtonsScrollTicking = false;
  });
}, { passive: true });

let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

const handleSwipeGesture = () => {
  const swipeThreshold = 50;
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = touchEndY - touchStartY;
  
  if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY)) {
    if (Math.abs(swipeDistanceX) > swipeThreshold) {
      if (swipeDistanceX > 0) {
        navigateImage('prev');
      } else {
        navigateImage('next');
      }
    }
  }
};

lightboxContent.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

lightbox.addEventListener('touchmove', (e) => {
  if (!lightbox.classList.contains('active') || e.touches.length !== 1) return;

  const scroller = e.target.closest && e.target.closest('.lightbox-content');
  if (scroller && scroller.scrollHeight > scroller.clientHeight) return;

  e.preventDefault();
}, { passive: false });

lightboxContent.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });

