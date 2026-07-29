// ===== DARK MODE THEME MANAGER =====
// Note: the flash-prevention snippet that used to live here now runs inline
// in index.html's <head> (before first paint, without an extra network request).

class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || this.getSystemTheme();
    this.setupToggle();
    this.watchSystemTheme();
    this.updateButtonText(this.theme);
    console.log(`[Theme] Initialized with ${this.theme} mode`);
  }

  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.theme = theme;
    this.setStoredTheme(theme);

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#fdfcf9');

    this.updateButtonText(theme);
    console.log(`[Theme] Applied ${theme} mode`);
  }

  updateButtonText(theme) {
    const toggleText = document.querySelector('.toggle-text');
    if (toggleText) {
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
      toggleBtn.addEventListener('click', () => this.toggleTheme());
    } else {
      console.warn('[Theme] Sidebar toggle button not found');
    }

    const navToggleBtn = document.getElementById('nav-theme-toggle');
    if (navToggleBtn) {
      navToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  watchSystemTheme() {
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

let themeManager;
document.addEventListener('DOMContentLoaded', () => {
  themeManager = new ThemeManager();
});
