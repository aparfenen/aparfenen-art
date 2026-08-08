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
    this.setupCategorySections();
    this.setupViewSwitcher();

    // Число колонок сетки меняется с шириной окна, а от него зависит размер
    // превью - пересчитываем, но не чаще, чем раз в 150мс
    let previewResizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(previewResizeTimer);
      previewResizeTimer = setTimeout(() => {
        this.refreshCategoryPreviews();
        layoutMasonry();
        if (typeof updateGalleryImagesArray === 'function') updateGalleryImagesArray();
      }, 150);
    });

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

    // Порядок важен: сначала фильтры проставили style.display, теперь превью
    // решает, сколько из уцелевших работ показать, и только после этого можно
    // собирать список для лайтбокса - иначе в навигацию попадут работы,
    // спрятанные под свёрнутой категорией.
    this.refreshCategoryPreviews();

    layoutMasonry();

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
    
    // Секции есть в обоих видах: категории в тематическом, годы в хронологическом
    this.updateThemeSectionsVisibility();
    
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

    // Только бейдж, без перезаписи innerHTML: в кнопке нет текста, есть svg
    // с иконкой фильтров, которую сборка строки затирала бы на каждый клик.
    const navFilterBtn = document.querySelector('.nav-filter-btn');
    if (navFilterBtn) {
      let badge = navFilterBtn.querySelector('.nav-filter-badge');
      if (totalActive > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-filter-badge';
          navFilterBtn.appendChild(badge);
        }
        badge.textContent = totalActive;
        navFilterBtn.classList.add('has-filters');
      } else {
        if (badge) badge.remove();
        navFilterBtn.classList.remove('has-filters');
      }
      // Подписи у кнопки нет, поэтому имя для скринридера и всплывающая
      // подсказка - единственное, что объясняет иконку и счётчик на ней
      const label = totalActive > 0 ? `Filters (${totalActive} active)` : 'Filters';
      navFilterBtn.setAttribute('aria-label', label);
      navFilterBtn.setAttribute('title', label);
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
  
  // ===== СВОРАЧИВАЕМЫЕ КАТЕГОРИИ (тематический вид) =====
  // Все категории закрыты изначально; видно заголовок, число работ и первый
  // ряд миниатюр как превью. Клик по заголовку раскрывает остальное.
  // Разметку кнопки строим здесь, а не в generate_index.py, по той же причине,
  // что и "Copy link" выше: сгенерированная сетка не должна зависеть от этой
  // части UI.
  setupCategorySections() {
    // Оба вида: тематический сгруппирован по категориям, хронологический -
    // по годам, но разметка секций одна и та же, поэтому и механика общая
    document.querySelectorAll('.gallery-container .theme-section').forEach(section => {
      if (section.dataset.collapsibleReady) return;
      section.dataset.collapsibleReady = '1';

      const heading = section.querySelector('.section-title');
      const gallery = section.querySelector('.gallery');
      if (!heading || !gallery) return;

      const title = heading.textContent.trim();
      // id заголовка - это якорь категории (#boston), его трогать нельзя;
      // сетке даём свой, чтобы связать с кнопкой через aria-controls
      if (!gallery.id) gallery.id = `${heading.id || title.toLowerCase().replace(/\s+/g, '-')}-works`;

      // Заголовок - только подпись со счётчиком, не элемент управления:
      // раскрытием заведует одна кнопка "Show all / Show less" под превью.
      const headingRow = document.createElement('div');
      headingRow.className = 'category-toggle';
      headingRow.innerHTML =
        '<span class="category-toggle-main">' +
          '<span class="category-toggle-label"></span>' +
          '<span class="category-count"></span>' +
        '</span>';
      headingRow.querySelector('.category-toggle-label').textContent = title;

      heading.textContent = '';
      heading.appendChild(headingRow);

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'category-show-all';
      more.setAttribute('aria-controls', gallery.id);
      more.setAttribute('aria-expanded', 'false');
      gallery.insertAdjacentElement('afterend', more);

      section.classList.add('is-collapsible', 'is-collapsed');

      more.addEventListener('click', () => {
        const wasCollapsed = section.classList.contains('is-collapsed');
        this.setCategoryExpanded(section, wasCollapsed);
        // Сворачивая снизу, человек оказался бы посреди следующей категории -
        // возвращаем его к заголовку той, которую только что закрыл
        if (!wasCollapsed) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  setCategoryExpanded(section, expanded) {
    if (!section) return;
    section.classList.toggle('is-collapsed', !expanded);
    const more = section.querySelector('.category-show-all');
    if (more) more.setAttribute('aria-expanded', String(expanded));
    this.refreshCategoryPreviews();
    layoutMasonry();
    if (typeof updateGalleryImagesArray === 'function') updateGalleryImagesArray();
  }

  // Сколько работ показывать в свёрнутом виде: два ряда сетки. Число колонок
  // читаем у самой сетки, поэтому оно верное на любой ширине и не требует
  // отдельных брейкпоинтов (8 работ на десктопе, 6 на планшете, 4 на телефоне).
  previewCount(gallery) {
    const columns = getComputedStyle(gallery).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    return columns * 2;
  }

  refreshCategoryPreviews() {
    const activeGallery = document.querySelector('.gallery-container.active');
    if (!activeGallery) return;

    // Прятать результаты поиска за свёрнутой категорией нельзя - человек уже
    // сказал, что именно он ищет, поэтому при активном запросе всё раскрыто.
    const forceOpen = Boolean(this.searchQuery);

    activeGallery.querySelectorAll('.theme-section.is-collapsible').forEach(section => {
      const gallery = section.querySelector('.gallery');
      if (!gallery) return;

      // style.display принадлежит фильтрам; превью пользуется отдельным
      // классом, чтобы эти два механизма не перетирали друг друга
      const matching = Array.from(gallery.querySelectorAll('.art-block'))
        .filter(block => block.style.display !== 'none');

      const previewLimit = this.previewCount(gallery);
      const collapsed = section.classList.contains('is-collapsed') && !forceOpen;
      const limit = collapsed ? previewLimit : matching.length;

      matching.forEach((block, i) => {
        block.classList.toggle('is-preview-hidden', i >= limit);
      });

      // Категория целиком помещается в превью - разворачивать нечего, поэтому
      // и шеврон, и кнопка внизу для неё бессмысленны
      const expandable = matching.length > previewLimit;
      section.classList.toggle('is-static', !expandable);
      section.classList.toggle('has-more', collapsed && expandable);

      const count = section.querySelector('.category-count');
      if (count) count.textContent = `${matching.length}`;

      // Кнопка внизу - переключатель, а не только "развернуть": после
      // раскрытия категории на 70+ работ заголовок с шевроном уезжает далеко
      // вверх, и свернуть обратно было нечем, не отлистав назад.
      const more = section.querySelector('.category-show-all');
      if (more) {
        // Прятать её имеет смысл, только когда превью и так показывает всё
        more.hidden = !expandable || forceOpen;
        more.textContent = collapsed ? `Show all ${matching.length} works` : 'Show less';
        more.setAttribute('aria-expanded', String(!collapsed));
      }
    });
  }

  updateThemeSectionsVisibility() {
    const activeGallery = document.querySelector('.gallery-container.active');
    if (!activeGallery) return;
    
    let visibleSections = 0;
    let hiddenSections = 0;
    
    activeGallery.querySelectorAll('.theme-section').forEach(section => {
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

// ===== МАСОНРИ-РАСКЛАДКА =====
// Работы больше не обрезаются под общий формат 3/4, поэтому высота у каждой
// своя. Сетка в style.css задаёт мелкий шаг строк (--masonry-unit), а здесь
// каждому блоку проставляется, сколько таких строк он занимает - так соседние
// колонки смыкаются без рваных провалов, которые дал бы обычный grid, где
// строка высотой с самую высокую ячейку.
function layoutMasonry() {
  const container = document.querySelector('.gallery-container.active');
  if (!container) return;

  container.querySelectorAll('.gallery').forEach(gallery => {
    const styles = getComputedStyle(gallery);
    const unit = parseFloat(styles.getPropertyValue('--masonry-unit')) || 4;
    const gap = parseFloat(styles.getPropertyValue('--masonry-gap')) || 16;

    const blocks = Array.from(gallery.querySelectorAll('.art-block'))
      .filter(block => block.style.display !== 'none'
        && !block.classList.contains('is-preview-hidden'));

    // Сначала читаем все высоты, потом пишем все span: вперемешку это заставило
    // бы браузер пересчитывать раскладку на каждый из 300+ блоков.
    // Высота известна ещё до загрузки картинки - width/height у <img>
    // проставляет generate_index.py, и браузер резервирует место сам.
    const heights = blocks.map(block => block.getBoundingClientRect().height);

    blocks.forEach((block, i) => {
      if (!heights[i]) return;
      block.style.gridRowEnd = `span ${Math.max(1, Math.ceil((heights[i] + gap) / unit))}`;
    });
  });
}

// Инициализация системы фильтров при готовности DOM
let galleryFilter;
document.addEventListener('DOMContentLoaded', () => {
  galleryFilter = new GalleryFilter();
  console.log('[Gallery Filter] System initialized');
});

// ===== FILTER SIDEBAR TOGGLE =====
// Кнопка "Filters" живёт в шапке на всех ширинах. Ниже 1024px сайдбар выезжает
// поверх страницы (.mobile-open), выше - он закреплён слева и кнопка только
// подсвечивает состояние фильтров, ничего не сдвигая.
const DOCKED_SIDEBAR_QUERY = '(min-width: 1025px)';

function sidebarIsDocked() {
  // Тот же порог, что и в @media (max-width: 1024px) в filter_styles.css
  return window.matchMedia
    ? window.matchMedia(DOCKED_SIDEBAR_QUERY).matches
    : window.innerWidth > 1024;
}

function setFilterButtonExpanded(isOpen) {
  const navFilterBtn = document.querySelector('.nav-filter-btn');
  if (navFilterBtn) navFilterBtn.setAttribute('aria-expanded', String(isOpen));
}

function toggleFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  if (!sidebar) return;

  if (sidebarIsDocked()) {
    const collapsed = document.body.classList.toggle('filters-collapsed');
    setFilterButtonExpanded(!collapsed);
    return;
  }

  const isOpen = sidebar.classList.toggle('mobile-open');
  document.body.classList.toggle('filter-open', isOpen);
  setFilterButtonExpanded(isOpen);
}

// Открыт ли сейчас блок фильтров - в любом из двух его видов
function filtersAreOpen() {
  const sidebar = document.querySelector('.filter-sidebar');
  if (!sidebar) return false;
  return sidebarIsDocked()
    ? !document.body.classList.contains('filters-collapsed')
    : sidebar.classList.contains('mobile-open');
}

function closeFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  if (!sidebar) return;
  if (sidebarIsDocked()) {
    document.body.classList.add('filters-collapsed');
  } else {
    sidebar.classList.remove('mobile-open');
    document.body.classList.remove('filter-open');
  }
  setFilterButtonExpanded(false);
}

// Клик вне блока фильтров закрывает его - и выехавшую панель, и закреплённую
// слева. Кнопка в шапке исключена: она сама переключатель, иначе открытие и
// закрытие пришлись бы на один и тот же клик.
document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.filter-sidebar');
  if (!sidebar || !filtersAreOpen()) return;

  // Пока открыт лайтбокс, он перекрывает страницу целиком - клики по нему
  // к фильтрам отношения не имеют
  const lightboxEl = document.getElementById('lightbox');
  if (lightboxEl && lightboxEl.classList.contains('active')) return;

  const navFilterBtn = document.querySelector('.nav-filter-btn');
  if (sidebar.contains(e.target)) return;
  if (navFilterBtn && navFilterBtn.contains(e.target)) return;

  closeFilterSidebar();
});

// Esc закрывает блок фильтров в любом из двух его видов. Если открыт лайтбокс,
// Esc принадлежит ему.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !filtersAreOpen()) return;
  const lightboxEl = document.getElementById('lightbox');
  if (lightboxEl && lightboxEl.classList.contains('active')) return;
  closeFilterSidebar();
});

// У кнопки два режима (выезжающая панель / свёрнутый закреплённый сайдбар).
// При переходе через 1024px состояние другого режима надо сбросить, иначе
// сайдбар может остаться скрытым на ширине, где скрывать его нечем.
(function syncSidebarAcrossBreakpoint() {
  const apply = () => {
    const docked = sidebarIsDocked();
    if (docked) {
      const sidebar = document.querySelector('.filter-sidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
      document.body.classList.remove('filter-open');
      setFilterButtonExpanded(!document.body.classList.contains('filters-collapsed'));
    } else {
      // filters-collapsed намеренно не сбрасываем: ниже 1025px это правило
      // ничего не делает, а свёрнутое состояние - значение по умолчанию, и
      // возврат на широкий экран не должен внезапно раскрывать сайдбар
      const sidebar = document.querySelector('.filter-sidebar');
      setFilterButtonExpanded(Boolean(sidebar && sidebar.classList.contains('mobile-open')));
    }
  };

  const mq = window.matchMedia && window.matchMedia(DOCKED_SIDEBAR_QUERY);
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  else if (mq && mq.addListener) mq.addListener(apply);
  else window.addEventListener('resize', apply);

  document.addEventListener('DOMContentLoaded', apply);
})();

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
  // Переход по конкретной категории из меню должен сразу показывать её работы,
  // иначе ссылка приводит к свёрнутому заголовку и требует лишнего клика
  const target = targetId ? document.getElementById(targetId) : document.getElementById('gallery');
  if (galleryFilter && targetId && target) {
    galleryFilter.setCategoryExpanded(target.closest('.theme-section'), true);
  }
  if (target) {
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}
