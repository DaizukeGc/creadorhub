// Portal de administración de JY Velas y Jabones.
// Pensado para que la mamá lo use desde el celular: subir fotos, crear y
// editar productos, ver pedidos, cupones y reseñas.
import { apiFetch, showToast, formatMoney, escapeHTML } from './api/client';
import { compressImage, formatBytes } from './modules/imageTools';

type PanelId =
  | 'panel-dashboard'
  | 'panel-products'
  | 'panel-media'
  | 'panel-orders'
  | 'panel-coupons'
  | 'panel-reviews'
  | 'panel-help'
  | 'panel-account';

interface AdminProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  old_price?: number | null;
  stock: number;
  description: string;
  image?: string | null;
  features?: string[];
  badge?: string | null;
  badge_type?: string | null;
  keywords?: string | null;
  is_active: number;
  is_available?: number;
  display_order?: number;
  sold?: number;
  rating?: number;
}

type ProductFilter = 'todos' | 'visibles' | 'agotados' | 'ocultos';

class AdminPortal {
  private currentPanel: PanelId = 'panel-dashboard';
  private editingId: number | null = null;
  private products: AdminProduct[] = [];
  private productFilter: ProductFilter = 'todos';
  private productSearch = '';

  constructor() {
    this.init();
  }

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  private async init() {
    (document.getElementById('adminLoginForm') as HTMLFormElement)?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => this.handleLogout());

