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
const lightboxDownload = lightbox.querySelector(".lightbox-download");
const lightboxToast = lightbox.querySelector(".lightbox-toast");

let currentImageSrc = "";
let currentImageTitle = "";
let currentImageId = "";
let allGalleryImages = [];
let currentImageIndex = -1;

// ===== ЛАЙТБОКС И ИСТОРИЯ БРАУЗЕРА =====
// Открытие работы добавляет запись в историю (#id работы), поэтому "назад"
// закрывает лайтбокс и возвращает к той же подборке, а не уводит со страницы.
// Флаг говорит, что запись создали мы: если лайтбокс открылся по внешней
// ссылке с hash, отдельной записи нет и history.back() увёл бы с сайта.
let lightboxOwnsHistoryEntry = false;

// Фильтры и поиск живут в query-строке (см. filter.js) - при работе с hash её
// нужно сохранять, иначе открытие/закрытие работы сбрасывало бы подборку
function urlWithHash(id) {
  const base = `${window.location.pathname}${window.location.search}`;
  return id ? `${base}#${id}` : base;
}

// Ищет изображение работы в активной галерее.
// id проставлен только на хронологической копии блока (в тематическом виде
// каждая работа рендерится второй раз без id - см. generate_index.py), поэтому
// сначала ищем по data-id внутри активного контейнера и лишь потом по id.
function findImageById(id) {
  if (!id) return null;

  const activeGallery = document.querySelector('.gallery-container.active');
  if (activeGallery) {
    // Перебором, а не селектором [data-id="..."]: id собирается из названия
    // работы и в селекторе пришлось бы экранировать спецсимволы
    const img = Array.from(activeGallery.querySelectorAll('.art-block img'))
      .find(candidate => candidate.dataset.id === id);
    if (img) return img;
  }

  const artBlock = document.getElementById(id);
  return artBlock ? artBlock.querySelector('img') : null;
}

// ===== БЛОКИРОВКА ПРОКРУТКИ ФОНА (iOS-safe) =====
// document.body.style.overflow = 'hidden' на iOS Safari не работает: страница
// продолжает прокручиваться под оверлеем, и это видно сквозь полупрозрачный фон.
// Единственный надёжный способ - "заморозить" body через position:fixed
// (класс .scroll-locked в style.css) со смещением на текущую прокрутку,
// а при закрытии вернуть страницу на то же место.
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
  // Возвращаем страницу на прежнее место мгновенно: с html { scroll-behavior:
  // smooth } (style.css) она бы "доезжала" анимацией уже после закрытия
  const root = document.documentElement;
  const prevScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, lockedScrollY);
  root.style.scrollBehavior = prevScrollBehavior;
}

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
        // Два независимых способа спрятать работу: инлайновый display от
        // фильтров и класс от свёрнутой категории (см. refreshCategoryPreviews
        // в filter.js). Учитывать надо оба, иначе стрелки перелистывают на
        // работы, которых на экране нет.
        return artBlock && artBlock.style.display !== 'none'
          && !artBlock.classList.contains('is-preview-hidden');
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
  // пока грузится полноразмерная версия.
  // currentSrc, а не src: у миниатюр в сетке есть srcset (300/600px, webp/jpg),
  // и браузер уже скачал ровно один из вариантов - src вернул бы 600px .jpg,
  // то есть ещё один запрос вместо кадра, который уже лежит в кэше.
  lightboxImg.src = imgElement.currentSrc || imgElement.src;

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

    // Пропорции новой работы другие - пересчитываем низ картинки для тап-зон
    positionTouchNav();

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

// Тап-зоны листания на мобильных прижаты к низу самой картинки, а не всего
// окна: высота подписи меняется от работы к работе, поэтому расстояние от низа
// окна до низа изображения замеряем и отдаём в CSS (см. --lb-img-bottom).
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

