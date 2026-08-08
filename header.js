// ===== HEADER BAR =====
// The nav is position: fixed and full-bleed. Two jobs live here:
//   1. publish its real height as --nav-h, so everything that has to clear it
//      (content padding, sidebar padding, anchor jumps, category indicator)
//      follows a measurement instead of a per-breakpoint magic number;
//   2. hide it while the reader scrolls down and bring it straight back on the
//      first upward scroll, so it is available without ever covering artwork.

(function () {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  const root = document.documentElement;

  // The bar's height changes with the viewport: below ~700px the links wrap to
  // a second row. Measuring beats hardcoding - the old CSS carried two
  // scroll-margin-top values (90px / 130px) that had to be kept in sync with
  // the nav's layout by hand.
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
  // Meie Script loads late and reflows the bar
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncHeight).catch(() => {});
  }

  const REVEAL_ZONE = 90; // near the top of the page the bar is always shown
  const THRESHOLD = 8;    // ignore inertial jitter and sub-pixel scrolling

  let lastY = Math.max(0, window.pageYOffset || 0);
  let ticking = false;

  function update() {
    ticking = false;

    // While the lightbox is open the body is position: fixed (lockPageScroll in
    // lightbox.js), which reports pageYOffset 0. Acting on those frames would
    // flip the bar open behind the overlay and again on close.
    if (document.body.classList.contains('scroll-locked')) return;

    const y = Math.max(0, window.pageYOffset || root.scrollTop || 0);

    nav.classList.toggle('nav-scrolled', y > 4);

    const delta = y - lastY;
    // Deliberately do not update lastY below the threshold: small movements
    // accumulate until they add up to a real gesture.
    if (Math.abs(delta) < THRESHOLD) return;

    // The drawer's only close affordance is the Filters button in the bar, so
    // the bar has to stay put while the drawer is open.
    const drawerOpen = document.body.classList.contains('filter-open');

    const hide = !(y <= REVEAL_ZONE || delta < 0 || drawerOpen);
    nav.classList.toggle('nav-hidden', hide);
    // Мирится с фиксированными элементами, которым иначе пришлось бы вечно
    // держать отступ под шапку, даже когда её на экране нет (кнопка "вверх")
    document.body.classList.toggle('nav-away', hide);

    lastY = y;
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  // Tabbing into a hidden bar would otherwise focus something off-screen
  nav.addEventListener('focusin', () => nav.classList.remove('nav-hidden'));

  // ===== "Gallery" dropdown =====
  // Held open by an explicit .is-open class instead of the CSS :hover it used
  // to rely on. Nothing fires on load, so the menu can no longer appear just
  // because the cursor happens to be parked over the bar during a reload, and
  // choosing an entry closes it even on touch, where the emulated :hover
  // otherwise stays glued to the tapped element.
  const canHover = () => !window.matchMedia || window.matchMedia('(hover: hover)').matches;

  const dropdowns = Array.from(nav.querySelectorAll('.has-dropdown'));

  dropdowns.forEach((dd) => {
    const toggle = dd.querySelector('a');
    const menu = dd.querySelector('.sub-menu');
    if (!toggle || !menu) return;

    let openTimer = null;
    // Set while focus is being moved back to the toggle after a selection, so
    // that the focusin it triggers does not immediately reopen the menu.
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

    // Pointer: a short dwell before opening, so brushing past the bar on the
    // way somewhere else does not flash the menu open.
    dd.addEventListener('mouseenter', () => {
      if (!canHover()) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(open, 90);
    });
    dd.addEventListener('mouseleave', close);

    toggle.addEventListener('click', (e) => {
      // With a mouse the link keeps working (jump to #gallery) and hover shows
      // the menu. Without hover the tap has to do the opening instead.
      if (canHover()) return;
      e.preventDefault();
      if (dd.classList.contains('is-open')) close();
      else open();
    });

    // Picking an entry dismisses the menu and hands focus back to the toggle
    menu.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      suppressFocusOpen = true;
      close();
      toggle.focus();
      suppressFocusOpen = false;
    });

    // Keyboard focus opens the menu; a tap or click focuses the link too, and
    // that case belongs to the click handler above. Without the
    // :focus-visible test the two fought each other on touch - focusin opened
    // the menu and the click that followed read it as already open and closed
    // it again, so the first tap did nothing.
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

  // Tapping anywhere else dismisses an open menu (the touch equivalent of
  // moving the pointer away)
  document.addEventListener('click', (e) => {
    dropdowns.forEach((dd) => {
      if (!dd.contains(e.target) && dd._closeDropdown) dd._closeDropdown();
    });
  });

  // ===== In-page nav links scroll without writing a #hash =====
  // "Gallery", "Statement", "Commissions" and "Activity" are plain #anchors, so
  // clicking one left e.g. #gallery in the address bar - and every later reload
  // then jumped straight back down to that section, skipping the top of the
  // site. The category entries in the dropdown already avoided this by calling
  // switchToThematic() and returning false; this gives the remaining links the
  // same behaviour, and keeps the hash meaning exactly one thing: a single
  // artwork opened in the lightbox (see lightbox.js and the README).
  // Registered after the dropdown handlers so a tap that only opens the menu
  // (which preventDefaults) is not also treated as a jump.
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

  // A reload should put the reader back at the top of the site. Browsers
  // restore the previous scroll offset by default, which had the same effect as
  // the stale hash above: the page opened halfway down with no explanation.
  // An artwork deep link is the one case that still owns the entry point, so it
  // is left alone.
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.addEventListener('load', () => {
    if (!window.location.hash) window.scrollTo(0, 0);
  });
})();
