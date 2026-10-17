// Motor Híbrido para Chat Bot JY
// Combina Cloudflare Workers AI con un motor contextual de alta precisión
// para garantizar que NUNCA deje de responder.

import { Product } from '../types';

interface BotResponse {
  text: string;
  products?: Array<{
    id: number;
    name: string;
    category: string;
    price: number;
    image?: string | null;
  }>;
}

export async function processBotMessage(
  userMessage: string,
  products: Product[],
  aiBinding?: any
): Promise<BotResponse> {
  const cleanMsg = (userMessage || '').trim();
  if (!cleanMsg) {
    return {
      text: '¡Hola! 👋 Soy **Chat Bot JY**. ¿En qué puedo ayudarte hoy? Cuéntame si buscas algo para ti o un detalle especial para regalar.'
    };
  }

  // 1. Intentar llamar a Cloudflare Workers AI si el binding existe
  if (aiBinding && typeof aiBinding.run === 'function') {
    try {
      const catalogSummary = products
        .slice(0, 12)
        .map(p => `• ${p.name} (${p.category}) - $${p.price.toLocaleString('es-CO')} COP: ${p.description}`)
        .join('\n');

      const systemPrompt = `Eres Chat Bot JY, el asistente virtual oficial de "JY Velas y Jabones" en Neiva, Colombia.
Atiendes a los clientes con calidez, elegancia y un tono colombiano respetuoso.
Catálogo actual disponible:
${catalogSummary}

Instrucciones:
- Responde de forma clara y atractiva (máximo 3 párrafos cortos).
- Si el cliente pregunta por regalos, recomiéndale sets o velas aromáticas.
- Si pregunta por cuidado o relajación, recomiéndale los jabones de masaje o extractos herbales.
- Informa que los pedidos se despachan a domicilio en Neiva y toda Colombia por WhatsApp (+573150921542) con pago contra entrega.
- Recuérdales girar la Ruleta de Descuentos para ganar cupones de descuento.`;

      const aiPromise = aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: cleanMsg }
        ],
        max_tokens: 350,
        temperature: 0.6
      });

      // Timeout de 3 segundos para garantizar velocidad de respuesta
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI timeout')), 3000)
      );

      const response: any = await Promise.race([aiPromise, timeoutPromise]);
      if (response && response.response) {
        // Encontrar productos relevantes para adjuntar tarjetas interactivas
        const relevantProds = findRelevantProducts(cleanMsg, products);
        return {
          text: response.response.trim(),
          products: relevantProds.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            image: p.image
          }))
        };
      }
    } catch (err) {
      console.warn('Fallback a motor contextual de Chat Bot JY:', err);
    }
  }

  // 2. Motor Contextual Inteligente (Fallback Inmediato 100% Robusto)
  return fallbackContextualEngine(cleanMsg, products);
}