// Функция для обновления метаданных
function updateLightboxMetadata(img) {
  // Устанавливаем метаданные из data-атрибутов
  const title = img.dataset.title || "Untitled";
  currentImageTitle = title;
  currentImageId = img.dataset.id || "";

  lightboxTitle.textContent = title;
  // Точная дата (data-date-exact, "May 28, 2026") показывается вместо
  // месяца-года там, где она есть в CSV; для остальных работ остаётся
  // прежний data-date ("May 2026"), так что строка выглядит одинаково.
  lightboxDate.textContent = img.dataset.dateExact || img.dataset.date || "";
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

  // Ссылка на скачивание: отдаём jpg из large/, а не webp - его без вопросов
  // откроет любая программа. Имя файла берём от названия работы, иначе
  // сохранится что-нибудь вроде "05-14-2026_gua1_cutted.jpg".
  if (lightboxDownload) {
    const source = img.dataset.fullSrc || img.currentSrc || img.src;
    const extension = (source.split('.').pop() || 'jpg').split(/[?#]/)[0];
    const safeTitle = title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'artwork';
    lightboxDownload.href = source;
    lightboxDownload.setAttribute('download', `${safeTitle}.${extension}`);
    lightboxDownload.setAttribute('aria-label', `Download “${title}”`);
    lightboxDownload.setAttribute('title', `Download “${title}”`);
  }

  // Показываем или скрываем секцию метаданных
  if (metadataText) {
    lightboxMetadata.textContent = metadataText;
    lightboxMetadata.style.display = "block";
  } else {
    lightboxMetadata.style.display = "none";
  }

  // ИСПРАВЛЕНИЕ: Обновляем URL hash без прокрутки.
  // Именно replaceState: запись в истории создаётся один раз при открытии
  // (openLightbox), а перелистывание стрелками/свайпом лишь обновляет её -
  // иначе после десятка работ пришлось бы столько же раз жать "назад".
  if (currentImageId) {
    history.replaceState({ artwork: currentImageId }, '', urlWithHash(currentImageId));
  }
}

// ИСПРАВЛЕНИЕ: Улучшенная функция открытия lightbox
function openLightbox(img, { fromHistory = false } = {}) {
  // Обновляем массив изображений перед открытием (на случай если фильтры изменились)
  updateGalleryImagesArray();

  // Находим индекс текущего изображения
  currentImageIndex = allGalleryImages.indexOf(img);

  if (currentImageIndex === -1) {
    // Работа скрыта текущими фильтрами (например, ссылка вида ?year=2026#work
    // ведёт на работу другого года). Показываем её, добавив в начало списка,
    // чтобы счётчик и навигация остались согласованными.
    console.warn('[Lightbox] Image not in the filtered set - showing it anyway');
    allGalleryImages = [img, ...allGalleryImages];
    currentImageIndex = 0;
  }

  // Открытие по клику добавляет запись в историю: "назад" тогда закрывает
  // лайтбокс и возвращает подборку. При открытии из истории (popstate или
  // hash в адресе при загрузке) запись уже существует.
  if (!fromHistory) {
    const id = img.dataset.id || '';
    if (id) {
      history.pushState({ artwork: id }, '', urlWithHash(id));
      lightboxOwnsHistoryEntry = true;
    }
  }

  // Обновляем счетчик
  updateCounter();

  // Показываем lightbox с анимацией
  lightbox.classList.add("active");
  lockPageScroll();

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
    setZoomed(false);
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

// ===== SHARE =====
// "Поделиться" здесь означает "скопировать ссылку", поэтому подтверждение
// говорит об этом прямо - иначе кнопка выглядит так, будто ничего не сделала.
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

// Запасной путь для контекстов без Clipboard API (не-https, file://)
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

  // navigator.clipboard отсутствует вне защищённого контекста - без проверки
  // здесь был бы TypeError
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
    // currentImageSrc уже абсолютный (его ставит preloadImg.src), поэтому
    // origin к нему приклеивать не надо - на этом раньше ломалась ссылка
    openShareWindow('https://pinterest.com/pin/create/button/'
      + `?url=${encodeURIComponent(artworkShareURL())}`
      + `&media=${encodeURIComponent(currentImageSrc)}`
      + `&description=${encodeURIComponent(currentImageTitle)}`);
  }
};

// ===== МЕНЮ "ПОДЕЛИТЬСЯ" =====
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

  // Клик мимо и Esc закрывают меню; Esc при этом не должен закрыть заодно и
  // сам лайтбокс, поэтому событие останавливаем
  lightbox.addEventListener('click', () => closeShareMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || shareMenu.hidden) return;
    e.stopPropagation();
    closeShareMenu();
    shareButton.focus();
  }, true);
}

