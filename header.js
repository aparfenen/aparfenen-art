(function () {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  const root = document.documentElement;

  let lastHeight = 0;
  function syncHeight() {
    const h = nav.offsetHeight;
    if (h && h !== lastHeight) {
      lastHeight = h;
      root.style.setProperty('--nav-h', h + 'px');
    }
  }
  syncHeight();

  if (window.ResizeObserver) {
    new ResizeObserver(syncHeight).observe(nav);
  } else {
    window.addEventListener('resize', syncHeight);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncHeight).catch(() => {});
  }

  const REVEAL_ZONE = 90;
  const THRESHOLD = 8;

  let lastY = Math.max(0, window.pageYOffset || 0);
  let ticking = false;

  function update() {
    ticking = false;

    if (document.body.classList.contains('scroll-locked')) return;

    const y = Math.max(0, window.pageYOffset || root.scrollTop || 0);

    nav.classList.toggle('nav-scrolled', y > 4);

    const delta = y - lastY;
    if (Math.abs(delta) < THRESHOLD) return;

    const drawerOpen = document.body.classList.contains('filter-open');

    const hide = !(y <= REVEAL_ZONE || delta < 0 || drawerOpen);
    nav.classList.toggle('nav-hidden', hide);
    document.body.classList.toggle('nav-away', hide);

    lastY = y;
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  nav.addEventListener('focusin', () => nav.classList.remove('nav-hidden'));

  const canHover = () => !window.matchMedia || window.matchMedia('(hover: hover)').matches;

  const dropdowns = Array.from(nav.querySelectorAll('.has-dropdown'));

  dropdowns.forEach((dd) => {
    const toggle = dd.querySelector('a');
    const menu = dd.querySelector('.sub-menu');
    if (!toggle || !menu) return;

    let openTimer = null;
    let suppressFocusOpen = false;

    const open = () => {
      clearTimeout(openTimer);
      dd.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      clearTimeout(openTimer);
      dd.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    dd._closeDropdown = close;
    close();

    dd.addEventListener('mouseenter', () => {
      if (!canHover()) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(open, 90);
    });
    dd.addEventListener('mouseleave', close);

    toggle.addEventListener('click', (e) => {
      if (canHover()) return;
      e.preventDefault();
      if (dd.classList.contains('is-open')) close();
      else open();
    });

    menu.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      suppressFocusOpen = true;
      close();
      toggle.focus();
      suppressFocusOpen = false;
    });

    dd.addEventListener('focusin', (e) => {
      if (suppressFocusOpen) return;
      const el = e.target;
      if (el && el.matches && el.matches(':focus-visible')) open();
    });

    dd.addEventListener('focusout', (e) => {
      if (!dd.contains(e.relatedTarget)) close();
    });

    dd.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !dd.classList.contains('is-open')) return;
      close();
      toggle.focus();
    });
  });

  document.addEventListener('click', (e) => {
    dropdowns.forEach((dd) => {
      if (!dd.contains(e.target) && dd._closeDropdown) dd._closeDropdown();
    });
  });

  nav.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      const id = link.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.addEventListener('load', () => {
    if (!window.location.hash) window.scrollTo(0, 0);
  });
})();
