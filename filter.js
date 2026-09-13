const FILTER_GROUPS = ['category', 'year', 'medium', 'tags'];
const VIEWS = ['featured', 'chronological', 'thematic'];
const DEFAULT_VIEW = 'chronological';
const MAX_SEARCH_LENGTH = 100;

class GalleryFilter {
  constructor() {
    this.allArtworks = [];
    this.activeFilters = {
      category: [],
      year: [],
      medium: [],
      tags: []
    };
    this.searchQuery = '';
    this.currentView = DEFAULT_VIEW;

    this.baseTitle = document.title;
    this.knownValues = {};
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

    let previewResizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(previewResizeTimer);
      previewResizeTimer = setTimeout(() => {
        this.refreshCategoryPreviews();
        layoutMasonry();
        if (typeof updateGalleryImagesArray === 'function') updateGalleryImagesArray();
      }, 150);
    });

    this.applyState(this.readStateFromURL(), { updateURL: 'replace' });

    window.addEventListener('popstate', () => this.handlePopState());

    console.log(`✅ [Gallery Filter] Initialized with ${this.allArtworks.length} unique artworks`);
  }


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
      view: VIEWS.includes(view) ? view : DEFAULT_VIEW
    };
  }

  currentState() {
    const filters = {};
    FILTER_GROUPS.forEach(group => { filters[group] = this.activeFilters[group]; });
    return { filters, q: this.searchQuery, view: this.currentView };
  }

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
    if (this.currentView !== DEFAULT_VIEW) {
      params.set('view', this.currentView);
    }

    const query = params.toString().replace(/%2C/g, ',');
    return query ? `?${query}` : '';
  }

  syncURL(mode = 'push') {
    const url = `${window.location.pathname}${this.buildQueryString()}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
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

    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = state.q;
    }
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      const group = checkbox.dataset.filterGroup;
      checkbox.checked = Boolean(group && this.activeFilters[group] &&
        this.activeFilters[group].includes(checkbox.value));
    });

    this.setView(state.view, { updateURL: false });

    this.updateDocumentTitle();
    if (updateURL) {
      this.syncURL(updateURL);
    }
  }

  handlePopState() {
    const state = this.readStateFromURL();

    if (this.stateKey(state) === this.stateKey(this.currentState())) return;

    this.applyState(state);
    this.lastSyncWasSearch = false;
  }

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
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchQuery = e.target.value.toLowerCase().trim().slice(0, MAX_SEARCH_LENGTH);
          this.applyFilters();
          this.updateCounter();
          this.updateDocumentTitle();
          this.syncURL(this.lastSyncWasSearch ? 'replace' : 'push');
          this.lastSyncWasSearch = true;
        }, 300);
      });
    }
  }
  
  activeGalleryElement() {
    return document.getElementById(`${this.currentView}-gallery`);
  }

  setupViewSwitcher() {
    const wired = VIEWS.filter(view => {
      const btn = document.getElementById(`${view}-view-btn`);
      if (!btn) return false;
      btn.addEventListener('click', () => this.setView(view));
      return true;
    });

    if (!wired.length) {
      console.warn('[Gallery Filter] View switcher buttons not found');
    }
  }

  setView(view, { updateURL = true } = {}) {
    const requested = VIEWS.includes(view) ? view : DEFAULT_VIEW;
    this.currentView = document.getElementById(`${requested}-gallery`) ? requested : DEFAULT_VIEW;

    VIEWS.forEach(name => {
      const isActive = name === this.currentView;
      const btn = document.getElementById(`${name}-view-btn`);
      const gallery = document.getElementById(`${name}-gallery`);
      if (btn) {
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      }
      if (gallery) gallery.classList.toggle('active', isActive);
    });

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
    const activeGallery = this.activeGalleryElement();
    
    if (activeGallery) {
      activeGallery.querySelectorAll('.art-block').forEach(block => {
        const img = block.querySelector('img');
        if (img) {
          this.allArtworks.push({
            element: block,
            id: img.dataset.id || '',
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

  setupShareLink() {
    const clearButton = document.getElementById('clear-filters');
    if (!clearButton) return;

    const button = document.createElement('button');
    button.id = 'copy-filter-link';
    button.type = 'button';
    button.textContent = 'Copy link to this view';
    clearButton.insertAdjacentElement('afterend', button);

    button.addEventListener('click', () => {
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

    this.refreshCategoryPreviews();

    layoutMasonry();

    if (typeof updateGalleryImagesArray === 'function') {
      updateGalleryImagesArray();
    } else {
      const activeGallery = this.activeGalleryElement();
      
      if (activeGallery && window) {
        window.allGalleryImages = Array.from(activeGallery.querySelectorAll('.gallery img'))
          .filter(img => {
            const block = img.closest('.art-block');
            return block && block.style.display !== 'none';
          });
      }
    }
  
    this.updateThemeSectionsVisibility();
    
    this.updateNoResultsMessage(visibleCount);
    
    return visibleCount;
  }
  
  matchesSearch(artwork) {
    if (!this.searchQuery) return true;
    
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
    const hasActiveFilters = Object.values(this.activeFilters).some(arr => arr.length > 0);
    if (!hasActiveFilters) {
      return true;
    }
    
    for (const [group, values] of Object.entries(this.activeFilters)) {
      if (values.length === 0) continue;
      
      const artworkValue = artwork[group];

      if (!artworkValue) {
        return false;
      }

      const matches = values.some(filterValue => {
        if (group === 'tags') {
          const artworkTags = artworkValue.split(',').map(t => t.trim());
          return artworkTags.includes(filterValue);
        }
        return artworkValue === filterValue;
      });
    
      if (!matches) {
        return false;
      }
    }
    
    return true;
  }
  
  updateCounter() {
    const seen = new Set();
    let visibleCount = 0;
    this.allArtworks.forEach(artwork => {
      if (artwork.element.style.display === 'none') return;
      if (artwork.id) {
        if (seen.has(artwork.id)) return;
        seen.add(artwork.id);
      }
      visibleCount += 1;
    });

    const counterElement = document.getElementById('artwork-counter');
    if (counterElement) {
      counterElement.textContent = `${visibleCount} work${visibleCount !== 1 ? 's' : ''}`;
    }

    const totalActive = Object.values(this.activeFilters).reduce((sum, arr) => sum + arr.length, 0)
      + (this.searchQuery ? 1 : 0);


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
      const label = totalActive > 0 ? `Filters (${totalActive} active)` : 'Filters';
      navFilterBtn.setAttribute('aria-label', label);
      navFilterBtn.setAttribute('title', label);
    }
  }
  
  updateNoResultsMessage(visibleCount) {
    const activeGallery = this.activeGalleryElement();
    
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
  
  setupCategorySections() {
    document.querySelectorAll('.gallery-container .theme-section').forEach(section => {
      if (section.dataset.collapsibleReady) return;
      section.dataset.collapsibleReady = '1';

      const heading = section.querySelector('.section-title');
      const gallery = section.querySelector('.gallery');
      if (!heading || !gallery) return;

      const title = heading.textContent.trim();
      if (!gallery.id) gallery.id = `${heading.id || title.toLowerCase().replace(/\s+/g, '-')}-works`;

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

  previewCount(gallery) {
    const columns = getComputedStyle(gallery).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    return columns * 2;
  }

  refreshCategoryPreviews() {
    const activeGallery = document.querySelector('.gallery-container.active');
    if (!activeGallery) return;

    const forceOpen = Boolean(this.searchQuery);

    activeGallery.querySelectorAll('.theme-section.is-collapsible').forEach(section => {
      const gallery = section.querySelector('.gallery');
      if (!gallery) return;

      const matching = Array.from(gallery.querySelectorAll('.art-block'))
        .filter(block => block.style.display !== 'none');

      const previewLimit = this.previewCount(gallery);
      const collapsed = section.classList.contains('is-collapsed') && !forceOpen;
      const limit = collapsed ? previewLimit : matching.length;

      matching.forEach((block, i) => {
        block.classList.toggle('is-preview-hidden', i >= limit);
      });

      const expandable = matching.length > previewLimit;
      section.classList.toggle('is-static', !expandable);
      section.classList.toggle('has-more', collapsed && expandable);

      const count = section.querySelector('.category-count');
      if (count) count.textContent = `${matching.length}`;
  
      const more = section.querySelector('.category-show-all');
      if (more) {
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

    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = '';
      this.searchQuery = '';
    }
    
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    this.activeFilters = {
      category: [],
      year: [],
      medium: [],
      tags: []
    };
    
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

    const heights = blocks.map(block => block.getBoundingClientRect().height);

    blocks.forEach((block, i) => {
      if (!heights[i]) return;
      block.style.gridRowEnd = `span ${Math.max(1, Math.ceil((heights[i] + gap) / unit))}`;
    });
  });
}

let galleryFilter;
document.addEventListener('DOMContentLoaded', () => {
  galleryFilter = new GalleryFilter();
  console.log('[Gallery Filter] System initialized');
});

const DOCKED_SIDEBAR_QUERY = '(min-width: 1025px)';

function sidebarIsDocked() {
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

document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.filter-sidebar');
  if (!sidebar || !filtersAreOpen()) return;

  const lightboxEl = document.getElementById('lightbox');
  if (lightboxEl && lightboxEl.classList.contains('active')) return;

  const navFilterBtn = document.querySelector('.nav-filter-btn');
  if (sidebar.contains(e.target)) return;
  if (navFilterBtn && navFilterBtn.contains(e.target)) return;

  closeFilterSidebar();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !filtersAreOpen()) return;
  const lightboxEl = document.getElementById('lightbox');
  if (lightboxEl && lightboxEl.classList.contains('active')) return;
  closeFilterSidebar();
});

(function syncSidebarAcrossBreakpoint() {
  const apply = () => {
    const docked = sidebarIsDocked();
    if (docked) {
      const sidebar = document.querySelector('.filter-sidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
      document.body.classList.remove('filter-open');
      setFilterButtonExpanded(!document.body.classList.contains('filters-collapsed'));
    } else {
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

function activateView(view) {
  if (!galleryFilter) return;
  const btn = document.getElementById(`${view}-view-btn`);
  if (btn) btn.click();
}

function switchToChronological() {
  activateView('chronological');
  const gallery = document.getElementById('gallery');
  if (gallery) {
    setTimeout(() => gallery.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

function switchToFeatured() {
  activateView('featured');
  const gallery = document.getElementById('gallery');
  if (gallery) {
    setTimeout(() => gallery.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

function switchToThematic(targetId) {
  activateView('thematic');
  const target = targetId ? document.getElementById(targetId) : document.getElementById('gallery');
  if (galleryFilter && targetId && target) {
    galleryFilter.setCategoryExpanded(target.closest('.theme-section'), true);
  }
  if (target) {
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}
