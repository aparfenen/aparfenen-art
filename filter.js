// ===== MULTI-DIMENSIONAL FILTER SYSTEM WITH SEARCH - FIXED =====

class GalleryFilter {
  constructor() {
    this.allArtworks = [];
    this.activeFilters = {
      category: [],  // FIXED: changed from subject/mood/themes to category
      year: [],
      medium: [],
      tags: []
    };
    this.searchQuery = '';
    this.currentView = 'chronological';
    
    this.init();
  }
  
  init() {
    // Collect all artworks with their metadata
    document.querySelectorAll('.art-block').forEach(block => {
      const img = block.querySelector('img');
      if (img) {
        this.allArtworks.push({
          element: block,
          category: img.dataset.category || '',  // FIXED
          year: img.dataset.year || '',
          medium: img.dataset.medium || '',
          tags: img.dataset.tags || '',
          title: img.dataset.title || '',
          description: img.dataset.description || ''
        });
      }
    });
    
    this.setupSearch();
    this.setupCheckboxes();
    
    document.getElementById('clear-filters').addEventListener('click', () => {
      this.clearAllFilters();
    });
    
    this.setupCollapsibleSections();
    this.setupViewSwitcher();
    
    console.log(`✓ Gallery Filter initialized with ${this.allArtworks.length} artworks`);
  }
  
  setupSearch() {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFilters();
        this.updateCounter();
      });
    }
  }
  
  setupViewSwitcher() {
    const chronoBtn = document.getElementById('chronological-view-btn');
    const thematicBtn = document.getElementById('thematic-view-btn');
    const chronoGallery = document.getElementById('chronological-gallery');
    const thematicGallery = document.getElementById('thematic-gallery');
    
    if (!chronoBtn || !thematicBtn) return;
    
    chronoBtn.addEventListener('click', () => {
      this.currentView = 'chronological';
      chronoBtn.classList.add('active');
      thematicBtn.classList.remove('active');
      chronoGallery.classList.add('active');
      thematicGallery.classList.remove('active');
      
      this.collectArtworks();
      this.applyFilters();
    });
    
    thematicBtn.addEventListener('click', () => {
      this.currentView = 'thematic';
      thematicBtn.classList.add('active');
      chronoBtn.classList.remove('active');
      thematicGallery.classList.add('active');
      chronoGallery.classList.remove('active');
      
      this.collectArtworks();
      this.applyFilters();
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
    }
  }
  
  setupCheckboxes() {
    const filterGroups = ['category', 'year', 'medium', 'tags'];  // FIXED
    
    filterGroups.forEach(group => {
      const checkboxes = document.querySelectorAll(`input[data-filter-group="${group}"]`);
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          this.handleFilterChange(group, e.target.value, e.target.checked);
        });
      });
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
    
    this.applyFilters();
    this.updateCounter();
  }
  
  applyFilters() {
    this.collectArtworks();
    
    let visibleCount = 0;
    
    this.allArtworks.forEach(artwork => {
      const shouldShow = this.matchesAllFilters(artwork) && this.matchesSearch(artwork);
      
      if (shouldShow) {
        artwork.element.style.display = '';
        visibleCount++;
      } else {
        artwork.element.style.display = 'none';
      }
    });
    
    // Update gallery images array for lightbox navigation
    const activeGallery = this.currentView === 'chronological' 
      ? document.getElementById('chronological-gallery')
      : document.getElementById('thematic-gallery');
    
    if (activeGallery) {
      window.allGalleryImages = Array.from(activeGallery.querySelectorAll('.gallery img'))
        .filter(img => img.closest('.art-block').style.display !== 'none');
    }
    
    // Update theme sections visibility in thematic view
    if (this.currentView === 'thematic') {
      this.updateThemeSectionsVisibility();
    }
    
    this.updateNoResultsMessage(visibleCount);
    
    return visibleCount;
  }
  
  matchesSearch(artwork) {
    if (!this.searchQuery) return true;
    
    const searchableText = [
      artwork.title,
      artwork.description,
      artwork.category,
      artwork.tags
    ].join(' ').toLowerCase();
    
    return searchableText.includes(this.searchQuery);
  }
  
  matchesAllFilters(artwork) {
    const hasActiveFilters = Object.values(this.activeFilters).some(arr => arr.length > 0);
    if (!hasActiveFilters) {
      return true;
    }
    
    // Check each filter group (OR within group, AND between groups)
    for (const [group, values] of Object.entries(this.activeFilters)) {
      if (values.length === 0) continue;
      
      const artworkValue = artwork[group];
      
      if (!artworkValue) {
        return false;
      }
      
      // Check if artwork matches ANY of the selected values in this group
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
    const visibleCount = this.allArtworks.filter(artwork => 
      artwork.element.style.display !== 'none'
    ).length;
    
    const counterElement = document.getElementById('artwork-counter');
    if (counterElement) {
      counterElement.textContent = `${visibleCount} work${visibleCount !== 1 ? 's' : ''}`;
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
    
    thematicGallery.querySelectorAll('.theme-section').forEach(section => {
      const gallery = section.querySelector('.gallery');
      const visibleWorks = Array.from(gallery.querySelectorAll('.art-block'))
        .filter(block => block.style.display !== 'none');
      
      if (visibleWorks.length === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = '';
      }
    });
  }
  
  clearAllFilters() {
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

// Initialize filter system when DOM is ready
let galleryFilter;
document.addEventListener('DOMContentLoaded', () => {
  galleryFilter = new GalleryFilter();
});

// ===== FILTER SIDEBAR TOGGLE FOR MOBILE =====
function toggleFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  sidebar.classList.toggle('mobile-open');
}

function closeFilterSidebar() {
  const sidebar = document.querySelector('.filter-sidebar');
  sidebar.classList.remove('mobile-open');
}

// Add filter toggle button for mobile
document.addEventListener('DOMContentLoaded', () => {
  const filterToggle = document.createElement('button');
  filterToggle.className = 'filter-toggle-btn';
  filterToggle.innerHTML = '🔍 Filters';
  filterToggle.onclick = toggleFilterSidebar;
  document.body.appendChild(filterToggle);
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.filter-sidebar');
    const filterToggle = document.querySelector('.filter-toggle-btn');
    
    if (window.innerWidth <= 1024 && 
        sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) && 
        e.target !== filterToggle) {
      closeFilterSidebar();
    }
  });
  
  // Close sidebar when filter is applied on mobile
  if (window.innerWidth <= 1024) {
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        setTimeout(() => {
          closeFilterSidebar();
        }, 300);
      });
    });
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

function switchToThematic() {
  if (galleryFilter) {
    const thematicBtn = document.getElementById('thematic-view-btn');
    if (thematicBtn) thematicBtn.click();
  }
  const gallery = document.getElementById('gallery');
  if (gallery) {
    setTimeout(() => gallery.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}
