// Bootstrap Principal de la Tienda JY Velas y Jabones
import { Product } from './types';
import { apiFetch, escapeHTML, formatMoney, showToast } from './api/client';
import { CartManager } from './modules/cart';
import { initWheel } from './modules/wheel';
import { initChatBot } from './modules/bot';
import { initSearch } from './modules/search';
import { initCursorGlow, initCountdown, initSocialProof, triggerConfetti } from './modules/visualMagic';
import { initEscapeKey, initMobileMenu, initServiceWorker } from './modules/ui';

class StoreApp {
  private products: Product[] = [];
  private favorites: number[] = [];
  private currentFilter: string = 'Todos';
  private cartManager: CartManager;

  constructor() {
    this.cartManager = new CartManager();
    this.loadFavorites();
    this.init();
  }

  private async init() {
    this.initTheme();
    initCursorGlow();
    initCountdown();
    initSocialProof();
    initWheel();
    initChatBot(this.cartManager);
    initSearch(this.cartManager, (id) => this.openQuickView(id));
    initMobileMenu();
    initEscapeKey();
    initServiceWorker();

    this.bindGlobalEvents();
    await this.loadCatalog();
    await this.loadReviews();
  }

  private initTheme() {
    const saved = localStorage.getItem('jy_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.innerHTML = `<i class="fas fa-${saved === 'light' ? 'moon' : 'sun'}"></i>`;
      themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const next = isLight ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('jy_theme', next);
        themeBtn.innerHTML = `<i class="fas fa-${next === 'light' ? 'moon' : 'sun'}"></i>`;
      });
    }
  }

  private loadFavorites() {
    try {
      const stored = localStorage.getItem('jy_favs_v2');
      this.favorites = stored ? JSON.parse(stored) : [];
      this.updateFavCount();
    } catch (e) {
      this.favorites = [];
    }
  }

  private saveFavorites() {
    localStorage.setItem('jy_favs_v2', JSON.stringify(this.favorites));
    this.updateFavCount();
  }

  private updateFavCount() {
    const countEl = document.getElementById('favCount');
    if (countEl) countEl.textContent = String(this.favorites.length);
  }

  private async loadCatalog() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
      // Mostrar Skeleton Loaders elegantes
      grid.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="product-card skeleton-card">
          <div class="product-image skeleton"></div>
          <div class="product-info" style="gap:10px">
            <div class="skeleton" style="height:14px;width:35%"></div>
            <div class="skeleton" style="height:20px;width:75%"></div>
            <div class="skeleton" style="height:14px;width:90%"></div>
            <div class="skeleton" style="height:28px;width:45%;margin-top:auto"></div>
          </div>
        </div>
      `).join('');
    }

    try {
      const res = await apiFetch('/api/products');
      this.products = res.products || [];
      this.cartManager.setCatalog(this.products);
      this.renderFilters();
      this.renderProducts();
    } catch (err) {
      if (grid) grid.innerHTML = '<div style="color:var(--err);text-align:center;grid-column:1/-1">Error al conectar con el servidor.</div>';
    }
  }

  private renderFilters() {
    const filtersContainer = document.getElementById('filters');
    if (!filtersContainer) return;

    const categories = ['Todos', 'Jabones', 'Velas', 'Especiales'];
    filtersContainer.innerHTML = categories.map(c => `
      <button class="filter-btn ${c === this.currentFilter ? 'active' : ''}" data-cat="${c}">${c}</button>
    `).join('');

    filtersContainer.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.cat || 'Todos';
        if (cat === this.currentFilter) return;
        this.currentFilter = cat;

        // View Transitions API
        if ((document as any).startViewTransition) {
          (document as any).startViewTransition(() => {
            this.renderFilters();
            this.renderProducts();
          });
        } else {
          this.renderFilters();
          this.renderProducts();
        }
      });
    });
  }

  private renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const filtered = this.currentFilter === 'Todos'
      ? this.products
      : this.products.filter(p => (p.category || '').toLowerCase() === this.currentFilter.toLowerCase());

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="text-align:center;grid-column:1/-1;padding:40px;color:var(--mut)">No hay productos en esta categoría.</div>';
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const isFav = this.favorites.includes(p.id);
      return `
        <div class="product-card fade-in visible">
          <div class="product-image">
            <img src="${p.image || '/assets/jy/coleccion-artesanal.svg'}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='/assets/jy/coleccion-artesanal.svg'">
            <div class="product-badges">
              ${p.badge ? `<span class="product-badge badge-${escapeHTML(p.badge_type || 'new')}">${escapeHTML(p.badge)}</span>` : ''}
            </div>
            <div class="product-actions">
              <button class="product-action-btn ${isFav ? 'fav' : ''}" data-fav="${p.id}" title="Favorito">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
              </button>
              <button class="product-action-btn" data-view="${p.id}" title="Vista Rápida">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            ${p.stock <= 6 ? `<span class="stock-tag">🔥 Quedan ${p.stock}</span>` : ''}
            <button class="quick-view-btn" data-view="${p.id}">Ver detalles</button>
          </div>
          <div class="product-info">
            <span class="product-category">${escapeHTML(p.category)}</span>
            <h3 class="product-title">${escapeHTML(p.name)}</h3>
            <p class="product-description">${escapeHTML(p.description)}</p>
            <div class="product-footer">
              <div>
                <span class="product-price">${formatMoney(p.price)}</span>
                ${p.old_price ? `<span class="product-old">${formatMoney(p.old_price)}</span>` : ''}
              </div>
              <button class="add-to-cart" data-add="${p.id}" title="Agregar al carrito">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Vincular eventos
    grid.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number((btn as HTMLElement).dataset.add);
        this.cartManager.addItem(id, 1);
      });
    });

    grid.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.view);
        this.openQuickView(id);
      });
    });

    grid.querySelectorAll('[data-fav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.fav);
        this.toggleFavorite(id);
      });
    });
  }

  private toggleFavorite(id: number) {
    const idx = this.favorites.indexOf(id);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
      showToast('Eliminado de favoritos', 'info');
    } else {
      this.favorites.push(id);
      showToast('Guardado en tus favoritos ❤️', 'success');
    }
    this.saveFavorites();
    this.renderProducts();
  }

  private openQuickView(productId: number) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    const modal = document.getElementById('quickViewModal');
    if (!modal) return;

    const img = document.getElementById('modalImage') as HTMLImageElement;
    const cat = document.getElementById('modalCategory');
    const title = document.getElementById('modalTitle');
    const price = document.getElementById('modalPrice');
    const desc = document.getElementById('modalDescription');
    const feat = document.getElementById('modalFeatures');
    const addBtn = document.getElementById('modalAddToCart');

    if (img) img.src = p.image || '/assets/jy/coleccion-artesanal.svg';
    (img as HTMLImageElement).onerror = () => {
      if (img) img.src = '/assets/jy/coleccion-artesanal.svg';
    };
    if (cat) cat.textContent = p.category;
    if (title) title.textContent = p.name;
    if (price) price.innerHTML = `${formatMoney(p.price)} ${p.old_price ? `<span class="product-old">${formatMoney(p.old_price)}</span>` : ''}`;
    if (desc) desc.textContent = p.description;
    if (feat) {
      feat.innerHTML = (p.features || []).map(f => `<li><i class="fas fa-check-circle"></i> ${escapeHTML(f)}</li>`).join('');
    }

    if (addBtn) {
      addBtn.onclick = () => {
        this.cartManager.addItem(p.id, 1);
        modal.classList.remove('show');
      };
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  private async loadReviews() {
    const container = document.getElementById('revGrid');
    if (!container) return;

    try {
      const res = await apiFetch('/api/reviews');
      const reviews = res.reviews || [];

      container.innerHTML = reviews.map((r: any) => `
        <div class="rev" style="padding:22px;border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid var(--line)">
          <div style="color:var(--sec);letter-spacing:2px;margin-bottom:10px">${'★'.repeat(r.stars)}</div>
          <p style="color:var(--mut);font-size:0.92rem;font-style:italic;margin-bottom:14px">"${escapeHTML(r.text)}"</p>
          <div style="display:flex;gap:12px;align-items:center">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--sec));display:grid;place-items:center;font-weight:800;color:#1a1221">
              ${escapeHTML(r.name.charAt(0))}
            </div>
            <div>
              <b>${escapeHTML(r.name)}</b><br>
              <span style="font-size:0.78rem;color:var(--mut)">${r.date || 'Cliente verificado'}</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  private bindGlobalEvents() {
    // Carrito drawer
    document.getElementById('cartBtn')?.addEventListener('click', () => this.cartManager.openDrawer());
    document.getElementById('cartClose')?.addEventListener('click', () => this.cartManager.closeDrawer());
    document.getElementById('cartOverlay')?.addEventListener('click', () => this.cartManager.closeDrawer());

    // Cupón en carrito
    document.getElementById('applyCoupon')?.addEventListener('click', () => {
      const inp = document.getElementById('couponInput') as HTMLInputElement;
      if (inp) this.cartManager.applyCouponCode(inp.value);
    });

    // Checkout en carrito
    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      this.cartManager.handleCheckout();
    });

    // Modal quickview cerrar
    document.getElementById('modalClose')?.addEventListener('click', () => {
      document.getElementById('quickViewModal')?.classList.remove('show');
      document.body.style.overflow = '';
    });

    // Publicar nueva reseña
    document.getElementById('addRevBtn')?.addEventListener('click', async () => {
      const name = prompt('Tu nombre completo:');
      if (!name) return;
      const text = prompt('Escribe tu opinión o reseña:');
      if (!text) return;

      try {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ name, text, stars: 5 })
        });
        showToast('¡Gracias por tu reseña! Ya quedó registrada.', 'success');
        triggerConfetti();
        this.loadReviews();
      } catch (err: any) {
        showToast(err.message || 'Error al enviar reseña', 'error');
      }
    });

    // Banner oferta cerrar
    document.getElementById('topClose')?.addEventListener('click', () => {
      const topbar = document.getElementById('topbar');
      const nav = document.getElementById('nav');
      if (topbar) topbar.style.display = 'none';
      if (nav) nav.style.top = '0';
    });

    // Scroll nav
    window.addEventListener('scroll', () => {
      document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 30);
    });
  }
}

function normalizeCat(cat: string) {
  return (cat || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  new StoreApp();
});
