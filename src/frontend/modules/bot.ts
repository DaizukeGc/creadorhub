// Módulo Oficial de Chat Bot JY
import { apiFetch, escapeHTML, formatMoney } from '../api/client';
import { CartManager } from './cart';

/** Número de la asesora real (la mamá), usado como respaldo si la API no responde. */
const FALLBACK_ADVISOR = '573150921542';

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
      '¡Hola! 👋 Soy **Chat Bot JY**, tu asesor artesanal. Cuéntame si buscas algo relajante para ti, un aroma especial o un detalle para regalo.\n\n💬 ¿Prefieres que te recomiende yo o quieres hablar directamente con una **asesora real** por WhatsApp?'
    );
    renderQuickSuggestions();
  }

  function renderQuickSuggestions() {
    if (!chatQuick) return;
    const suggestions = [
      '🎁 ¿Qué recomiendas para regalo?',
      '🕯️ Ver velas aromáticas',
      '🌿 Jabones de spa y masaje',
      '🚚 Envíos y métodos de pago',
      '📲 Hablar con un asesor'
    ];

    chatQuick.innerHTML = suggestions
      .map(s => `<button data-quick="${escapeHTML(s)}">${escapeHTML(s)}</button>`)
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
      appendMessage('bot', res.reply || 'Aquí estoy para asesorarte.', res.products, {
        advisorLink: res.advisorLink,
        showAdvisorButton: res.showAdvisorButton
      });
    } catch (err) {
      typingIndicator.remove();
      appendMessage(
        'bot',
        '¡Hola! Te recomiendo explorar nuestras velas aromáticas en cera de soya o nuestros jabones hidratantes. Si prefieres una atención personalizada, te llevo con nuestra asesora por WhatsApp.',
        undefined,
        {
          advisorLink: `https://wa.me/${FALLBACK_ADVISOR}?text=${encodeURIComponent(
            'Hola, vi la página de JY Velas y Jabones y me gustaría recibir asesoría.'
          )}`,
          showAdvisorButton: true
        }
      );
    }
  }

  /** Convierte números de WhatsApp dentro del texto en enlaces pulsables. */
  function linkifyWhatsApp(text: string): string {
    return text.replace(/(wa\.me\/([0-9]{6,15})|(\+?[0-9]{10,15}))/g, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 10) return match;
      return `<a href="https://wa.me/${digits}" target="_blank" rel="noopener" class="bot-wa-link">${match}</a>`;
    });
  }

  function appendMessage(
    who: 'bot' | 'user',
    text: string,
    products?: any[],
    options?: { advisorLink?: string | null; showAdvisorButton?: boolean }
  ) {
    if (!chatBody) return;

    const msgEl = document.createElement('div');
    msgEl.className = `msg ${who}`;

    // Formatear markdown básico (negritas y saltos de línea)
    let formattedText = escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');

    formattedText = linkifyWhatsApp(formattedText);

    let productsHtml = '';
    if (products && products.length > 0) {
      productsHtml = `<div class="bot-products">${products
        .map(p => {
          const agotado = p.is_available === 0;
          return `
          <div class="mini-prod ${agotado ? 'is-out' : ''}">
            <img src="${p.image || '/assets/jy/coleccion-artesanal.svg'}" alt="${escapeHTML(p.name)}">
            <div style="flex:1;min-width:0">
              <b>${escapeHTML(p.name)}</b><br>
              <span style="color:var(--sec)">${formatMoney(p.price)}</span>
              ${agotado ? '<span class="bot-out">AGOTADO</span>' : ''}
            </div>
            ${
              agotado
                ? '<span class="bot-out-btn">Agotado</span>'
                : `<button data-bot-add="${p.id}" title="Agregar al carrito"><i class="fas fa-plus"></i></button>`
            }
          </div>
        `;
        })
        .join('')}</div>`;
    }

    // Botón grande para hablar con la asesora real
    let advisorHtml = '';
    if (options?.showAdvisorButton && options.advisorLink) {
      advisorHtml = `
        <a class="bot-advisor-btn" href="${escapeHTML(options.advisorLink)}" target="_blank" rel="noopener">
          <i class="fab fa-whatsapp"></i> Hablar con una asesora real
        </a>
        <p class="bot-advisor-note">Te responde la misma persona que administra la tienda 💜</p>
      `;
    }

    msgEl.innerHTML = `${formattedText}${productsHtml}${advisorHtml}`;
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
