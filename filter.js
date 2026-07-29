// ===== MULTI-DIMENSIONAL FILTER SYSTEM WITH SEARCH =====
// ПРОВЕРЕНО И ОПТИМИЗИРОВАНО: Улучшена производительность и надежность

class GalleryFilter {
  constructor() {
    this.allArtworks = [];
    this.activeFilters = {
      category: [],  // ИСПРАВЛЕНО: используем category вместо subject/mood/themes
      year: [],
      medium: [],
      tags: []
    };
    this.searchQuery = '';
    this.currentView = 'chronological';
    
    this.init();
  }
  
  init() {
    // Собираем артворки только из активной галереи
    this.collectArtworks();
    
    this.setupSearch();
    this.setupCheckboxes();
    
    const clearButton = document.getElementById('clear-filters');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.clearAllFilters();
      });
    }
    
    this.setupCollapsibleSections();
    this.setupViewSwitcher();
    
    // Начальное обновление счетчика
    this.updateCounter();
    
    console.log(`✅ [Gallery Filter] Initialized with ${this.allArtworks.length} unique artworks`);
  }
  
  setupSearch() {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      // ОПТИМИЗАЦИЯ: Добавляем debounce для поиска
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.applyFilters();
          this.updateCounter();
        }, 300); // Задержка 300ms для оптимизации
      });
    }
  }
  
  setupViewSwitcher() {
    const chronoBtn = document.getElementById('chronological-view-btn');
    const thematicBtn = document.getElementById('thematic-view-btn');
    const chronoGallery = document.getElementById('chronological-gallery');
    const thematicGallery = document.getElementById('thematic-gallery');
    
    if (!chronoBtn || !thematicBtn) {
      console.warn('[Gallery Filter] View switcher buttons not found');
      return;
    }
    
    chronoBtn.addEventListener('click', () => {
      this.currentView = 'chronological';
      chronoBtn.classList.add('active');
      thematicBtn.classList.remove('active');
      chronoGallery.classList.add('active');
      thematicGallery.classList.remove('active');
      
      this.collectArtworks();
      this.applyFilters();
      
      // Обновляем массив изображений для lightbox
      if (typeof updateGalleryImagesArray === 'function') {
        updateGalleryImagesArray();
      }
      
      console.log('[Gallery Filter] Switched to chronological view');
    });
    
    thematicBtn.addEventListener('click', () => {
      this.currentView = 'thematic';
      thematicBtn.classList.add('active');
      chronoBtn.classList.remove('active');
      thematicGallery.classList.add('active');
      chronoGallery.classList.remove('active');
      
      this.collectArtworks();
      this.applyFilters();
      
      // Обновляем массив изображений для lightbox
      if (typeof updateGalleryImagesArray === 'function') {
        updateGalleryImagesArray();
      }
      
      console.log('[Gallery Filter] Switched to thematic view');
    });
  }
  
  collectArtworks() {
    this.allArtworks = [];
    const activeGallery = this.currentView === 'chronological' 
      ? document.getElementById('chronological-gallery')
      : document.getElementById('thematic-gallery');
    
    if (activeGallery) {
      activeGallery.querySelectorAll('.art-block').forEach(block => {
        const img = block.querySelector('img');
        if (img) {
          this.allArtworks.push({
            element: block,
            category: img.dataset.category || '',
            year: img.dataset.year || '',
            medium: img.dataset.medium || '',
            tags: img.dataset.tags || '',
            title: img.dataset.title || '',
            description: img.dataset.description || ''
          });
        }
      });
      console.log(`[Gallery Filter] Collected ${this.allArtworks.length} artworks from ${this.currentView} view`);
    } else {
      console.error(`[Gallery Filter] Active gallery not found: ${this.currentView}`);
    }
  }
  
  setupCheckboxes() {
    const filterGroups = ['category', 'year', 'medium', 'tags'];
    
    filterGroups.forEach(group => {
      const checkboxes = document.querySelectorAll(`input[data-filter-group="${group}"]`);
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          this.handleFilterChange(group, e.target.value, e.target.checked);
        });
      });
      console.log(`[Gallery Filter] Setup ${checkboxes.length} checkboxes for ${group}`);
    });
  }
  
  setupCollapsibleSections() {
    document.querySelectorAll('.filter-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
      });
    });
  }
  
  handleFilterChange(group, value, isChecked) {
    if (isChecked) {
      if (!this.activeFilters[group].includes(value)) {
        this.activeFilters[group].push(value);
      }
    } else {
      this.activeFilters[group] = this.activeFilters[group].filter(v => v !== value);
    }
    
    console.log(`[Gallery Filter] Filter changed: ${group}=${value} (${isChecked ? 'ON' : 'OFF'})`);
    console.log(`[Gallery Filter] Active filters:`, this.getActiveFilterSummary());
    
    this.applyFilters();
    this.updateCounter();
  }
  
  applyFilters() {
    // Артворки уже собраны через collectArtworks() при init() и при переключении
    // вида (setupViewSwitcher). Пересборка на каждый клик/символ поиска не нужна
    // (DOM статический) и раньше сводила на нет кеш _searchText ниже, так как
    // collectArtworks() создавал новые объекты артворков без него на каждый вызов.
    let visibleCount = 0;
    let hiddenCount = 0;
    
    this.allArtworks.forEach(artwork => {
      const matchesFilters = this.matchesAllFilters(artwork);
      const matchesSearch = this.matchesSearch(artwork);
      const shouldShow = matchesFilters && matchesSearch;
      
      if (shouldShow) {
        artwork.element.style.display = '';
        visibleCount++;
      } else {
        artwork.element.style.display = 'none';
        hiddenCount++;
      }
    });
    
    console.log(`[Gallery Filter] Applied filters: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    // Обновляем массив изображений для lightbox навигации
    if (typeof updateGalleryImagesArray === 'function') {
      updateGalleryImagesArray();
    } else {
      // Fallback если функция недоступна
      const activeGallery = this.currentView === 'chronological' 
        ? document.getElementById('chronological-gallery')
        : document.getElementById('thematic-gallery');
      
      if (activeGallery && window) {
        window.allGalleryImages = Array.from(activeGallery.querySelectorAll('.gallery img'))
          .filter(img => {
            const block = img.closest('.art-block');
            return block && block.style.display !== 'none';
          });
      }
    }
    
    // Обновляем видимость секций тем в тематическом виде
    if (this.currentView === 'thematic') {
      this.updateThemeSectionsVisibility();
    }
    
    // Показываем сообщение если нет результатов
    this.updateNoResultsMessage(visibleCount);
    
    return visibleCount;
  }
  
  matchesSearch(artwork) {
    if (!this.searchQuery) return true;
    
    // ОПТИМИЗАЦИЯ: Кешируем строку поиска
    if (!artwork._searchText) {
      artwork._searchText = [
        artwork.title,
        artwork.description,
        artwork.category,
        artwork.tags
      ].join(' ').toLowerCase();
    }
    
    return artwork._searchText.includes(this.searchQuery);
  }
  
  matchesAllFilters(artwork) {
    // Если нет активных фильтров, показываем всё
    const hasActiveFilters = Object.values(this.activeFilters).some(arr => arr.length > 0);
    if (!hasActiveFilters) {
      return true;
    }
    
    // Проверяем каждую группу фильтров (OR внутри группы, AND между группами)
    for (const [group, values] of Object.entries(this.activeFilters)) {
      if (values.length === 0) continue; // Пропускаем пустые группы
      
      const artworkValue = artwork[group];
      
      // ИСПРАВЛЕНИЕ: Если у артворка нет значения для активного фильтра, скрываем его
      if (!artworkValue) {
        return false;
      }
      
      // Проверяем соответствие хотя бы одному значению в группе
      const matches = values.some(filterValue => {
        if (group === 'tags') {
          // Для тегов проверяем каждый тег отдельно
          const artworkTags = artworkValue.split(',').map(t => t.trim());
          return artworkTags.includes(filterValue);
        }
        // Для остальных - точное совпадение
        return artworkValue === filterValue;
      });
      
      // Если не совпадает ни одно значение в группе, артворк не проходит
      if (!matches) {
        return false;
      }
    }
    
    return true;
  }
  
  updateCounter() {
    const visibleCount = this.allArtworks.filter(artwork =>
      artwork.element.style.display !== 'none'
    ).length;

    const counterElement = document.getElementById('artwork-counter');
    if (counterElement) {
      counterElement.textContent = `${visibleCount} work${visibleCount !== 1 ? 's' : ''}`;
    }

    // Update filter badge on nav row button
    const totalActive = Object.values(this.activeFilters).reduce((sum, arr) => sum + arr.length, 0)
      + (this.searchQuery ? 1 : 0);

    const navFilterBtn = document.querySelector('.nav-filter-btn');
    if (navFilterBtn) {
      if (totalActive > 0) {
        navFilterBtn.innerHTML = `Filters <span class="nav-filter-badge">${totalActive}</span>`;
        navFilterBtn.classList.add('has-filters');
      } else {
        navFilterBtn.innerHTML = 'Filters';
        navFilterBtn.classList.remove('has-filters');
      }
    }
  }
  
  updateNoResultsMessage(visibleCount) {
    const activeGallery = this.currentView === 'chronological' 
      ? document.getElementById('chronological-gallery')
      : document.getElementById('thematic-gallery');
    
    if (!activeGallery) return;
    
    let noResultsDiv = activeGallery.querySelector('.no-results');
    
    if (visibleCount === 0) {
      if (!noResultsDiv) {
        noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.innerHTML = `
          <div class="no-results-icon">🔍</div>
          <p>No artworks found matching your filters or search</p>
          <button onclick="galleryFilter.clearAllFilters()" style="margin-top: 16px; padding: 10px 20px; background: #3366cc; color: white; border: none; border-radius: 6px; cursor: pointer;">Clear All Filters</button>
        `;
        activeGallery.insertBefore(noResultsDiv, activeGallery.firstChild);
      }
    } else if (noResultsDiv) {
      noResultsDiv.remove();
    }
  }
  
  updateThemeSectionsVisibility() {
    const thematicGallery = document.getElementById('thematic-gallery');
    if (!thematicGallery) return;
    
    let visibleSections = 0;
    let hiddenSections = 0;
    
    thematicGallery.querySelectorAll('.theme-section').forEach(section => {
      const gallery = section.querySelector('.gallery');
      const visibleWorks = Array.from(gallery.querySelectorAll('.art-block'))
        .filter(block => block.style.display !== 'none');
      
      if (visibleWorks.length === 0) {
        section.style.display = 'none';
        hiddenSections++;
      } else {
        section.style.display = '';
        visibleSections++;
      }
    });
    
    console.log(`[Gallery Filter] Theme sections: ${visibleSections} visible, ${hiddenSections} hidden`);
  }
  
  clearAllFilters() {
    console.log('[Gallery Filter] Clearing all filters');
    
    // Очищаем поисковой запрос
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = '';
      this.searchQuery = '';
    }
    
    // Снимаем все чекбоксы
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Очищаем активные фильтры
    this.activeFilters = {
      category: [],
      year: [],
      medium: [],
      tags: []
    };
    
    // Применяем (показываем всё)
    this.applyFilters();
    this.updateCounter();
    
    console.log('[Gallery Filter] All filters cleared');
  }
  
  getActiveFilterSummary() {
    const summary = [];
    for (const [group, values] of Object.entries(this.activeFilters)) {
      if (values.length > 0) {
        summary.push(`${group}: ${values.join(', ')}`);
      }
    }
    if (this.searchQuery) {
      summary.push(`search: "${this.searchQuery}"`);
    }
    return summary.length > 0 ? summary.join(' | ') : 'No filters active';
  }
}

// Инициализация системы фильтров при готовности DOM
let galleryFilter;
document.addEventListener('DOMContentLoaded', () => {
  galleryFilter = new GalleryFilter();
  console.log('[Gallery Filter] System initialized');
});

// ===== FILTER SIDEBAR TOGGLE FOR MOBILE =====
function toggleFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  const isOpen = sidebar.classList.toggle('mobile-open');
  document.body.classList.toggle('filter-open', isOpen);
}

function closeFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  sidebar.classList.remove('mobile-open');
  document.body.classList.remove('filter-open');
}

// Close sidebar when tapping outside it on mobile
document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.filter-sidebar');
  const navFilterBtn = document.querySelector('.nav-filter-btn');

  if (window.innerWidth <= 1024 &&
      sidebar.classList.contains('mobile-open') &&
      !sidebar.contains(e.target) &&
      !(navFilterBtn && navFilterBtn.contains(e.target))) {
    closeFilterSidebar();
  }
});

// ===== GLOBAL VIEW SWITCHING FUNCTIONS =====
function switchToChronological() {
  if (galleryFilter) {
    const chronoBtn = document.getElementById('chronological-view-btn');
    if (chronoBtn) chronoBtn.click();
  }
  const gallery = document.getElementById('gallery');
  if (gallery) {
    setTimeout(() => gallery.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

function switchToThematic(targetId) {
  if (galleryFilter) {
    const thematicBtn = document.getElementById('thematic-view-btn');
    if (thematicBtn) thematicBtn.click();
  }
  // Category-specific nav links pass their own section id so we scroll straight
  // there; the plain "Thematic View" link passes nothing and lands on #gallery.
  // Without this, every category link's native #anchor jump used to get
  // overridden 100ms later by a hardcoded scroll back to the top of the gallery.
  const target = targetId ? document.getElementById(targetId) : document.getElementById('gallery');
  if (target) {
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}