    document.querySelectorAll<HTMLElement>('.portal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const panel = tab.dataset.panel as PanelId;
        if (panel) this.showPanel(panel);
      });
    });

    document.querySelectorAll<HTMLElement>('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.go as PanelId;
        if (panel) this.showPanel(panel);
      });
    });

    this.initProductForm();
    this.initProductFilters();
    this.initMediaForm();
    this.initCouponForm();
    this.initChangePassword();
    this.initHelpPanel();
    this.initProductPreview();

    // Sesión ya activa
    try {
      const session = await apiFetch('/api/auth/me');
      if (session?.authenticated && session.user?.role === 'admin') {
        this.showDashboard(session.user);
      }
    } catch {
      /* sin sesión: se muestra el login */
    }
  }

  private showPanel(panel: PanelId) {
    this.currentPanel = panel;
    document.querySelectorAll<HTMLElement>('.portal-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.panel === panel);
    });
    document.querySelectorAll<HTMLElement>('.panel').forEach((p) => {
      p.classList.toggle('active', p.id === panel);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (panel === 'panel-dashboard') this.loadDashboard();
    if (panel === 'panel-products') this.loadProducts();
    if (panel === 'panel-media') this.loadMedia();
    if (panel === 'panel-orders') this.loadOrders();
    if (panel === 'panel-coupons') this.loadCoupons();
    if (panel === 'panel-reviews') this.loadReviews();
  }

  // ------------------------------------------------------------------
  // Sesión
  // ------------------------------------------------------------------
  private async handleLogin() {
    const userInp = document.getElementById('adminUsername') as HTMLInputElement;
    const passInp = document.getElementById('adminPassword') as HTMLInputElement;
    const btn = document.getElementById('adminSubmitBtn') as HTMLButtonElement;

    const username = userInp?.value.trim().toLowerCase();
    const password = passInp?.value;

    if (!username || !password) {
      showToast('Ingresa usuario y contraseña', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.success) {
        showToast(`¡Bienvenida ${res.user.name}!`, 'success');
        this.showDashboard(res.user);
      }
    } catch (err: any) {
      showToast(err.message || 'Usuario o contraseña incorrectos', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-key"></i> Entrar al Panel';
    }
  }

  private async handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* se cierra igual */
    }
    location.reload();
  }

  private showDashboard(user: any) {
    const loginScreen = document.getElementById('adminLoginScreen');
    const wrap = document.getElementById('adminDashboardWrap');
    if (loginScreen) loginScreen.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';

    const name = user?.name || 'Mamá';
    const badge = document.getElementById('adminUserName');
    const greet = document.getElementById('greetName');
    if (badge) badge.textContent = name;
    if (greet) greet.textContent = name.split(' ')[0];

    const info = document.getElementById('accountInfo');
    if (info) {
      info.textContent = `Usuario: ${user?.username || '—'} · Rol: ${user?.role || '—'}`;
    }

    this.loadDashboard();
  }

  // ------------------------------------------------------------------
  // Resumen
  // ------------------------------------------------------------------
  private async loadDashboard() {
    try {
      const [prodsRes, ordersRes, mediaRes] = await Promise.all([
        apiFetch('/api/products/admin/all'),
        apiFetch('/api/orders/admin/list'),
        apiFetch('/api/media/admin/list'),
      ]);

      const products = prodsRes.products || [];
      const orders = ordersRes.orders || [];
      const media = mediaRes.media || mediaRes.media || [];

      const totalSales = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      const visible = products.filter((p: AdminProduct) => p.is_active);

      const set = (id: string, value: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      set('metricSales', formatMoney(totalSales));
      set('metricOrders', String(orders.length));
      set('metricProducts', String(visible.length));
      set('metricMedia', String((media as any[]).length));
    } catch (e) {
      console.error(e);
    }
  }

  // ------------------------------------------------------------------
  // Productos
  // ------------------------------------------------------------------
  private initProductForm() {
    const form = document.getElementById('prodForm') as HTMLFormElement;
    const toggle = document.getElementById('btnToggleProdForm');
    const cancel = document.getElementById('btnCancelProd');
    const cancel2 = document.getElementById('btnCancelProd2');

    toggle?.addEventListener('click', () => {
      this.resetProductForm();
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      if (form.style.display === 'block') {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    const closeForm = () => {
      form.style.display = 'none';
      if (cancel) cancel.style.display = 'none';
      this.resetProductForm();
    };
    cancel?.addEventListener('click', closeForm);
    cancel2?.addEventListener('click', closeForm);

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveProduct();
    });

    // Dropzone + compresión
    const dropzone = document.getElementById('dropzonePhoto');
    const fileInput = document.getElementById('prodFileInput') as HTMLInputElement;
    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) await this.handleProductPhoto(file, dropzone, fileInput);
    });

    // Arrastrar y soltar la foto del producto
    if (dropzone) {
      ['dragenter', 'dragover'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('drag');
        })
      );
      ['dragleave', 'drop'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('drag');
        })
      );
      dropzone.addEventListener('drop', async (e: any) => {
        const dropped: File[] = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
        const file = dropped.find((f) => f.type.startsWith('image/'));
        if (!file) {
          showToast('Solo se pueden subir imágenes', 'error');
          return;
        }
        await this.handleProductPhoto(file, dropzone, fileInput);
      });
    }

    // IA para redactar
    document.getElementById('btnAiSuggest')?.addEventListener('click', async () => {
      const name = (document.getElementById('pName') as HTMLInputElement | null)?.value ?? '';
      const category =
        (document.getElementById('pCategory') as HTMLSelectElement | null)?.value ?? 'Jabones';
          try {
            showToast('Generando descripción con IA...', 'info');
            const res = await apiFetch('/api/ai/admin/suggest', {
              method: 'POST',
              body: JSON.stringify({ category, aroma: name || 'lavanda' }),
            });
        if (res.success && res.suggestion) {
          const desc = document.getElementById('pDesc') as HTMLTextAreaElement;
          const price = document.getElementById('pPrice') as HTMLInputElement;
          if (desc && !desc.value) desc.value = res.suggestion.description;
          if (price && !price.value) price.value = res.suggestion.price;
          showToast('Sugerencia aplicada', 'success');
        }
      } catch {
        showToast('No se pudo conectar con la IA', 'error');
      }
    });
  }

  private resetProductForm() {
    this.editingId = null;
    const form = document.getElementById('prodForm') as HTMLFormElement;
    form?.reset();
    const idInput = document.getElementById('pId') as HTMLInputElement;
    if (idInput) idInput.value = '';
    const title = document.getElementById('prodFormTitle');
    if (title) title.textContent = 'Agregar producto';
    const btn = document.getElementById('btnSaveProd');
    if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    const preview = document.getElementById('uploadPreview') as HTMLImageElement;
    if (preview) {
      preview.style.display = 'none';
      preview.removeAttribute('src');
    }
    const imgUrl = document.getElementById('pImageUrl') as HTMLInputElement;
    if (imgUrl) imgUrl.value = '';
    const cancel = document.getElementById('btnCancelProd');
    if (cancel) cancel.style.display = 'none';
  }

  private async handleProductPhoto(file: File, dropzone?: HTMLElement | null, fileInput?: HTMLInputElement | null) {
    const preview = document.getElementById('uploadPreview') as HTMLImageElement;
    const imgUrl = document.getElementById('pImageUrl') as HTMLInputElement;
    const hint = document.getElementById('uploadHint');
    const text = document.getElementById('dropzoneText');

    dropzone?.classList.add('busy');
    if (text) text.textContent = 'Optimizando la foto...';

    try {
      const fit = this.getPhotoFit();
      const result = await compressImage(file, {
        maxBytes: 1_400_000,
        fit,
        aspectRatio: 1,
        background: this.getPhotoBackground()
      });

      if (preview) {
        preview.src = result.dataUrl;
        preview.style.display = 'block';
        preview.classList.toggle('is-contain', fit === 'contain');
      }

      const res = await apiFetch('/api/media/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ data: result.dataUrl }),
      });

      if (res.success && res.url && imgUrl) {
        imgUrl.value = res.url;
        if (hint) {
          hint.textContent = `Foto lista: ${formatBytes(result.bytes)} (optimizada desde ${formatBytes(result.originalBytes)}).`;
        }
        if (text) text.textContent = 'Cambiar foto';
        showToast('¡Foto subida! Ya puedes guardar el producto.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'No se pudo subir la foto', 'error');
      if (text) text.textContent = 'Toca para subir una foto de tu celular';
    } finally {
      dropzone?.classList.remove('busy');
      if (fileInput) fileInput.value = '';
    }
  }

  /** Modo de ajuste elegido por la mamá para las fotos. */
  private getPhotoFit(): 'cover' | 'contain' {
    const select = document.getElementById('pPhotoFit') as HTMLSelectElement | null;
    return select?.value === 'contain' ? 'contain' : 'cover';
  }

  /** Color de fondo elegido para las fotos que no se recortan. */
  private getPhotoBackground(): string {
    const select = document.getElementById('pPhotoBg') as HTMLSelectElement | null;
    const value = select?.value || 'blanco';
    const map: Record<string, string> = {
      blanco: '#ffffff',
      crema: '#faf3e8',
      rosado: '#fdeef4',
      lavanda: '#f3eeff'
    };
    return map[value] || '#ffffff';
  }

  private async saveProduct() {
    const get = (id: string) => document.getElementById(id) as HTMLInputElement;
    const features = get('pFeatures').value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const agotado = (document.getElementById('pAgotado') as HTMLInputElement | null)?.checked;

    const payload: Record<string, unknown> = {
      name: get('pName').value.trim(),
      category: get('pCategory').value,
      price: Number(get('pPrice').value) || 0,
      old_price: get('pOldPrice').value ? Number(get('pOldPrice').value) : null,
      stock: Number(get('pStock').value) || 0,
      description: get('pDesc').value.trim(),
      badge: get('pBadge').value.trim() || null,
      badge_type: get('pBadgeType').value || 'new',
      keywords: get('pKeywords').value.trim() || null,
      features,
      is_available: agotado ? 0 : 1
    };

    const imgUrl = get('pImageUrl').value;
    if (imgUrl) payload.image = imgUrl;

    const btn = document.getElementById('btnSaveProd') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
      if (this.editingId) {
        await apiFetch(`/api/products/admin/${this.editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Producto actualizado', 'success');
      } else {
        await apiFetch('/api/products/admin/create', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('¡Producto guardado y visible en la tienda!', 'success');
      }

      const form = document.getElementById('prodForm') as HTMLFormElement;
      if (form) form.style.display = 'none';
      this.resetProductForm();
      await this.loadProducts();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar el producto', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
  }

  // ------------------------------------------------------------------
  // Filtros y búsqueda del catálogo
  // ------------------------------------------------------------------
  private initProductFilters() {
    document.querySelectorAll<HTMLElement>('[data-prod-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = (btn.dataset.prodFilter || 'todos') as ProductFilter;
        this.productFilter = value;
        document.querySelectorAll<HTMLElement>('[data-prod-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.prodFilter === value);
        });
        this.renderProductList();
      });
    });

    const search = document.getElementById('prodSearch') as HTMLInputElement;
    search?.addEventListener('input', () => {
      this.productSearch = search.value;
      this.renderProductList();
    });
  }

  private initProductPreview() {
    const modal = document.getElementById('productPreviewModal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'productPreviewModal' || target.closest('#pvClose')) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  }

  // ------------------------------------------------------------------
  // Panel de ayuda
  // ------------------------------------------------------------------
  private initHelpPanel() {
    document.querySelectorAll<HTMLElement>('[data-help-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const topic = btn.dataset.helpTopic || '';
        document.querySelectorAll<HTMLElement>('[data-help-topic]').forEach((b) => {
          b.classList.toggle('active', b.dataset.helpTopic === topic);
        });
        document.querySelectorAll<HTMLElement>('[data-help-body]').forEach((panel) => {
          panel.classList.toggle('active', panel.dataset.helpBody === topic);
        });
      });
    });

    // Mostrar siempre el primer tema
    const first = document.querySelector<HTMLElement>('[data-help-topic]');
    if (first) first.click();
  }

  private async loadProducts() {
    const container = document.getElementById('adminProductsList');
    if (!container) return;
    container.innerHTML = '<p class="hint">Cargando productos...</p>';

    try {
      const res = await apiFetch('/api/products/admin/all');
      this.products = (res.products || []) as AdminProduct[];
      this.renderProductList();
    } catch (e) {
      container.innerHTML = '<p class="hint" style="color:var(--err)">Error al cargar los productos</p>';
    }
  }

  /** Aplica el filtro y el buscador activo al listado de productos. */
  private getFilteredProducts(): AdminProduct[] {
    const q = (this.productSearch || '').trim().toLowerCase();
    return this.products.filter((p) => {
      const agotado = p.is_available === 0;

      if (this.productFilter === 'visibles' && !p.is_active) return false;
      if (this.productFilter === 'ocultos' && p.is_active) return false;
      if (this.productFilter === 'agotados' && !agotado) return false;

      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.keywords || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    });
  }

  private renderProductList() {
    const container = document.getElementById('adminProductsList');
    if (!container) return;

    const list = this.getFilteredProducts();

    const counters = {
      total: this.products.length,
      agotados: this.products.filter((p) => p.is_available === 0).length,
      sinStock: this.products.filter((p) => (p.stock || 0) <= 0).length,
      ocultos: this.products.filter((p) => !p.is_active).length
    };

    const countEl = document.getElementById('prodCount');
    if (countEl) countEl.textContent = String(list.length);

    const outEl = document.getElementById('prodStats');
    if (outEl) {
      outEl.innerHTML = `
        <span class="chip">📦 ${counters.total} productos</span>
        <span class="chip chip-warn">🚫 ${counters.agotados} agotados</span>
        <span class="chip chip-danger">📉 ${counters.sinStock} sin stock</span>
        <span class="chip chip-muted">🙈 ${counters.ocultos} ocultos</span>
      `;
    }

    if (this.products.length === 0) {
      container.innerHTML =
        '<p class="hint">Todavía no hay productos. Crea el primero con el botón "Nuevo".</p>';
      return;
    }

    if (list.length === 0) {
      container.innerHTML =
        '<p class="hint">No hay productos que coincidan con el filtro o la búsqueda. <a href="#" id="clearProdFilters">Limpiar filtros</a></p>';
      container.querySelector('#clearProdFilters')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.productFilter = 'todos';
        this.productSearch = '';
        const search = document.getElementById('prodSearch') as HTMLInputElement;
        if (search) search.value = '';
        this.renderProductList();
      });
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const img = p.image || '/assets/jy/coleccion-artesanal.svg';
        const agotado = p.is_available === 0;
        const sinStock = (p.stock || 0) <= 0;

        let estado = '';
        if (!p.is_active) estado = '<small class="estado-txt estado-off">OCULTO DE LA TIENDA</small>';
        else if (agotado) estado = '<small class="estado-txt estado-agotado">AGOTADO</small>';
        else if (sinStock) estado = '<small class="estado-txt estado-sinstock">SIN STOCK</small>';
        else estado = '<small class="estado-txt estado-ok">DISPONIBLE</small>';

        return `
          <div class="prod-row ${agotado ? 'is-out' : ''} ${!p.is_active ? 'is-off' : ''}">
            <img src="${escapeHTML(img)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='/assets/jy/coleccion-artesanal.svg'">
            <div class="info">
              <b>${escapeHTML(p.name)}</b>
              <small>${escapeHTML(p.category)} · ${formatMoney(p.price)} · ${p.stock} und.</small>
              ${estado}
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit-prod="${p.id}" title="Editar"><i class="fas fa-pen"></i></button>
              <button class="btn btn-secondary btn-sm" data-dup-prod="${p.id}" title="Duplicar"><i class="fas fa-copy"></i></button>
              <button class="btn btn-ghost btn-sm" data-view-prod="${p.id}" title="Ver en la tienda"><i class="fas fa-eye"></i></button>
              <button class="btn ${agotado ? 'btn-primary' : 'btn-ghost'} btn-sm" data-toggle-avail="${p.id}"
                title="${agotado ? 'Marcar como disponible (vuelve a la tienda)' : 'Marcar como agotado'}">
                <i class="fas ${agotado ? 'fa-box-open' : 'fa-ban'}"></i>
              </button>
              <button class="btn btn-ghost btn-sm" data-stock-prod="${p.id}" title="Cambiar stock"><i class="fas fa-boxes-stacked"></i></button>
              ${
                p.is_active
                  ? `<button class="btn btn-danger btn-sm" data-hide-prod="${p.id}" title="Ocultar de la tienda"><i class="fas fa-eye-slash"></i></button>`
                  : `<button class="btn btn-secondary btn-sm" data-show-prod="${p.id}" title="Mostrar en la tienda"><i class="fas fa-eye"></i></button>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll<HTMLElement>('[data-edit-prod]').forEach((btn) => {
      btn.addEventListener('click', () => this.editProduct(Number(btn.dataset.editProd)));
    });

    container.querySelectorAll<HTMLElement>('[data-dup-prod]').forEach((btn) => {
      btn.addEventListener('click', () => this.duplicateProduct(Number(btn.dataset.dupProd)));
    });

    container.querySelectorAll<HTMLElement>('[data-view-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = this.products.find((x) => x.id === Number(btn.dataset.viewProd));
        if (p) this.openProductPreview(p);
      });
    });

    container.querySelectorAll<HTMLElement>('[data-toggle-avail]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleAvailability(Number(btn.dataset.toggleAvail)));
    });

    container.querySelectorAll<HTMLElement>('[data-stock-prod]').forEach((btn) => {
      btn.addEventListener('click', () => this.quickStock(Number(btn.dataset.stockProd)));
    });

    container.querySelectorAll<HTMLElement>('[data-hide-prod]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Ocultar este producto de la tienda?')) return;
        await apiFetch(`/api/products/admin/${btn.dataset.hideProd}`, { method: 'DELETE' });
        showToast('Producto oculto de la tienda', 'info');
        this.loadProducts();
      });
    });

    container.querySelectorAll<HTMLElement>('[data-show-prod]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await apiFetch(`/api/products/admin/${btn.dataset.showProd}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: 1 }),
        });
        showToast('Producto visible otra vez', 'success');
        this.loadProducts();
      });
    });
  }

  /** Marca el producto como agotado o disponible otra vez. */
  private async toggleAvailability(id: number) {
    const p = this.products.find((x) => x.id === id);
    if (!p) return;

    const ahoraAgotado = p.is_available !== 0;

    if (!ahoraAgotado) {
      // Al reponer stock solo se vuelve a habilitar: no se toca ningún otro campo.
      await apiFetch(`/api/products/admin/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_available: 1 }),
      });
      showToast(`"${p.name}" volvió a estar disponible`, 'success');
    } else {
      await apiFetch(`/api/products/admin/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_available: 0 }),
      });
      showToast(`"${p.name}" marcado como AGOTADO`, 'info');
    }

    await this.loadProducts();
    this.loadDashboard();
  }

  /** Cambio rápido de unidades desde el listado. */
  private async quickStock(id: number) {
    const p = this.products.find((x) => x.id === id);
    if (!p) return;

    const actual = p.stock || 0;
    const entrada = prompt(
      `¿Cuántas unidades quedan de "${p.name}"?\n\nTienes ${actual} ahora. Escribe el número nuevo (0 = agotado):`,
      String(actual)
    );
    if (entrada === null) return;

    const nuevo = Number(entrada);
    if (!Number.isFinite(nuevo) || nuevo < 0) {
      showToast('Escribe un número válido (0 o más)', 'error');
      return;
    }

    const updates: Record<string, unknown> = { stock: Math.round(nuevo) };
    // Si no quedan unidades, se marca agotado automáticamente.
    if (nuevo === 0) updates.is_available = 0;
    else if (p.is_available === 0) updates.is_available = 1;

    await apiFetch(`/api/products/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    showToast(
      nuevo === 0
        ? `"${p.name}" quedó sin unidades y aparece como AGOTADO`
        : `Stock de "${p.name}" actualizado a ${nuevo}`,
      'success'
    );

    await this.loadProducts();
    this.loadDashboard();
  }

  /** Crea una copia editable de un producto. */
  private async duplicateProduct(id: number) {
    const p = this.products.find((x) => x.id === id);
    if (!p) return;

    if (!confirm(`¿Crear una copia de "${p.name}"? La copia aparecerá en la tienda.`)) return;

    try {
      const res = await apiFetch('/api/products/admin/create', {
        method: 'POST',
        body: JSON.stringify({
          name: `${p.name} (copia)`,
          category: p.category,
          price: p.price,
          old_price: p.old_price ?? null,
          stock: p.stock ?? 10,
          description: p.description,
          badge: p.badge ?? null,
          badge_type: p.badge_type ?? 'new',
          keywords: p.keywords ?? '',
          features: p.features || [],
          image: p.image ?? null
        }),
      });

      showToast('¡Copia creada! Ya puedes editarla.', 'success');
      await this.loadProducts();
      if (res?.id) this.editProduct(Number(res.id));
    } catch (err: any) {
      showToast(err.message || 'No se pudo duplicar el producto', 'error');
    }
  }

  /** Vista previa ampliada del producto tal como lo verá el cliente. */
  private openProductPreview(p: AdminProduct) {
    const agotado = p.is_available === 0;
    const modal = document.getElementById('productPreviewModal');
    if (!modal) return;

    const img = modal.querySelector('.pv-image') as HTMLImageElement | null;
    const name = modal.querySelector('.pv-name');
    const cat = modal.querySelector('.pv-cat');
    const price = modal.querySelector('.pv-price');
    const desc = modal.querySelector('.pv-desc');
    const feats = modal.querySelector('.pv-feats');
    const state = modal.querySelector('.pv-state');

    if (img) {
      img.src = p.image || '/assets/jy/coleccion-artesanal.svg';
      img.onerror = () => {
        if (img) img.src = '/assets/jy/coleccion-artesanal.svg';
      };
    }
    if (name) name.textContent = p.name;
    if (cat) cat.textContent = p.category;
    if (price) {
      price.innerHTML = `${formatMoney(p.price)}${
        p.old_price ? ` <span class="product-old">${formatMoney(p.old_price)}</span>` : ''
      }`;
    }
    if (desc) desc.textContent = p.description || 'Sin descripción.';
    if (feats) {
      feats.innerHTML = (p.features || [])
        .map((f) => `<li><i class="fas fa-check-circle"></i> ${escapeHTML(f)}</li>`)
        .join('');
    }
    if (state) {
      state.className = `pv-state ${agotado ? 'pv-out' : 'pv-ok'}`;
      state.innerHTML = agotado
        ? '<i class="fas fa-ban"></i> Agotado — los clientes lo ven marcado y no pueden comprarlo'
        : '<i class="fas fa-check-circle"></i> Disponible — los clientes sí pueden comprarlo';
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  private editProduct(id: number) {
    const p = this.products.find((x) => x.id === id);
    if (!p) return;

    this.editingId = id;
    const set = (elId: string, value: string) => {
      const el = document.getElementById(elId) as HTMLInputElement;
      if (el) el.value = value;
    };

    set('pId', String(p.id));
    set('pName', p.name || '');
    set('pCategory', p.category || 'Jabones');
    set('pPrice', String(p.price ?? ''));
    set('pOldPrice', p.old_price ? String(p.old_price) : '');
    set('pStock', String(p.stock ?? ''));
    set('pDesc', p.description || '');
    set('pBadge', p.badge || '');
    set('pBadgeType', p.badge_type || 'new');
    set('pKeywords', p.keywords || '');
    set('pFeatures', (p.features || []).join('\n'));
    set('pImageUrl', p.image || '');

    const agotadoCheck = document.getElementById('pAgotado') as HTMLInputElement | null;
    if (agotadoCheck) agotadoCheck.checked = p.is_available === 0;

    const preview = document.getElementById('uploadPreview') as HTMLImageElement;
    if (preview && p.image) {
      preview.src = p.image;
      preview.style.display = 'block';
    }
    const text = document.getElementById('dropzoneText');
    if (text) text.textContent = 'Cambiar foto';

    const title = document.getElementById('prodFormTitle');
    if (title) title.textContent = `Editando: ${p.name}`;
    const btn = document.getElementById('btnSaveProd');
    if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
    const cancel = document.getElementById('btnCancelProd');
    if (cancel) cancel.style.display = 'inline-flex';

    const form = document.getElementById('prodForm') as HTMLFormElement;
    if (form) {
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ------------------------------------------------------------------
  // Medios (fotos)
  // ------------------------------------------------------------------
  private initMediaForm() {
    const dropzone = document.getElementById('dropzoneMedia');
    const input = document.getElementById('mediaFileInput') as HTMLInputElement;
    dropzone?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      for (const file of files) {
        await this.uploadMediaFile(file);
      }
      input.value = '';
      this.loadMedia();
    });

    // Arrastrar y soltar fotos directamente sobre el recuadro
    if (dropzone) {
      ['dragenter', 'dragover'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('drag');
        })
      );
      ['dragleave', 'drop'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('drag');
        })
      );
      dropzone.addEventListener('drop', async (e: any) => {
        const dropped: File[] = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
        const files = dropped.filter((f) => f.type.startsWith('image/'));
        if (!files.length) {
          showToast('Solo se pueden subir imágenes', 'error');
          return;
        }
        for (const file of files) {
          await this.uploadMediaFile(file);
        }
        this.loadMedia();
      });
    }
  }

  private async uploadMediaFile(file: File) {
    const status = document.getElementById('mediaUploadStatus');
    if (status) {
      status.innerHTML = `<p class="hint"><i class="fas fa-spinner fa-spin"></i> Subiendo ${escapeHTML(file.name)}...</p>`;
    }

    try {
      const result = await compressImage(file, {
        maxBytes: 1_400_000,
        fit: 'cover',
        aspectRatio: 1
      });
      const res = await apiFetch('/api/media/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ data: result.dataUrl }),
      });
      if (res.success) {
        showToast(`Foto subida (${formatBytes(result.bytes)})`, 'success');
        if (status) {
          status.innerHTML = `<p class="hint" style="color:var(--ok)"><i class="fas fa-check-circle"></i> ${escapeHTML(file.name)} lista. Copia su URL para usarla en un producto.</p>`;
        }
      }
    } catch (err: any) {
      showToast(err.message || `No se pudo subir ${file.name}`, 'error');
      if (status) {
        status.innerHTML = `<p class="hint" style="color:var(--err)">Error al subir ${escapeHTML(file.name)}</p>`;
      }
    }
  }

  private async loadMedia() {
    const grid = document.getElementById('adminMediaGrid');
    if (!grid) return;
    grid.innerHTML = '<p class="hint">Cargando fotos...</p>';

    try {
      const res = await apiFetch('/api/media/admin/list');
      const media = (res.media || res.items || []) as any[];
      const countEl = document.getElementById('mediaCount');
      if (countEl) countEl.textContent = String(media.length);

      if (media.length === 0) {
        grid.innerHTML = '<p class="hint">Todavía no has subido fotos.</p>';
        return;
      }

      grid.innerHTML = media
        .map((m) => {
          const key = m.key || m.id;
          const url = m.url || `/media/${key}`;
          return `
            <div class="media-item">
              <img src="${escapeHTML(url)}" alt="Foto" loading="lazy">
              <div class="meta">${escapeHTML(key)}<br>${formatBytes(Number(m.size || 0))}</div>
              <div class="actions">
                <button class="btn btn-ghost btn-sm" data-copy-media="${escapeHTML(url)}"><i class="fas fa-copy"></i></button>
                <button class="btn btn-danger btn-sm" data-del-media="${escapeHTML(key)}"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `;
        })
        .join('');

      grid.querySelectorAll<HTMLElement>('[data-copy-media]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const url = btn.dataset.copyMedia || '';
          try {
            await navigator.clipboard.writeText(url);
            showToast('URL copiada', 'success');
          } catch {
            showToast(url, 'info');
          }
        });
      });

      grid.querySelectorAll<HTMLElement>('[data-del-media]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Borrar esta foto? Los productos que la usan quedarán sin imagen.')) return;
          await apiFetch(`/api/media/admin/${btn.dataset.delMedia}`, { method: 'DELETE' });
          showToast('Foto borrada', 'info');
          this.loadMedia();
        });
      });
    } catch {
      grid.innerHTML = '<p class="hint" style="color:var(--err)">Error al cargar las fotos</p>';
    }
  }

  // ------------------------------------------------------------------
  // Pedidos
  // ------------------------------------------------------------------
  private async loadOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;
    container.innerHTML = '<p class="hint">Cargando pedidos...</p>';

    try {
      const res = await apiFetch('/api/orders/admin/list');
      const orders = (res.orders || []) as any[];

      if (orders.length === 0) {
        container.innerHTML =
          '<p class="hint"><i class="fas fa-receipt"></i> No hay pedidos registrados todavía. Cuando alguien compre desde la tienda, aparecerá aquí.</p>';
        return;
      }

      container.innerHTML = orders
        .map((o) => {
          const cleanPhone = String(o.customer_phone || '').replace(/\D/g, '');
          const waText = encodeURIComponent(
            `Hola ${o.customer_name}, te escribo de JY Velas y Jabones sobre tu pedido #${o.id}.`
          );
          const waLink = `https://wa.me/57${cleanPhone.replace(/^57/, '')}?text=${waText}`;

          return `
            <div class="order-card">
              <div class="order-header">
                <div>
                  <b style="font-size:1.1rem;color:var(--sec)">#${escapeHTML(o.id)}</b>
                  <span style="color:var(--mut);font-size:0.8rem;margin-left:8px">${new Date(o.created_at).toLocaleString('es-CO')}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <select class="admin-field" style="padding:6px 12px;border-radius:10px;margin:0" data-order-status="${escapeHTML(o.id)}">
                    ${['pendiente', 'en preparación', 'enviado', 'entregado']
                      .map(
                        (st) =>
                          `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st.toUpperCase()}</option>`
                      )
                      .join('')}
                  </select>
                  <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-sm" style="background:#25d366;color:#fff">
                    <i class="fab fa-whatsapp"></i> Chatear
                  </a>
                </div>
              </div>
              <div style="margin:10px 0;font-size:0.92rem;line-height:1.6">
                ${(o.items || [])
                  .map(
                    (it: any) =>
                      `• ${it.quantity}x ${escapeHTML(it.product_name)} (${formatMoney(it.total_price)})`
                  )
                  .join('<br>')}
              </div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px;margin-top:8px;font-size:0.86rem;color:var(--mut)">
                <div>
                  <b>Cliente:</b> ${escapeHTML(o.customer_name)} · <b>Tel:</b> ${escapeHTML(o.customer_phone)}<br>
                  <b>Ciudad:</b> ${escapeHTML(o.customer_city)} · <b>Dirección:</b> ${escapeHTML(o.customer_address)}
                  ${o.customer_notes ? `<br><i>Notas: ${escapeHTML(o.customer_notes)}</i>` : ''}
                </div>
                <div style="text-align:right">
                  <span style="font-size:1.2rem;font-weight:800;color:var(--sec)">${formatMoney(o.total)}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      container.querySelectorAll<HTMLElement>('[data-order-status]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const id = sel.dataset.orderStatus;
          const status = (sel as unknown as HTMLSelectElement).value;
          await apiFetch(`/api/orders/admin/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          });
          showToast(`Estado del pedido #${id} actualizado`, 'success');
        });
      });
    } catch {
      container.innerHTML = '<p class="hint" style="color:var(--err)">Error al cargar los pedidos</p>';
    }
  }

  // ------------------------------------------------------------------
  // Cupones
  // ------------------------------------------------------------------
  private initCouponForm() {
    document.getElementById('createCouponForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = (document.getElementById('newCouponCode') as HTMLInputElement).value
        .trim()
        .toUpperCase();
      const pct = Number((document.getElementById('newCouponPct') as HTMLInputElement).value);
      try {
        await apiFetch('/api/coupons/admin/create', {
          method: 'POST',
          body: JSON.stringify({ code, discount_pct: pct }),
        });
        showToast('Cupón creado', 'success');
        (document.getElementById('newCouponCode') as HTMLInputElement).value = '';
        (document.getElementById('newCouponPct') as HTMLInputElement).value = '';
        this.loadCoupons();
      } catch (err: any) {
        showToast(err.message || 'Error al crear el cupón', 'error');
      }
    });
  }

  private async loadCoupons() {
    const container = document.getElementById('adminCouponsList');
    if (!container) return;

    try {
      const res = await apiFetch('/api/coupons/admin/list');
      const coupons = (res.coupons || []) as any[];

      container.innerHTML = coupons
        .map(
          (c) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--line);flex-wrap:wrap">
              <div>
                <b style="font-size:1.05rem;color:var(--sec)">${escapeHTML(c.code)}</b>
                <span style="color:var(--mut);margin-left:8px">${c.discount_pct}% de descuento</span>
                <span class="${c.active ? 'badge-ok' : 'badge-off'}" style="margin-left:8px">
                  ${c.active ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-ghost btn-sm" data-toggle-coup="${c.id}">${
                  c.active ? 'Desactivar' : 'Activar'
                }</button>
                <button class="btn btn-danger btn-sm" data-del-coup="${c.id}"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `
        )
        .join('');

      container.querySelectorAll<HTMLElement>('[data-toggle-coup]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await apiFetch(`/api/coupons/admin/${btn.dataset.toggleCoup}/toggle`, { method: 'PATCH' });
          this.loadCoupons();
        });
      });
      container.querySelectorAll<HTMLElement>('[data-del-coup]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este cupón?')) return;
          await apiFetch(`/api/coupons/admin/${btn.dataset.delCoup}`, { method: 'DELETE' });
          this.loadCoupons();
        });
      });
    } catch {
      container.innerHTML = '<p class="hint" style="color:var(--err)">Error al cargar los cupones</p>';
    }
  }

  // ------------------------------------------------------------------
  // Reseñas
  // ------------------------------------------------------------------
  private async loadReviews() {
    const container = document.getElementById('adminReviewsList');
    if (!container) return;

    try {
      const res = await apiFetch('/api/reviews/admin/list');
      const reviews = (res.reviews || []) as any[];

      if (reviews.length === 0) {
        container.innerHTML = '<p class="hint">No hay reseñas todavía.</p>';
        return;
      }

      container.innerHTML = reviews
        .map(
          (r) => `
            <div class="order-card" style="${
              r.flagged_for_admin ? 'border-color:rgba(239,68,68,0.45);background:rgba(239,68,68,0.04)' : ''
            }">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px">
                <div>
                  <b>${escapeHTML(r.name)}</b> · <span style="color:var(--sec)">${'★'.repeat(r.stars || 0)}</span>
                  ${
                    r.flagged_for_admin
                      ? '<span class="badge-off" style="margin-left:8px">REVISAR</span>'
                      : ''
                  }
                </div>
                <button class="btn btn-danger btn-sm" data-del-rev="${escapeHTML(r.id)}"><i class="fas fa-trash"></i></button>
              </div>
              <p style="color:var(--mut);font-size:0.92rem;font-style:italic">"${escapeHTML(r.text)}"</p>
              <span style="font-size:0.78rem;color:var(--mut)">Fecha: ${escapeHTML(r.date || '')}</span>
            </div>
          `
        )
        .join('');

      container.querySelectorAll<HTMLElement>('[data-del-rev]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar esta reseña?')) return;
          await apiFetch(`/api/reviews/admin/${btn.dataset.delRev}`, { method: 'DELETE' });
          this.loadReviews();
        });
      });
    } catch {
      container.innerHTML = '<p class="hint" style="color:var(--err)">Error al cargar las reseñas</p>';
    }
  }

  // ------------------------------------------------------------------
  // Cambiar contraseña
  // ------------------------------------------------------------------
  private initChangePassword() {
    document.getElementById('changePassForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = (document.getElementById('cpCurrent') as HTMLInputElement).value;
      const next = (document.getElementById('cpNew') as HTMLInputElement).value;
      const confirm = (document.getElementById('cpConfirm') as HTMLInputElement).value;

      if (next.length < 8) {
        showToast('La nueva clave debe tener al menos 8 caracteres', 'error');
        return;
      }
      if (next !== confirm) {
        showToast('Las dos claves nuevas no coinciden', 'error');
        return;
      }

      try {
        await apiFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        showToast('¡Clave cambiada! Vuelve a entrar con la nueva.', 'success');
        (document.getElementById('changePassForm') as HTMLFormElement).reset();
        setTimeout(() => location.reload(), 1500);
      } catch (err: any) {
        showToast(err.message || 'No se pudo cambiar la clave', 'error');
      }
    });
  }
}

new AdminPortal();
