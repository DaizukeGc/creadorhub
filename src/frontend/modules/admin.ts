// Lógica del Portal Oculto y Privado para la Mamá
import { apiFetch, showToast, formatMoney, escapeHTML } from '../api/client';

export class AdminPortal {
  private activeTab: string = 'dashboard';

  constructor() {
    this.init();
  }

  private async init() {
    const loginForm = document.getElementById('adminLoginForm') as HTMLFormElement;
    loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Verificar si ya hay una sesión activa
    try {
      const session = await apiFetch('/api/auth/me');
      if (session && session.authenticated && session.user?.role === 'admin') {
        this.showDashboard(session.user);
      }
    } catch (e) {}

    // Configurar logout
    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
      this.handleLogout();
    });

    // Pestañas
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.adminTab || 'dashboard';
        this.switchTab(tab);
      });
    });
  }

  private async handleLogin() {
    const userInp = document.getElementById('adminUsername') as HTMLInputElement;
    const passInp = document.getElementById('adminPassword') as HTMLInputElement;
    const submitBtn = document.getElementById('adminSubmitBtn') as HTMLButtonElement;

    const username = userInp?.value.trim().toLowerCase();
    const password = passInp?.value;

    if (!username || !password) {
      showToast('Ingresa usuario y contraseña', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando credenciales...';

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (res.success) {
        showToast(`¡Bienvenida ${res.user.name}!`, 'success');
        this.showDashboard(res.user);
      }
    } catch (err: any) {
      showToast(err.message || 'Usuario o contraseña incorrectos', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-key"></i> Entrar al Panel';
    }
  }

  private async handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    location.reload();
  }

  private showDashboard(user: any) {
    const loginScreen = document.getElementById('adminLoginScreen');
    const dashboardWrap = document.getElementById('adminDashboardWrap');
    const userBadge = document.getElementById('adminUserName');

    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboardWrap) dashboardWrap.style.display = 'flex';
    if (userBadge) userBadge.textContent = user.name || 'Mamá';

    this.loadDashboardData();
  }

  private switchTab(tab: string) {
    this.activeTab = tab;
    document.querySelectorAll('[data-admin-tab]').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.adminTab === tab);
    });

    document.querySelectorAll('.admin-tab-content').forEach(c => {
      (c as HTMLElement).style.display = c.id === `tab-${tab}` ? 'block' : 'none';
    });

    if (tab === 'dashboard') this.loadDashboardData();
    if (tab === 'products') this.loadProducts();
    if (tab === 'orders') this.loadOrders();
    if (tab === 'coupons') this.loadCoupons();
    if (tab === 'reviews') this.loadReviews();
  }

  // 1. Métricas
  private async loadDashboardData() {
    try {
      const [prodsRes, ordersRes, reviewsRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/orders/admin/list'),
        apiFetch('/api/reviews/admin/list')
      ]);

      const products = prodsRes.products || [];
      const orders = ordersRes.orders || [];
      const reviews = reviewsRes.reviews || [];

      const totalSales = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter((o: any) => o.status === 'pendiente').length;

      const mProds = document.getElementById('metricProducts');
      const mOrders = document.getElementById('metricOrders');
      const mSales = document.getElementById('metricSales');
      const mPending = document.getElementById('metricPending');

      if (mProds) mProds.textContent = String(products.length);
      if (mOrders) mOrders.textContent = String(orders.length);
      if (mSales) mSales.textContent = formatMoney(totalSales);
      if (mPending) mPending.textContent = String(pendingOrders);
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Gestión de Productos
  private async loadProducts() {
    const container = document.getElementById('adminProductsTableBody');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</td></tr>';

    try {
      const res = await apiFetch('/api/products');
      const products = res.products || [];

      container.innerHTML = products.map((p: any) => `
        <tr>
          <td><img src="${p.image || 'https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=100&q=80'}" class="table-thumb" alt="${escapeHTML(p.name)}"></td>
          <td><b>${escapeHTML(p.name)}</b></td>
          <td><span style="background:rgba(217,70,239,0.15);color:var(--pril);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700">${escapeHTML(p.category)}</span></td>
          <td style="color:var(--sec);font-weight:700">${formatMoney(p.price)}</td>
          <td>${p.stock} unid.</td>
          <td style="text-align:right">
            <button class="btn btn-danger btn-sm" data-del-prod="${p.id}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');

      container.querySelectorAll('[data-del-prod]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('¿Estás segura de eliminar este producto?')) {
            const id = Number((btn as HTMLElement).dataset.delProd);
            await apiFetch(`/api/products/admin/${id}`, { method: 'DELETE' });
            showToast('Producto eliminado', 'info');
            this.loadProducts();
          }
        });
      });
    } catch (e) {
      container.innerHTML = '<tr><td colspan="6" style="color:var(--err);text-align:center">Error al cargar productos</td></tr>';
    }
  }

  // 3. Gestión de Pedidos con botón directo a WhatsApp
  private async loadOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin"></i> Cargando pedidos...</div>';

    try {
      const res = await apiFetch('/api/orders/admin/list');
      const orders = res.orders || [];

      if (orders.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--mut)"><i class="fas fa-receipt" style="font-size:2.5rem;margin-bottom:12px;display:block"></i>No tienes pedidos registrados todavía.</div>';
        return;
      }

      container.innerHTML = orders.map((o: any) => {
        const cleanPhone = String(o.customer_phone || '').replace(/\D/g, '');
        const waText = encodeURIComponent(`Hola ${o.customer_name}, te escribo de JY Velas y Jabones sobre tu pedido #${o.id}.`);
        const waLink = `https://wa.me/57${cleanPhone.replace(/^57/, '')}?text=${waText}`;

        return `
          <div class="order-card">
            <div class="order-header">
              <div>
                <b style="font-size:1.1rem;color:var(--sec)">#${escapeHTML(o.id)}</b>
                <span style="color:var(--mut);font-size:0.8rem;margin-left:8px">${new Date(o.created_at).toLocaleString('es-CO')}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <select class="admin-field" style="padding:6px 12px;border-radius:10px;margin:0" data-order-status="${o.id}">
                  ${['pendiente', 'en preparación', 'enviado', 'entregado'].map(st => `
                    <option value="${st}" ${o.status === st ? 'selected' : ''}>${st.toUpperCase()}</option>
                  `).join('')}
                </select>
                <a href="${waLink}" target="_blank" class="btn btn-sm" style="background:#25d366;color:#fff" title="Escribir por WhatsApp">
                  <i class="fab fa-whatsapp"></i> Chatear
                </a>
              </div>
            </div>
            <div style="margin:10px 0;font-size:0.92rem;line-height:1.6">
              ${(o.items || []).map((it: any) => `• ${it.quantity}x ${escapeHTML(it.product_name)} (${formatMoney(it.total_price)})`).join('<br>')}
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
      }).join('');

      container.querySelectorAll('[data-order-status]').forEach(sel => {
        sel.addEventListener('change', async () => {
          const id = (sel as HTMLElement).dataset.orderStatus;
          const status = (sel as unknown as HTMLSelectElement).value;
          await apiFetch(`/api/orders/admin/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          showToast(`Estado del pedido #${id} actualizado`, 'success');
        });
      });
    } catch (e) {
      container.innerHTML = '<div style="color:var(--err);text-align:center">Error al cargar pedidos</div>';
    }
  }

  // 4. Cupones
  private async loadCoupons() {
    const container = document.getElementById('adminCouponsList');
    if (!container) return;

    try {
      const res = await apiFetch('/api/coupons/admin/list');
      const coupons = res.coupons || [];

      container.innerHTML = coupons.map((c: any) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid var(--line)">
          <div>
            <b style="font-size:1.1rem;color:var(--sec)">${escapeHTML(c.code)}</b>
            <span style="color:var(--mut);margin-left:10px">${c.discount_pct}% de descuento</span>
            <span style="margin-left:8px;font-size:0.75rem;padding:3px 8px;border-radius:12px;background:${c.active ? 'rgba(16,185,129,0.2);color:#6ee7b7' : 'rgba(239,68,68,0.2);color:#fca5a5'}">
              ${c.active ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" data-toggle-coup="${c.id}">${c.active ? 'Desactivar' : 'Activar'}</button>
            <button class="btn btn-danger btn-sm" data-del-coup="${c.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('[data-toggle-coup]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.toggleCoup;
          await apiFetch(`/api/coupons/admin/${id}/toggle`, { method: 'PATCH' });
          this.loadCoupons();
        });
      });

      container.querySelectorAll('[data-del-coup]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.delCoup;
          await apiFetch(`/api/coupons/admin/${id}`, { method: 'DELETE' });
          this.loadCoupons();
        });
      });
    } catch (e) {
      container.innerHTML = 'Error al cargar cupones';
    }
  }

  // 5. Reseñas
  private async loadReviews() {
    const container = document.getElementById('adminReviewsList');
    if (!container) return;

    try {
      const res = await apiFetch('/api/reviews/admin/list');
      const reviews = res.reviews || [];

      container.innerHTML = reviews.map((r: any) => `
        <div class="order-card" style="${r.flagged_for_admin ? 'border-color:rgba(239,68,68,0.45);background:rgba(239,68,68,0.04)' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <b>${escapeHTML(r.name)}</b> · <span style="color:var(--sec)">${'★'.repeat(r.stars)}</span>
              ${r.flagged_for_admin ? '<span style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:3px 8px;border-radius:12px;font-size:0.75rem;margin-left:8px;font-weight:700">REVISAR (IA Negativa)</span>' : ''}
            </div>
            <button class="btn btn-danger btn-sm" data-del-rev="${r.id}"><i class="fas fa-trash"></i></button>
          </div>
          <p style="color:var(--mut);font-size:0.92rem;font-style:italic">"${escapeHTML(r.text)}"</p>
          <span style="font-size:0.78rem;color:var(--mut)">Fecha: ${r.date}</span>
        </div>
      `).join('');

      container.querySelectorAll('[data-del-rev]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.delRev;
          await apiFetch(`/api/reviews/admin/${id}`, { method: 'DELETE' });
          this.loadReviews();
        });
      });
    } catch (e) {
      container.innerHTML = 'Error al cargar reseñas';
    }
  }
}
