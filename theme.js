// ===== DARK MODE THEME MANAGER =====

class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || this.getSystemTheme();
    this.init();
  }

  init() {
    // Apply initial theme
    this.applyTheme(this.theme);

    // Setup toggle button
    this.setupToggle();

    // Listen for system theme changes
    this.watchSystemTheme();

    console.log(`[Theme] Initialized with ${this.theme} mode`);
  }

  getSystemTheme() {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  getStoredTheme() {
    // Check localStorage for user preference
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      console.warn('[Theme] localStorage not available:', e);
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('[Theme] Could not save theme preference:', e);
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.theme = theme;
    this.setStoredTheme(theme);

    // Update meta theme-color for mobile browsers
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');

    // Update button text
    this.updateButtonText(theme);

    console.log(`[Theme] Applied ${theme} mode`);
  }

  updateButtonText(theme) {
    const toggleText = document.querySelector('.toggle-text');
    if (toggleText) {
      // Show "Light Mode" when in dark mode (click to switch to light)
      // Show "Dark Mode" when in light mode (click to switch to dark)
      toggleText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
  }

  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  setupToggle() {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    } else {
      console.warn('[Theme] Toggle button not found');
    }
  }

  watchSystemTheme() {
    // Listen for system theme changes (only if user hasn't set preference)
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

      darkModeQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!this.getStoredTheme()) {
          const newTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(newTheme);
          console.log(`[Theme] Auto-switched to ${newTheme} mode (system preference changed)`);
        }
      });
    }
  }
}

// Initialize theme manager when DOM is ready
let themeManager;
document.addEventListener('DOMContentLoaded', () => {
  themeManager = new ThemeManager();
});
