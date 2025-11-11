// ===== MULTI-DIMENSIONAL FILTER SYSTEM =====

class GalleryFilter {
  constructor() {
    this.allArtworks = [];
    this.activeFilters = {
      subject: [],
      mood: [],
      themes: [],
      year: []
    };
    this.currentView = 'chronological'; // 'chronological' or 'thematic'
    
    this.init();
  }
  
  init() {
    // Collect all artworks with their metadata
    document.querySelectorAll('.art-block').forEach(block => {
      const img = block.querySelector('img');
      if (img) {
        this.allArtworks.push({
          element: block,
          subject: img.dataset.subject || '',
          mood: img.dataset.mood || '',
          themes: img.dataset.themes || '',
          year: img.dataset.year || ''
        });
      }
    });
    
    // Setup filter checkboxes
    this.setupCheckboxes();
    
    // Setup clear button
    document.getElementById('clear-filters').addEventListener('click', () => {
      this.clearAllFilters();
    });
    
    // Setup collapse/expand for filter sections
    this.setupCollapsibleSections();
    
    // Setup view switcher buttons
    this.setupViewSwitcher();
    
    console.log(`✓ Gallery Filter initialized with ${this.allArtworks.length} artworks`);
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
      
      // Re-collect artworks from current view
      this.collectArtworks();
      this.applyFilters();
    });
    
    thematicBtn.addEventListener('click', () => {
      this.currentView = 'thematic';
      thematicBtn.classList.add('active');
      chronoBtn.classList.remove('active');
      thematicGallery.classList.add('active');
      chronoGallery.classList.remove('active');
      
      // Re-collect artworks from current view
      this.collectArtworks();
      this.applyFilters();
    });
  }
  
  collectArtworks() {
    // Re-collect artworks from the currently active gallery
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
            subject: img.dataset.subject || '',
            mood: img.dataset.mood || '',
            themes: img.dataset.themes || '',
            year: img.dataset.year || ''
          });
        }
      });
    }
  }
  
  setupCheckboxes() {
    const filterGroups = ['subject', 'mood', 'themes', 'year'];
    
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
    // Re-collect artworks in case view changed
    this.collectArtworks();
    
    let visibleCount = 0;
    
    this.allArtworks.forEach(artwork => {
      const shouldShow = this.matchesAllFilters(artwork);
      
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
    
    return visibleCount;
  }
  
  matchesAllFilters(artwork) {
    // If no filters are active, show everything
    const hasActiveFilters = Object.values(this.activeFilters).some(arr => arr.length > 0);
    if (!hasActiveFilters) {
      return true;
    }
    
    // Check each filter group (OR within group, AND between groups)
    for (const [group, values] of Object.entries(this.activeFilters)) {
      if (values.length === 0) continue; // Skip if no filters in this group
      
      const artworkValue = artwork[group];
      
      // If artwork has no value for this filter group, hide it
      if (!artworkValue) {
        return false;
      }
      
      // Check if artwork matches ANY of the selected values in this group
      const matches = values.some(filterValue => {
        return artworkValue === filterValue;
      });
      
      if (!matches) {
        return false; // Must match in ALL active filter groups
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
  
  updateThemeSectionsVisibility() {
    // In thematic view, hide theme sections with no visible works
    const thematicGallery = document.getElementById('thematic-gallery');
    if (!thematicGallery) return;
    
    thematicGallery.querySelectorAll('.theme-section').forEach(section => {
      const gallery = section.querySelector('.gallery');
      const visibleWorks = Array.from(gallery.querySelectorAll('.art-block'))
        .filter(block => block.style.display !== 'none');
      
      // Hide entire theme section if no visible works
      if (visibleWorks.length === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = '';
      }
    });
  }
  
  clearAllFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('.filter-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Clear active filters
    this.activeFilters = {
      subject: [],
      mood: [],
      themes: [],
      year: []
    };
    
    // Show all artworks
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

// Add filter toggle button for mobile
document.addEventListener('DOMContentLoaded', () => {
  const filterToggle = document.createElement('button');
  filterToggle.className = 'filter-toggle-btn';
  filterToggle.innerHTML = '🔍 Filters';
  filterToggle.onclick = toggleFilterSidebar;
  document.body.appendChild(filterToggle);
});
