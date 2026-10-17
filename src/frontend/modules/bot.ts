// Módulo Oficial de Chat Bot JY
import { apiFetch, escapeHTML, formatMoney } from '../api/client';
import { CartManager } from './cart';

export function initChatBot(cartManager: CartManager) {
  const chatFab = document.getElementById('chatFab');
  const chatPanel = document.getElementById('chatPanel');
  const chatClose = document.getElementById('chatClose');
  const chatInput = document.getElementById('chatInput') as HTMLInputElement;
  const chatSend = document.getElementById('chatSend');
  const chatBody = document.getElementById('chatBody');
  const chatQuick = document.getElementById('chatQuick');

  if (!chatFab || !chatPanel || !chatBody) return;

  // Abrir / Cerrar Chat Bot JY
  chatFab.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
      chatInput?.focus();
      if (chatBody.children.length === 0) {
        showWelcomeMessage();
      }
    }
  });

  chatClose?.addEventListener('click', () => {
    chatPanel.classList.remove('open');
  });

  function showWelcomeMessage() {
    appendMessage(
      'bot',
      '¡Hola! 👋 Soy **Chat Bot JY**, tu asesor artesanal. Cuéntame si buscas algo relajante para ti, un aroma especial o un detalle para regalo.'
    );
    renderQuickSuggestions();
  }

  function renderQuickSuggestions() {
    if (!chatQuick) return;
    const suggestions = [
      '🎁 ¿Qué recomiendas para regalo?',
      '🕯️ Ver velas aromáticas',
      '🌿 Jabones de spa y masaje',
      '🚚 Envíos y métodos de pago'
    ];

    chatQuick.innerHTML = suggestions
      .map(s => `<button data-quick="${s}">${s}</button>`)
      .join('');

    chatQuick.querySelectorAll('[data-quick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = (btn as HTMLElement).dataset.quick || '';
        sendMessage(query);
      });
    });
  }

  async function sendMessage(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    appendMessage('user', cleanText);
    if (chatInput) chatInput.value = '';

    // Mostrar indicador de escritura
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'msg bot';
    typingIndicator.innerHTML = '<span style="opacity:0.6"><i class="fas fa-spinner fa-spin"></i> Chat Bot JY está escribiendo...</span>';
    chatBody?.appendChild(typingIndicator);
    chatBody!.scrollTop = chatBody!.scrollHeight;

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: cleanText })
      });

      typingIndicator.remove();
      appendMessage('bot', res.reply || 'Aquí estoy para asesorarte.', res.products);
    } catch (err) {
      typingIndicator.remove();
      appendMessage(
        'bot',
        '¡Hola! Te recomiendo explorar nuestras velas aromáticas en cera de soya o nuestros jabones hidratantes. Puedes escribirnos a WhatsApp (+573150921542) para asesorarte personalmente.'
      );
    }
  }

  function appendMessage(who: 'bot' | 'user', text: string, products?: any[]) {
    if (!chatBody) return;

    const msgEl = document.createElement('div');
    msgEl.className = `msg ${who}`;

    // Formatear markdown básico (negritas y saltos de línea)
    let formattedText = escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');

    let productsHtml = '';
    if (products && products.length > 0) {
      productsHtml = products.map(p => `
        <div class="mini-prod">
          <img src="${p.image || 'https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=100&q=80'}" alt="${escapeHTML(p.name)}">
          <div style="flex:1">
            <b>${escapeHTML(p.name)}</b><br>
            <span style="color:var(--sec)">${formatMoney(p.price)}</span>
          </div>
          <button data-bot-add="${p.id}" title="Agregar al carrito">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      `).join('');
    }

    msgEl.innerHTML = `${formattedText}${productsHtml}`;
    chatBody.appendChild(msgEl);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Vincular botones de agregar al carrito dentro del chat
    msgEl.querySelectorAll('[data-bot-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.botAdd);
        cartManager.addItem(id, 1);
      });
    });
  }

  chatSend?.addEventListener('click', () => {
    sendMessage(chatInput?.value || '');
  });

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage(chatInput.value || '');
    }
  });
}