function findRelevantProducts(query: string, products: Product[]): Product[] {
  const norm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const terms = norm.split(/\s+/).filter(w => w.length > 2);

  return products
    .map(p => {
      let score = 0;
      const pText = `${p.name} ${p.category} ${p.description} ${p.keywords || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const term of terms) {
        if (pText.includes(term)) score += 2;
      }
      return { product: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
}

function fallbackContextualEngine(msg: string, products: Product[]): BotResponse {
  const q = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Saludos
  if (/(hola|buenas|hey|buenos d|saludos|que tal)/i.test(q)) {
    const destacados = products.filter(p => p.badge).slice(0, 3);
    return {
      text: '¡Hola! 👋 Soy **Chat Bot JY**, tu asesor en velas y jabones artesanales. Estoy aquí para recomendarte el producto ideal según tu gusto, aroma favorito o si buscas un regalo especial para sorprender.\n\n¿Buscas jabones para consentir tu piel o velas aromáticas para ambientar tu hogar?',
      products: destacados.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Regalos / Anchetas / Especiales
  if (/(regalo|regalar|detalle|cumplea|ancheta|especial|mama|novi)/i.test(q)) {
    const regalos = products.filter(p => p.category === 'Especiales' || p.category === 'Velas').slice(0, 3);
    return {
      text: '🎁 **¡Para regalo tenemos opciones espectaculares!**\n\nNuestros favoritos más pedidos para obsequios son el **Set Premium** (jabones + vela decorativa) y la **Vela Rosa Decorativa** en vaso con flores preservadas. Vienen en una presentación elegante y lista para entregar.',
      products: regalos.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Spa / Cuidado / Relajación
  if (/(spa|relaj|masaje|piel|bano|banera|estres|cansanc)/i.test(q)) {
    const spa = products.filter(p => p.name.includes('Masaje') || p.name.includes('Azul') || p.category === 'Jabones').slice(0, 3);
    return {
      text: '🌿 **Para tu momento de relajación y spa:**\n\nTe recomiendo el **Jabón Masaje**, que tiene nódulos ergonómicos para activar la circulación y exfoliar suavemente en la ducha, o el **Jabón Azul Marino** con aroma fresco que te ayudará a desconectar después de un día largo.',
      products: spa.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Velas / Decoración / Hogar
  if (/(vela|aroma|olor|hogar|sala|decor|ambiente)/i.test(q)) {
    const velas = products.filter(p => p.category === 'Velas').slice(0, 3);
    return {
      text: '🕯️ **Nuestras Velas Aromáticas Artesanales:**\n\nElaboradas con cera de soya de alta pureza y fragancias finas. No solo huelen increíble, sino que lucen divinas en la sala o habitación. La **Vela Girasol** y la **Vela Rosa** son nuestras consentidas.',
      products: velas.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Precios económicos / Presupuesto
  if (/(barato|economico|precio|cuanto cuesta|menos de|presupuesto)/i.test(q)) {
    const baratos = [...products].sort((a, b) => a.price - b.price).slice(0, 3);
    return {
      text: '💸 **Opciones con excelente precio:**\n\nNuestros jabones artesanales individuales empiezan desde **$12.000 COP** y **$15.000 COP**. Además, ¡puedes girar nuestra **Ruleta de Descuentos** para ganar hasta un 20% OFF en tu pedido!',
      products: baratos.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Envíos / Pagos
  if (/(envio|domicilio|entrega|donde estan|neiva|colombia|pago|nequi|contraentrega)/i.test(q)) {
    return {
      text: '🚚 **Información de Envíos y Pagos:**\n\n• **Ubicación:** Estamos en **Neiva, Huila**, y despachamos a toda Colombia.\n• **Tiempos de entrega:** 24h en Neiva y 2 a 3 días a nivel nacional.\n• **Métodos de pago:** Puedes pagar por **Nequi, Daviplata, transferencia o Contra Entrega**.\n• **Envío gratis:** A partir de $60.000 COP.'
    };
  }

  // Cómo comprar
  if (/(como compro|como pido|whatsapp|pedido|ordenar)/i.test(q)) {
    return {
      text: '🛒 **Comprar es súper sencillo:**\n\n1. Agrega tus productos favoritos al carrito con el botón **(+)**.\n2. Si tienes un cupón de la ruleta, aplícalo para recibir tu descuento.\n3. Presiona **"Pedir por WhatsApp"** y se enviará el pedido confirmado directamente a nuestro WhatsApp oficial (+573150921542).'
    };
  }

  // Búsqueda directa por coincidencia de producto
  const matches = findRelevantProducts(q, products);
  if (matches.length > 0) {
    const top = matches[0];
    return {
      text: `Encontré **${top.name}** (${top.category}) a **$${top.price.toLocaleString('es-CO')} COP**.\n\n${top.description}`,
      products: matches.slice(0, 3).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
    };
  }

  // Respuesta general de ayuda
  const populares = products.slice(0, 3);
  return {
    text: 'Con mucho gusto te asesoro. Puedes preguntarme por **velas aromáticas**, **jabones exfoliantes**, **detalles para regalo** o consultar sobre nuestros **envíos y formas de pago**.\n\nAquí tienes algunos de los favoritos de nuestra colección:',
    products: populares.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image }))
  };
}
