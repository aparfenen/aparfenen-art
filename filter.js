// ===== MULTI-DIMENSIONAL FILTER SYSTEM WITH SEARCH =====
// ПРОВЕРЕНО И ОПТИМИЗИРОВАНО: Улучшена производительность и надежность

const FILTER_GROUPS = ['category', 'year', 'medium', 'tags'];
const VIEWS = ['chronological', 'thematic'];
const MAX_SEARCH_LENGTH = 100;

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

    // Заголовок страницы без фильтров - к нему возвращаемся при сбросе
    this.baseTitle = document.title;
    // Допустимые значения каждой группы (по чекбоксам в разметке), чтобы не
    // принимать из URL мусор. Заполняется в collectKnownFilterValues().
    this.knownValues = {};
    // Набор символов в поиске не должен плодить записи в истории: подряд идущие
    // правки строки поиска пишутся через replaceState (см. syncURL).
    this.lastSyncWasSearch = false;

    this.init();
  }

  init() {
    this.collectKnownFilterValues();

    this.setupSearch();
    this.setupCheckboxes();

    const clearButton = document.getElementById('clear-filters');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.clearAllFilters();
      });
    }

    this.setupShareLink();
    this.setupCollapsibleSections();
    this.setupViewSwitcher();

    // Восстанавливаем вид, фильтры и поиск из URL. applyState сам собирает
    // артворки и применяет фильтры, поэтому отдельный collectArtworks() тут
    // не нужен. 'replace' приводит адрес к каноничному виду (выбрасывает
    // неизвестные значения) не создавая лишнюю запись в истории.
    this.applyState(this.readStateFromURL(), { updateURL: 'replace' });

    // Кнопки "назад"/"вперёд" возвращают ровно то состояние фильтров,
    // которое было записано в адрес
    window.addEventListener('popstate', () => this.handlePopState());

    console.log(`✅ [Gallery Filter] Initialized with ${this.allArtworks.length} unique artworks`);
  }

  // ===== URL-СОСТОЯНИЕ =====
  // Фильтры, поиск и вид живут в query-строке:
  //   ?category=Fragile+Systems&year=2026&q=leaf&view=thematic
  // Несколько значений одной группы разделяются запятой - в самих значениях
  // запятой быть не может: теги в CSV как раз разбиваются по ней
  // (generate_index.py), а категории и годы - цельные поля.
  // Hash (#id работы) остаётся за лайтбоксом и здесь всегда сохраняется.

  collectKnownFilterValues() {
    FILTER_GROUPS.forEach(group => {
      const values = new Set();
      document.querySelectorAll(`input[data-filter-group="${group}"]`).forEach(cb => {
        values.add(cb.value);
      });
      this.knownValues[group] = values;
    });
  }

  readStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};

    FILTER_GROUPS.forEach(group => {
      const raw = params.get(group) || '';
      filters[group] = raw
        .split(',')
        .map(value => value.trim())
        .filter(value => this.knownValues[group].has(value));
    });

    const view = params.get('view');

    return {
      filters,
      q: (params.get('q') || '').toLowerCase().trim().slice(0, MAX_SEARCH_LENGTH),
      view: VIEWS.includes(view) ? view : 'chronological'
    };
  }

  currentState() {
    const filters = {};
    FILTER_GROUPS.forEach(group => { filters[group] = this.activeFilters[group]; });
    return { filters, q: this.searchQuery, view: this.currentView };
  }

  // Строка для сравнения двух состояний (порядок групп фиксирован)
  stateKey(state) {
    return JSON.stringify([
      FILTER_GROUPS.map(group => state.filters[group] || []),
      state.q,
      state.view
    ]);
  }

  buildQueryString() {
    const params = new URLSearchParams();

    FILTER_GROUPS.forEach(group => {
      if (this.activeFilters[group].length > 0) {
        params.set(group, this.activeFilters[group].join(','));
      }
    });
    if (this.searchQuery) {
      params.set('q', this.searchQuery);
    }
    // Хронологический вид - значение по умолчанию, в адрес его не пишем
    if (this.currentView !== 'chronological') {
      params.set('view', this.currentView);
    }

    // URLSearchParams кодирует запятую как %2C; в query-строке она допустима,
    // и ссылка со списком категорий читается человеком гораздо лучше
    const query = params.toString().replace(/%2C/g, ',');
    return query ? `?${query}` : '';
  }

  syncURL(mode = 'push') {
    const url = `${window.location.pathname}${this.buildQueryString()}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    // Ничего не изменилось (например, "Clear All" при пустых фильтрах) -
    // не плодим одинаковые записи в истории
    if (url === current) return;

    if (mode === 'replace') {
      history.replaceState(history.state, '', url);
    } else {
      history.pushState(null, '', url);
    }
  }

  applyState(state, { updateURL = false } = {}) {
    FILTER_GROUPS.forEach(group => {
      this.activeFilters[group] = (state.filters[group] || []).slice();
    });
    this.searchQuery = state.q;

    // Приводим контролы в соответствие состоянию.
    // Идём по самим чекбоксам, а не по селектору со значением: значения -
    // произвольный текст из CSV (кавычки, апострофы) и в селектор не годятся.
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = state.q;
    }
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      const group = checkbox.dataset.filterGroup;
      checkbox.checked = Boolean(group && this.activeFilters[group] &&
        this.activeFilters[group].includes(checkbox.value));
    });

    // setView пересобирает артворки активной галереи и применяет фильтры
    this.setView(state.view, { updateURL: false });

    this.updateDocumentTitle();
    if (updateURL) {
      this.syncURL(updateURL);
    }
  }

  handlePopState() {
    const state = this.readStateFromURL();

    // Лайтбокс меняет только hash (#id работы), фильтры при этом те же -
    // перефильтровывать всю сетку на каждый шаг навигации по картинкам не нужно
    if (this.stateKey(state) === this.stateKey(this.currentState())) return;

    this.applyState(state);
    this.lastSyncWasSearch = false;
  }

  // Заголовок вкладки отражает выбранную подборку: так её видно в истории
  // браузера, в закладках и во вкладках с несколькими открытыми подборками
  updateDocumentTitle() {
    const parts = [];
    FILTER_GROUPS.forEach(group => {
      if (this.activeFilters[group].length > 0) {
        parts.push(this.activeFilters[group].join(', '));
      }
    });
    if (this.searchQuery) {
      parts.push(`“${this.searchQuery}”`);
    }

    document.title = parts.length > 0
      ? `${parts.join(' · ')} — ${this.baseTitle}`
      : this.baseTitle;
  }

  setupSearch() {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      // ОПТИМИЗАЦИЯ: Добавляем debounce для поиска
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchQuery = e.target.value.toLowerCase().trim().slice(0, MAX_SEARCH_LENGTH);
          this.applyFilters();
          this.updateCounter();
          this.updateDocumentTitle();
          // Правка уже введённого запроса заменяет текущую запись в истории:
          // иначе "назад" пришлось бы жать по разу на каждое слово
          this.syncURL(this.lastSyncWasSearch ? 'replace' : 'push');
          this.lastSyncWasSearch = true;
        }, 300); // Задержка 300ms для оптимизации
      });
    }
  }
  
  setupViewSwitcher() {
    const chronoBtn = document.getElementById('chronological-view-btn');
    const thematicBtn = document.getElementById('thematic-view-btn');

    if (!chronoBtn || !thematicBtn) {
      console.warn('[Gallery Filter] View switcher buttons not found');
      return;
    }

    chronoBtn.addEventListener('click', () => this.setView('chronological'));
    thematicBtn.addEventListener('click', () => this.setView('thematic'));
  }

  // Единая точка переключения вида: используется и кнопками, и восстановлением
  // состояния из URL (там updateURL: false, чтобы не перезаписывать адрес,
  // который мы только что прочитали)
  setView(view, { updateURL = true } = {}) {
    this.currentView = VIEWS.includes(view) ? view : 'chronological';

    const chronoBtn = document.getElementById('chronological-view-btn');
    const thematicBtn = document.getElementById('thematic-view-btn');
    const chronoGallery = document.getElementById('chronological-gallery');
    const thematicGallery = document.getElementById('thematic-gallery');
    const isChrono = this.currentView === 'chronological';

    if (chronoBtn) chronoBtn.classList.toggle('active', isChrono);
    if (thematicBtn) thematicBtn.classList.toggle('active', !isChrono);
    if (chronoGallery) chronoGallery.classList.toggle('active', isChrono);
    if (thematicGallery) thematicGallery.classList.toggle('active', !isChrono);

    // applyFilters() сам обновляет массив изображений для lightbox
    this.collectArtworks();
    this.applyFilters();
    this.updateCounter();

    if (updateURL) {
      this.lastSyncWasSearch = false;
      this.syncURL('push');
    }

    console.log(`[Gallery Filter] Switched to ${this.currentView} view`);
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
    FILTER_GROUPS.forEach(group => {
      const checkboxes = document.querySelectorAll(`input[data-filter-group="${group}"]`);
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          this.handleFilterChange(group, e.target.value, e.target.checked);
        });
      });
      console.log(`[Gallery Filter] Setup ${checkboxes.length} checkboxes for ${group}`);
    });
  }
  
  // Кнопка "Copy link" под "Clear All": теперь, когда подборка целиком описана
  // адресом, её можно отправить как ссылку - но об этом надо сказать явно,
  // адресную строку на телефоне никто не открывает.
  // Кнопка создаётся здесь, а не в generate_index.py, чтобы разметка галереи
  // не зависела от этой части UI (так же сделаны кнопки прокрутки в lightbox.js).
  setupShareLink() {
    const clearButton = document.getElementById('clear-filters');
    if (!clearButton) return;

    const button = document.createElement('button');
    button.id = 'copy-filter-link';
    button.type = 'button';
    button.textContent = 'Copy link to this view';
    clearButton.insertAdjacentElement('afterend', button);

    button.addEventListener('click', () => {
      // Без hash: ссылка ведёт на подборку, а не на конкретную работу
      const url = `${window.location.origin}${window.location.pathname}${this.buildQueryString()}`;

      const confirmCopy = () => {
        button.textContent = '✓ Link copied';
        button.classList.add('copied');
        clearTimeout(this.copyLinkTimeout);
        this.copyLinkTimeout = setTimeout(() => {
          button.textContent = 'Copy link to this view';
          button.classList.remove('copied');
        }, 2000);
      };

      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(confirmCopy).catch(err => {
          console.error('[Gallery Filter] Failed to copy link:', err);
          window.prompt('Copy this link:', url);
        });
      } else {
        window.prompt('Copy this link:', url);
      }
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
    this.updateDocumentTitle();
    this.lastSyncWasSearch = false;
    this.syncURL('push');
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
    this.updateDocumentTitle();
    this.lastSyncWasSearch = false;
    this.syncURL('push');

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