// На мобильных стрелки не показываются постоянно - это просто невидимые зоны
// в нижней части картинки (см. медиазапрос в style.css). Тап и листает, и на
// секунду проявляет саму стрелку, чтобы было видно, что именно сработало,
// после чего она снова гаснет.
let navPeekTimer;
function peekTouchNav() {
  lightbox.classList.add('nav-peek');
  clearTimeout(navPeekTimer);
  navPeekTimer = setTimeout(() => lightbox.classList.remove('nav-peek'), 1300);
}

lightbox.querySelectorAll('.lightbox-nav').forEach(btn => {
  btn.addEventListener('click', peekTouchNav);
});

// ===== УВЕЛИЧЕНИЕ ПО КЛИКУ =====
// Клик по картине разворачивает её на весь экран (и обратно). Сбрасывается при
// закрытии и при переходе к другой работе - иначе следующая открывалась бы уже
// увеличенной, без подписи.
function setZoomed(on) {
  lightbox.classList.toggle('is-zoomed', on);
  lightboxImg.style.cursor = on ? 'zoom-out' : 'zoom-in';
}

lightboxImg.addEventListener('click', (e) => {
  e.stopPropagation();
  setZoomed(!lightbox.classList.contains('is-zoomed'));
});

// Закрытие lightbox при клике вне изображения
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

// Функция закрытия lightbox
function closeLightbox(fromHistory = false) {
  lightbox.classList.remove("active");
  lightbox.classList.remove("nav-peek");
  clearTimeout(navPeekTimer);
  setZoomed(false);
  if (lightboxToast) lightboxToast.classList.remove('is-visible');
  clearTimeout(lightboxToastTimer);
  closeShareMenu();
  unlockPageScroll();
  // Скрываем loader если он был виден
  lightboxLoader.style.display = "none";
  lightboxImg.classList.remove("is-loading");

  if (fromHistory) {
    // Закрытие пришло от кнопки "назад" - адрес уже обновил браузер
    lightboxOwnsHistoryEntry = false;
  } else if (lightboxOwnsHistoryEntry) {
    // Снимаем нашу запись из истории: адрес вернётся к состоянию фильтров,
    // и "вперёд" снова откроет ту же работу
    lightboxOwnsHistoryEntry = false;
    history.back();
  } else {
    // Лайтбокс открылся по внешней ссылке с hash - своей записи нет,
    // просто убираем hash, сохраняя фильтры в query-строке
    history.replaceState(history.state, '', urlWithHash(''));
  }

  console.log('[Lightbox] Closed');
}

