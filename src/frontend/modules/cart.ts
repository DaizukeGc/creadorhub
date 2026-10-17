// Gestión del Carrito y Checkout Seguro con Recálculo en Servidor
import { CartItem, Product } from '../types';
import { apiFetch, showToast, formatMoney } from '../api/client';
import { triggerConfetti, playSuccessSound } from './visualMagic';

const CART_STORAGE_KEY = 'jy_cart_items_v2';

export class CartManager {
  private items: CartItem[] = [];
  private products: Map<number, Product> = new Map();
  private appliedCoupon: { code: string; discountPct: number } | null = null;

  constructor() {
    this.loadCart();
  }

  public setCatalog(products: Product[]) {
    this.products.clear();
    products.forEach(p => this.products.set(p.id, p));
    this.render();
  }

  private loadCart() {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      this.items = stored ? JSON.parse(stored) : [];
      const savedCoupon = localStorage.getItem('jy_saved_coupon');
      if (savedCoupon) {
        this.appliedCoupon = { code: savedCoupon, discountPct: 10 };
      }
    } catch (e) {
      this.items = [];
    }
  }

  private saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
  }

  public addItem(productId: number, quantity: number = 1) {
    const existing = this.items.find(i => i.id === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({ id: productId, quantity });
    }
    this.saveCart();
    this.render();

    const product = this.products.get(productId);
    const prodName = product ? product.name : 'Producto';
    showToast(`${prodName} agregado al carrito`, 'success');
    playSuccessSound();
  }

  public removeItem(productId: number) {
    this.items = this.items.filter(i => i.id !== productId);
    this.saveCart();
    this.render();
  }

  public updateQty(productId: number, delta: number) {
    const item = this.items.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(productId);
    } else {
      this.saveCart();
      this.render();
    }
  }

  public async applyCouponCode(code: string) {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      showToast('Ingresa un código de cupón', 'error');
      return;
    }

    try {
      const res = await apiFetch('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: cleanCode })
      });

      if (res.valid) {
        this.appliedCoupon = {
          code: res.code,
          discountPct: res.discount_pct
        };
        localStorage.setItem('jy_saved_coupon', res.code);
        showToast(res.message, 'success');
        this.render();
      } else {
        showToast(res.message || 'Cupón inválido', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al validar cupón', 'error');
    }
  }

  public async handleCheckout() {
    if (this.items.length === 0) {
      showToast('Tu carrito está vacío. Agrega productos para continuar.', 'error');
      return;
    }

    const nameInput = document.getElementById('customerName') as HTMLInputElement;
    const phoneInput = document.getElementById('customerPhone') as HTMLInputElement;
    const cityInput = document.getElementById('customerCity') as HTMLInputElement;
    const addressInput = document.getElementById('customerAddress') as HTMLInputElement;
    const notesInput = document.getElementById('customerNotes') as HTMLTextAreaElement;

    const name = nameInput?.value.trim();
    const phone = phoneInput?.value.trim();
    const city = cityInput?.value.trim();
    const address = addressInput?.value.trim();
    const notes = notesInput?.value.trim();

    if (!name || !phone || !city || !address) {
      showToast('Por favor completa todos tus datos de entrega', 'error');
      return;
    }

    const checkoutBtn = document.getElementById('checkoutBtn') as HTMLButtonElement;
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando con el servidor...';
    }

    try {
      // El cliente solo envía IDs y cantidades. El backend recalcula el total exacto.
      const response = await apiFetch('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: this.items,
          customer: { name, phone, city, address, notes },
          couponCode: this.appliedCoupon ? this.appliedCoupon.code : undefined
        })
      });

      if (response.success && response.whatsappUrl) {
        triggerConfetti();
        playSuccessSound();
        showToast(`¡Pedido confirmado! Código: ${response.trackingCode}`, 'success');

        // Limpiar carrito tras éxito
        this.items = [];
        this.saveCart();
        this.render();

        // Cerrar drawer del carrito
        this.closeDrawer();

        // Abrir WhatsApp con el pedido verificado
        window.open(response.whatsappUrl, '_blank');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al procesar el pedido. Intenta nuevamente.', 'error');
    } finally {
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Pedir por WhatsApp';
      }
    }
  }

  public render() {
    const countEl = document.getElementById('cartCount');
    const container = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('cartSubtotal');
    const discountEl = document.getElementById('cartDiscount');
    const totalEl = document.getElementById('cartTotal');

    const totalCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    if (countEl) countEl.textContent = String(totalCount);

    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-shopping-bag"></i>
          <h4>Tu carrito está vacío</h4>
          <p>Explora nuestras velas y jabones artesanales</p>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = '$0';
      if (discountEl) discountEl.textContent = '$0';
      if (totalEl) totalEl.textContent = '$0';
      return;
    }

    let subtotal = 0;
    container.innerHTML = this.items.map(item => {
      const p = this.products.get(item.id);
      if (!p) return '';
      const lineTotal = p.price * item.quantity;
      subtotal += lineTotal;

      return `
        <div class="cart-item">
          <img src="${p.image || 'https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=150&q=80'}" alt="${p.name}">
          <div style="flex:1">
            <h4>${p.name}</h4>
            <div class="pr">${formatMoney(p.price)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            <button class="modal-close" style="position:static;width:28px;height:28px;font-size:0.8rem" data-remove="${p.id}">
              <i class="fas fa-trash"></i>
            </button>
            <div class="qbox">
              <button data-qty-minus="${p.id}">-</button>
              <span>${item.quantity}</span>
              <button data-qty-plus="${p.id}">+</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const discountAmount = this.appliedCoupon ? Math.round((subtotal * this.appliedCoupon.discountPct) / 100) : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (discountEl) discountEl.textContent = discountAmount > 0 ? `-${formatMoney(discountAmount)} (${this.appliedCoupon?.code})` : '$0';
    if (totalEl) totalEl.textContent = formatMoney(finalTotal);

    // Event listeners en items
    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.remove);
        this.removeItem(id);
      });
    });

    container.querySelectorAll('[data-qty-minus]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.qtyMinus);
        this.updateQty(id, -1);
      });
    });

    container.querySelectorAll('[data-qty-plus]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.qtyPlus);
        this.updateQty(id, 1);
      });
    });
  }

  public openDrawer() {
    const overlay = document.getElementById('cartOverlay');
    const drawer = document.getElementById('cartDrawer');
    overlay?.classList.add('show');
    drawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  public closeDrawer() {
    const overlay = document.getElementById('cartOverlay');
    const drawer = document.getElementById('cartDrawer');
    overlay?.classList.remove('show');
    drawer?.classList.remove('open');
    document.body.style.overflow = '';
  }
}
