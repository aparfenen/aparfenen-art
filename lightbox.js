// ===== LIGHTBOX WITH METADATA AND SHARE BUTTONS =====
// ИСПРАВЛЕНО: Улучшена навигация, счетчик и обработка изображений

const lightbox = document.getElementById("lightbox");
const lightboxContent = lightbox.querySelector(".lightbox-content");
const lightboxImg = lightbox.querySelector("img");
const lightboxTitle = lightbox.querySelector(".lightbox-title");
const lightboxDate = lightbox.querySelector(".lightbox-date");
const lightboxDescription = lightbox.querySelector(".lightbox-description");
const lightboxMetadata = lightbox.querySelector(".lightbox-metadata");
const lightboxLoader = lightbox.querySelector(".lightbox-loader");
const swipeHint = lightbox.querySelector(".swipe-hint");

let currentImageSrc = "";
let currentImageTitle = "";
let currentImageId = "";
let allGalleryImages = [];
let currentImageIndex = -1;
let hasSeenSwipeHint = false; // session-only: show once per page load

// ИСПРАВЛЕНИЕ: Улучшенная функция обновления массива изображений
function updateGalleryImagesArray() {
  // Определяем активную галерею
  // ВАЖНО: контейнер (.gallery-container) может содержать НЕСКОЛЬКО .gallery
  // блоков - в тематическом виде каждая категория рендерится в своём
  // собственном .gallery внутри .theme-section (см. generate_index.py).
  // Раньше здесь стоял querySelector('.gallery-container.active .gallery')
  // (в единственном числе), который находил только .gallery ПЕРВОЙ секции -
  // из-за этого при просмотре любой категории кроме первой стрелки prev/next
  // молча уводили в начало первой категории. Ищем по всему контейнеру, как
  // и filter.js делает в collectArtworks().
  const activeGallery = document.querySelector('.gallery-container.active');

  if (activeGallery) {
    // ИСПРАВЛЕНИЕ: Фильтруем только видимые изображения (не скрытые фильтрами)
    // Видимость артворков управляется исключительно инлайновым style.display
    // (см. filter.js), поэтому getComputedStyle() здесь не нужен - он лишь
    // форсирует пересчёт стилей для каждого блока на каждый вызов этой функции.
    allGalleryImages = Array.from(activeGallery.querySelectorAll('.art-block img'))
      .filter(img => {
        const artBlock = img.closest('.art-block');
        // Проверяем что блок существует и не скрыт
        return artBlock && artBlock.style.display !== 'none';
      });
    console.log(`[Lightbox] Updated gallery images: ${allGalleryImages.length} visible images in active gallery`);
  } else {
    // Fallback: используем хронологическую галерею если нет активной
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

// Возвращает предпочтительный (webp) и запасной (jpg) путь к полноразмерному изображению
function getFullImageSources(imgElement) {
  const jpgSrc = imgElement.dataset.fullSrc || imgElement.src;
  const webpSrc = imgElement.dataset.fullSrcWebp || "";
  return { jpgSrc, webpSrc };
}

// Тихая предзагрузка соседних (next/prev) изображений в кэш браузера,
// чтобы навигация в lightbox ощущалась мгновенной
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

// Функция для предзагрузки изображения с loader
function loadImageWithLoader(imgElement, onLoadComplete) {
  // Показываем loader
  lightboxLoader.style.display = "block";
  lightboxImg.classList.add("is-loading");

  // Blur-up: сразу показываем уже загруженный thumbnail как placeholder,
  // пока грузится полноразмерная версия
  lightboxImg.src = imgElement.src;

  const { jpgSrc, webpSrc } = getFullImageSources(imgElement);
  let triedFallback = false;

  // Создаем новый объект Image для предзагрузки
  const preloadImg = new Image();

  preloadImg.onload = function() {
    // Изображение загружено - обновляем lightbox
    lightboxImg.src = preloadImg.src;
    currentImageSrc = preloadImg.src;

    // Скрываем loader
    lightboxLoader.style.display = "none";
    lightboxImg.classList.remove("is-loading");

    // Вызываем callback для обновления метаданных
    if (onLoadComplete) {
      onLoadComplete(imgElement);
    }

    console.log(`[Lightbox] Image loaded: ${preloadImg.src}`);

    // Подгружаем соседние изображения в фоне для мгновенной навигации
    prefetchNeighborImages();
  };

  preloadImg.onerror = function() {
    // Если webp не удалось загрузить (старый браузер, отсутствующий файл) - пробуем jpg
    if (!triedFallback && preloadImg.src !== jpgSrc) {
      triedFallback = true;
      preloadImg.src = jpgSrc;
      return;
    }

    console.error(`[Lightbox] Failed to load image: ${preloadImg.src}`);
    // Скрываем loader даже при ошибке
    lightboxLoader.style.display = "none";
    lightboxImg.classList.remove("is-loading");
  };

  // Начинаем загрузку (webp приоритетнее, если доступен)
  preloadImg.src = webpSrc || jpgSrc;
}

// Функция для обновления метаданных
function updateLightboxMetadata(img) {
  // Устанавливаем метаданные из data-атрибутов
  const title = img.dataset.title || "Untitled";
  currentImageTitle = title;
  currentImageId = img.dataset.id || "";

  lightboxTitle.textContent = title;
  lightboxDate.textContent = img.dataset.date || "";
  lightboxDescription.textContent = img.dataset.description || "";

  // Строим строку метаданных (размеры и материал)
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

  // Показываем или скрываем секцию метаданных
  if (metadataText) {
    lightboxMetadata.textContent = metadataText;
    lightboxMetadata.style.display = "block";
  } else {
    lightboxMetadata.style.display = "none";
  }

  // ИСПРАВЛЕНИЕ: Обновляем URL hash без прокрутки
  if (currentImageId) {
    history.replaceState(null, null, `#${currentImageId}`);
  }
}

// ИСПРАВЛЕНИЕ: Улучшенная функция открытия lightbox
function openLightbox(img) {
  // Обновляем массив изображений перед открытием (на случай если фильтры изменились)
  updateGalleryImagesArray();

  // Находим индекс текущего изображения
  currentImageIndex = allGalleryImages.indexOf(img);

  if (currentImageIndex === -1) {
    console.error('[Lightbox] Image not found in gallery array!');
    // Пытаемся обновить массив и найти снова
    updateGalleryImagesArray();
    currentImageIndex = allGalleryImages.indexOf(img);
  }

  // Обновляем счетчик
  updateCounter();

  // Показываем lightbox с анимацией
  lightbox.classList.add("active");
  document.body.style.overflow = 'hidden';

  // Показываем подсказку свайпа на мобильных при первом открытии
  showSwipeHintIfNeeded();

  // Загружаем изображение с loader и обновляем метаданные после загрузки
  loadImageWithLoader(img, updateLightboxMetadata);

  const title = img.dataset.title || "Untitled";
  console.log(`[Lightbox] Opening image ${currentImageIndex + 1}/${allGalleryImages.length}: "${title}"`);
}

// ИСПРАВЛЕНИЕ: Улучшенная навигация с проверками
function navigateImage(direction) {
  if (allGalleryImages.length === 0) {
    console.warn('[Lightbox] No images available for navigation');
    return;
  }

  // Вычисляем новый индекс с циклическим переходом
  if (direction === 'next') {
    currentImageIndex = (currentImageIndex + 1) % allGalleryImages.length;
  } else if (direction === 'prev') {
    currentImageIndex = (currentImageIndex - 1 + allGalleryImages.length) % allGalleryImages.length;
  }

  // Проверяем что новый индекс валиден
  if (currentImageIndex < 0 || currentImageIndex >= allGalleryImages.length) {
    console.error(`[Lightbox] Invalid image index: ${currentImageIndex}`);
    currentImageIndex = Math.max(0, Math.min(currentImageIndex, allGalleryImages.length - 1));
  }

  // Загружаем новое изображение
  const newImg = allGalleryImages[currentImageIndex];
  if (newImg) {
    // Обновляем счетчик
    updateCounter();

    // Загружаем изображение с loader и обновляем метаданные после загрузки
    loadImageWithLoader(newImg, updateLightboxMetadata);

    const title = newImg.dataset.title || "Untitled";
    console.log(`[Lightbox] Navigating to image ${currentImageIndex + 1}/${allGalleryImages.length}: "${title}"`);
  } else {
    console.error(`[Lightbox] Image not found at index ${currentImageIndex}`);
  }
}

// ИСПРАВЛЕНИЕ: Более информативный счетчик
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

// Добавляем обработчики кликов на все изображения в галерее
document.querySelectorAll(".gallery img").forEach(img => {
  img.addEventListener("click", () => {
    openLightbox(img);
  });
});

// Закрытие lightbox при клике вне изображения
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// Функция закрытия lightbox
function closeLightbox() {
  lightbox.classList.remove("active");
  document.body.style.overflow = '';
  // Скрываем loader если он был виден
  lightboxLoader.style.display = "none";
  lightboxImg.classList.remove("is-loading");
  // Удаляем hash из URL при закрытии
  history.replaceState(null, null, window.location.pathname);
  console.log('[Lightbox] Closed');
}

// Показываем подсказку свайпа на мобильных при первом открытии
function showSwipeHintIfNeeded() {
  // Проверяем: мобильное устройство, есть несколько изображений, подсказка еще не показывалась
  const isMobile = window.innerWidth <= 768 && matchMedia('(hover: none)').matches;

  if (isMobile && !hasSeenSwipeHint && allGalleryImages.length > 1 && swipeHint) {
    hasSeenSwipeHint = true;
    setTimeout(() => {
      if (swipeHint) {
        swipeHint.style.display = 'flex';
        // Force animation restart
        swipeHint.style.animation = 'none';
        void swipeHint.offsetHeight;
        swipeHint.style.animation = 'swipeHintFade 3s ease-in-out forwards';

        setTimeout(() => {
          if (swipeHint) swipeHint.style.display = 'none';
        }, 3000);
      }
    }, 600);
  }
}

// ИСПРАВЛЕНИЕ: Улучшенная обработка клавиатуры
document.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("active")) {
    switch(e.key) {
      case "Escape":
        closeLightbox();
        break;
      case "ArrowRight":
        e.preventDefault(); // Предотвращаем прокрутку страницы
        navigateImage('next');
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateImage('prev');
        break;
    }
  }
});