// "Назад"/"вперёд" открывают и закрывают лайтбокс вслед за адресом.
// Фильтры на popstate восстанавливает filter.js; его обработчик должен
// отработать раньше, чтобы мы искали работу уже в нужном (и отфильтрованном)
// виде - поэтому подписка живёт в DOMContentLoaded ниже, а не здесь: filter.js
// подписывается на popstate внутри своего DOMContentLoaded, а он идёт первым
// (скрипт подключён выше в index.html).
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

  window.addEventListener('popstate', handleLightboxPopState);

  // Проверяем есть ли hash в URL
  const hash = window.location.hash.substring(1); // Убираем #
  if (hash) {
    console.log(`[Lightbox] Found hash in URL: ${hash}`);
    // Находим artwork с этим ID (в активном виде, каким бы он ни был - вид
    // тоже приходит из адреса, см. filter.js)
    const img = findImageById(hash);
    if (img) {
      // Небольшая задержка чтобы страница полностью загрузилась.
      // fromHistory: запись в истории для этого адреса уже есть - своей
      // не добавляем, иначе "назад" открывал бы ту же работу повторно.
      setTimeout(() => {
        openLightbox(img, { fromHistory: true });
      }, 300);
    } else {
      console.warn(`[Lightbox] Artwork not found: ${hash}`);
    }
  }
});


// ===== ШАГ ПРОКРУТКИ КНОПКАМИ ↑ / ↓ =====
// В тематическом виде шаг - это категория: кнопка перескакивает на следующий
// (предыдущий) заголовок и ставит его чуть выше середины экрана, чтобы под
// названием сразу было видно превью, а не только само название по центру.
// Там, где заголовков нет (хронологический вид), шаг - экран.
// Обе кнопки ходят одинаково: "вверх" раньше прыгала сразу в самое начало.
const HEADING_STOP = 0.32;   // доля экрана сверху до заголовка
const SCREEN_STEP = 0.8;

function activeSectionOffsets() {
  const container = document.querySelector('.gallery-container.active');
  if (!container) return [];
  // Только заголовки категорий: в хронологическом виде их внутри контейнера
  // нет, поэтому список пустой и шаг остаётся экранным
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

// ===== SCROLL DOWN BUTTON =====
const scrollDownBtn = document.createElement('button');
scrollDownBtn.className = 'scroll-down';
scrollDownBtn.innerHTML = '↓';
scrollDownBtn.setAttribute('aria-label', 'Scroll down');
document.body.appendChild(scrollDownBtn);

scrollDownBtn.addEventListener('click', () => scrollByStep(1));

// ===== SCROLL UP BUTTON =====
const backToTopBtn = document.createElement('button');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '↑';
backToTopBtn.setAttribute('aria-label', 'Scroll up');
document.body.appendChild(backToTopBtn);

// Один клик - шаг назад (как у стрелки вниз), два подряд - сразу в самое
// начало страницы: длинный список категорий иначе пришлось бы отщёлкивать
// по одной.
const DOUBLE_CLICK_WINDOW = 450;
let lastUpClickAt = 0;

backToTopBtn.addEventListener('click', () => {
  const now = performance.now();
  const isDoubleClick = now - lastUpClickAt < DOUBLE_CLICK_WINDOW;
  lastUpClickAt = now;

  if (isDoubleClick) {
    // Второй клик перебивает прокрутку, начатую первым
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  scrollByStep(-1);
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

// Даже при замороженном body iOS "резиново" тянет страницу за оверлеем, если
// жест начался на нём. touch-action в CSS Safari учитывает не везде, поэтому
// глушим одиночный touchmove явно (свайпы навигации живут на touchstart/touchend,
// им preventDefault не мешает; жесты двумя пальцами не трогаем - это pinch-zoom).
lightbox.addEventListener('touchmove', (e) => {
  if (!lightbox.classList.contains('active') || e.touches.length !== 1) return;

  // Если рамка не поместилась и её можно прокрутить - не мешаем: иначе до
  // подписи и кнопок под высокой картиной было бы не добраться. Гасим только
  // жест по самому оверлею, из-за которого iOS "резиново" тянет страницу
  // позади.
  const scroller = e.target.closest && e.target.closest('.lightbox-content');
  if (scroller && scroller.scrollHeight > scroller.clientHeight) return;

  e.preventDefault();
}, { passive: false });

lightboxContent.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });


// Native lazy loading is used via loading="lazy" attribute in HTML
// No JavaScript lazy loading needed - browser handles it natively
