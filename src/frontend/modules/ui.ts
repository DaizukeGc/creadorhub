// Utilidades de interfaz compartidas: scroll lock, modales, menú móvil y PWA.

let scrollLocks = 0;

/** Bloquea el scroll del body (con contador para evitar saltos al cerrar). */
export function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    document.body.style.overflow = 'hidden';
  }
}

/** Libera el scroll del body si no queda ningún bloqueo pendiente. */
export function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = '';
  }
}

/** Abre un modal (elemento con clase .modal-overlay) bloqueando el scroll. */
export function openModal(el: HTMLElement | null) {
  if (!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  lockScroll();
}

/** Cierra un modal liberando el scroll. */
export function closeModal(el: HTMLElement | null) {
  if (!el) return;
  if (!el.classList.contains('show')) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  unlockScroll();
}

/** Cierra todos los modales abiertos. */
export function closeAllModals() {
  document.querySelectorAll<HTMLElement>('.modal-overlay.show').forEach((m) => closeModal(m));
}

/** Inicializa el menú lateral en móvil. */
export function initMobileMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  const close = () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fas fa-bars"></i>';
    unlockScroll();
  };

  const open = () => {
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = '<i class="fas fa-times"></i>';
    lockScroll();
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) close();
    else open();
  });

  menu.querySelectorAll('[data-mobile-link]').forEach((link) => {
    link.addEventListener('click', () => close());
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (menu.classList.contains('open') && !menu.contains(target) && !btn.contains(target)) {
      close();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && menu.classList.contains('open')) close();
  });
}

/** Cierra modales con la tecla Escape. */
export function initEscapeKey() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAllModals();
    const menu = document.getElementById('mobileMenu');
    if (menu?.classList.contains('open')) {
      menu.classList.remove('open');
      const btn = document.getElementById('menuBtn');
      btn?.setAttribute('aria-expanded', 'false');
      if (btn) btn.innerHTML = '<i class="fas fa-bars"></i>';
      unlockScroll();
    }
  });
}

/** Registra el Service Worker para soporte offline (PWA). */
export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* El sitio sigue funcionando sin offline */
    });
  });
}

/** Devuelve la URL de una imagen de respaldo cuando el recurso falla. */
export function fallbackImage(category?: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('vela')) return '/assets/jy/vela-rosa-decorativa.svg';
  if (cat.includes('especial')) return '/assets/jy/set-premium.svg';
  return '/assets/jy/jabon-rosa-amarilla.svg';
}

/** Normaliza texto para comparar sin acentos ni mayúsculas. */
export function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