// ИСПРАВЛЕНИЕ: Проверка hash при загрузке страницы
window.addEventListener("DOMContentLoaded", () => {
  // Инициализируем массив изображений
  const imageCount = updateGalleryImagesArray();
  console.log(`[Lightbox] Page loaded with ${imageCount} images`);
  
  // Проверяем есть ли hash в URL
  const hash = window.location.hash.substring(1); // Убираем #
  if (hash) {
    console.log(`[Lightbox] Found hash in URL: ${hash}`);
    // Находим artwork с этим ID
    const artBlock = document.getElementById(hash);
    if (artBlock) {
      const img = artBlock.querySelector("img");
      if (img) {
        // Небольшая задержка чтобы страница полностью загрузилась
        setTimeout(() => {
          openLightbox(img);
        }, 300);
      } else {
        console.warn(`[Lightbox] No image found in artblock ${hash}`);
      }
    } else {
      console.warn(`[Lightbox] Artblock not found: ${hash}`);
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
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400,noopener,noreferrer');
}

function shareOnTwitter() {
  const url = encodeURIComponent(getArtworkURL());
  const text = encodeURIComponent(`Check out "${currentImageTitle}" by aparfenen`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400,noopener,noreferrer');
}

function shareOnPinterest() {
  const url = encodeURIComponent(getArtworkURL());
  // currentImageSrc is set from preloadImg.src (see loadImageWithLoader), which the
  // browser already resolves to an absolute URL - prefixing origin+pathname again
  // used to glue two absolute URLs together into one broken address.
  const imageUrl = encodeURIComponent(currentImageSrc);
  const description = encodeURIComponent(currentImageTitle);
  window.open(`https://pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${description}`, '_blank', 'width=600,height=400,noopener,noreferrer');
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

function emailAboutArtwork() {
  const artworkURL = getArtworkURL();
  const artworkTitle = currentImageTitle || "this artwork";

  // Get artwork metadata from the lightbox
  const date = lightboxDate.textContent || "";
  const description = lightboxDescription.textContent || "";
  const metadata = lightboxMetadata.textContent || "";

  // Build email subject
  const subject = encodeURIComponent(`Inquiry about "${artworkTitle}"`);

  // Build email body with artwork details and questions
  let body = `Hi,\n\nI'm interested in your artwork "${artworkTitle}"`;

  if (date) {
    body += ` (${date})`;
  }
  body += `.\n\n`;

  if (metadata) {
    body += `Details: ${metadata}\n\n`;
  }

  body += `I would like to know:\n`;
  body += `- Is this piece available for purchase?\n`;
  body += `- What is the price?\n`;
  body += `- Are prints or reproductions available?\n\n`;

  body += `Link to artwork: ${artworkURL}\n\n`;
  body += `Thank you!\n`;

  const encodedBody = encodeURIComponent(body);

  // Open mailto link
  window.location.href = `mailto:ann.parfenen2018@gmail.com?subject=${subject}&body=${encodedBody}`;
}


// ===== SCROLL DOWN BUTTON (TOP - fixed position) =====
const scrollDownBtn = document.createElement('button');
scrollDownBtn.className = 'scroll-down';
scrollDownBtn.innerHTML = '↓';
scrollDownBtn.setAttribute('aria-label', 'Scroll down');
document.body.appendChild(scrollDownBtn);

scrollDownBtn.addEventListener('click', () => {
  window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
});

// ===== BACK TO TOP BUTTON (BOTTOM - fixed position) =====
const backToTopBtn = document.createElement('button');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '↑';
backToTopBtn.setAttribute('aria-label', 'Back to top');
document.body.appendChild(backToTopBtn);

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Показ/скрытие кнопок навигации при прокрутке
// ОПТИМИЗАЦИЯ: батчим чтение/запись через rAF, чтобы не гонять layout на каждый
// scroll-event (их может быть десятки за кадр при инерционном скролле)
let lastScrollTop = 0;
let navButtonsScrollTicking = false;
window.addEventListener('scroll', () => {
  if (navButtonsScrollTicking) return;
  navButtonsScrollTicking = true;

  requestAnimationFrame(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Кнопка "Вверх" - показываем когда прокрутили вниз
    if (scrollTop > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }

    // Кнопка "Вниз" - скрываем когда близко к низу
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      scrollDownBtn.classList.add('hidden');
    } else {
      scrollDownBtn.classList.remove('hidden');
    }

    lastScrollTop = scrollTop;
    navButtonsScrollTicking = false;
  });
}, { passive: true });


// ===== CATEGORY INDICATOR =====
const categoryIndicator = document.createElement('div');
categoryIndicator.className = 'category-indicator';
document.body.appendChild(categoryIndicator);

// Получаем все заголовки секций
const sections = document.querySelectorAll('h3.section-title');

// Обновление индикатора категории при прокрутке
function updateCategoryIndicator() {
  const scrollPosition = window.pageYOffset + 150;
  
  let currentSection = null;
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionBottom = sectionTop + section.offsetHeight + 400; // Включаем часть галереи
    
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

// ОПТИМИЗАЦИЯ: та же rAF-батчировка, что и для кнопок навигации выше
let categoryScrollTicking = false;
window.addEventListener('scroll', () => {
  if (categoryScrollTicking) return;
  categoryScrollTicking = true;
  requestAnimationFrame(() => {
    updateCategoryIndicator();
    categoryScrollTicking = false;
  });
}, { passive: true });
updateCategoryIndicator(); // Начальная проверка


// ===== TOUCH/SWIPE SUPPORT FOR MOBILE =====
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

const handleSwipeGesture = () => {
  const swipeThreshold = 50; // Минимальное расстояние для свайпа
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = touchEndY - touchStartY;
  
  // Проверяем что горизонтальный свайп доминирует
  if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY)) {
    if (Math.abs(swipeDistanceX) > swipeThreshold) {
      if (swipeDistanceX > 0) {
        // Свайп вправо - предыдущее изображение
        navigateImage('prev');
      } else {
        // Свайп влево - следующее изображение
        navigateImage('next');
      }
    }
  }
};

// Attach swipe events to lightbox-content for better coverage
lightboxContent.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

lightboxContent.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });


// Native lazy loading is used via loading="lazy" attribute in HTML
// No JavaScript lazy loading needed - browser handles it natively
