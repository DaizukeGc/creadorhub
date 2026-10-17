// Búsqueda Semántica y por Voz
import { apiFetch, escapeHTML, formatMoney, showToast } from '../api/client';
import { CartManager } from './cart';

export function initSearch(cartManager: CartManager, onOpenQuickView: (productId: number) => void) {
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const searchResults = document.getElementById('searchResults');
  const searchBtn = document.getElementById('searchBtn');
  const searchClose = document.getElementById('searchClose');
  const voiceBtn = document.getElementById('voiceBtn');

  if (!searchModal) return;

  searchBtn?.addEventListener('click', () => {
    searchModal.classList.add('show');
    searchInput?.focus();
    executeSearch('');
  });

  searchClose?.addEventListener('click', () => {
    searchModal.classList.remove('show');
  });

  let debounceTimer: any = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeSearch(searchInput.value);
    }, 250);
  });

  async function executeSearch(query: string) {
    if (!searchResults) return;

    searchResults.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mut)"><i class="fas fa-spinner fa-spin"></i> Buscando con IA...</div>';

    try {
      const res = await apiFetch(`/api/products/search/semantic?q=${encodeURIComponent(query.trim())}`);
      const products = res.products || [];

      if (products.length === 0) {
        searchResults.innerHTML = '<div style="text-align:center;padding:30px;color:var(--mut)"><i class="fas fa-box-open" style="font-size:2rem;margin-bottom:8px;display:block"></i>No encontramos productos con esa descripción.</div>';
        return;
      }

      searchResults.innerHTML = products.map((p: any) => `
        <div class="cart-item" style="cursor:pointer" data-view-prod="${p.id}">
          <img src="${p.image || 'https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=150&q=80'}" alt="${escapeHTML(p.name)}">
          <div style="flex:1">
            <h4>${escapeHTML(p.name)}</h4>
            <div class="pr">${formatMoney(p.price)}</div>
            <span style="font-size:0.75rem;color:var(--mut)">${escapeHTML(p.category)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" data-search-add="${p.id}" title="Agregar">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      `).join('');

      searchResults.querySelectorAll('[data-view-prod]').forEach(el => {
        el.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('[data-search-add]')) return;
          const id = Number((el as HTMLElement).dataset.viewProd);
          searchModal?.classList.remove('show');
          onOpenQuickView(id);
        });
      });

      searchResults.querySelectorAll('[data-search-add]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = Number((btn as HTMLElement).dataset.searchAdd);
          cartManager.addItem(id, 1);
        });
      });
    } catch (err) {
      searchResults.innerHTML = '<div style="text-align:center;padding:20px;color:var(--err)">Error en la búsqueda</div>';
    }
  }

  // Búsqueda por voz con Web Speech API
  voiceBtn?.addEventListener('click', () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Tu navegador no soporta búsqueda por voz', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.onstart = () => {
      voiceBtn.classList.add('rec');
      showToast('Escuchando... Di lo que buscas', 'info');
    };
    recognition.onend = () => {
      voiceBtn.classList.remove('rec');
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (searchInput) {
        searchInput.value = transcript;
        executeSearch(transcript);
      }
    };
    recognition.start();
  });
}
