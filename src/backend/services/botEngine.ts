// Motor Híbrido para Chat Bot JY
// Combina Cloudflare Workers AI con un motor contextual de alta precisión
// para garantizar que NUNCA deje de responder.

import { Ai, Product } from '../types';

export interface BotProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  image?: string | null;
}

export interface BotResponse {
  text: string;
  products?: BotProduct[];
  engine?: 'ai' | 'contextual';
}

interface BotContext {
  whatsapp: string;
  city: string;
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isCategory(product: Product, name: string): boolean {
  return normalize(product.category) === normalize(name);
}

function toBotProducts(products: Product[]): BotProduct[] {
  return products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    image: p.image ?? null
  }));
}

export async function processBotMessage(
  userMessage: string,
  products: Product[],
  aiBinding?: Ai,
  context: BotContext = { whatsapp: '573150921542', city: 'Neiva, Colombia' }
): Promise<BotResponse> {
  const cleanMsg = (userMessage || '').trim();
  if (!cleanMsg) {
    return {
      text: '¡Hola! 👋 Soy **Chat Bot JY**. ¿En qué puedo ayudarte hoy? Cuéntame si buscas algo para ti o un detalle especial para regalar.',
      engine: 'contextual'
    };
  }

  // 1. Intentar llamar a Cloudflare Workers AI si el binding existe
  if (aiBinding && typeof aiBinding.run === 'function') {
    try {
      const catalogSummary = products
        .slice(0, 12)
        .map(p => `• ${p.name} (${p.category}) - $${p.price.toLocaleString('es-CO')} COP: ${p.description}`)
        .join('\n');

      const systemPrompt = `Eres Chat Bot JY, el asistente virtual oficial de "JY Velas y Jabones" en ${context.city}.
Atiendes a los clientes con calidez, elegancia y un tono colombiano respetuoso.
Catálogo actual disponible:
${catalogSummary || '(catálogo sin productos por ahora)'}

Instrucciones:
- Responde de forma clara y atractiva (máximo 3 párrafos cortos).
- Si el cliente pregunta por regalos, recomiéndale sets o velas aromáticas.
- Si pregunta por cuidado o relajación, recomiéndale los jabones de masaje o extractos herbales.
- Informa que los pedidos se despachan a domicilio en ${context.city} y toda Colombia por WhatsApp (+${context.whatsapp}) con pago contra entrega.
- Recuérdales girar la Ruleta de Descuentos para ganar cupones de descuento.`;

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const aiPromise = aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: cleanMsg }
        ],
        max_tokens: 350,
        temperature: 0.6
      });

      // Timeout de 4 segundos para garantizar velocidad de respuesta
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('AI timeout')), 4000);
      });

      try {
        const response: any = await Promise.race([aiPromise, timeoutPromise]);
        if (response && typeof response.response === 'string' && response.response.trim()) {
          const relevantProds = findRelevantProducts(cleanMsg, products);
          return {
            text: response.response.trim(),
            products: toBotProducts(relevantProds.slice(0, 3)),
            engine: 'ai'
          };
        }
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    } catch (err) {
      console.warn('Fallback a motor contextual de Chat Bot JY:', err);
    }
  }

  // 2. Motor Contextual Inteligente (Fallback Inmediato 100% Robusto)
  return fallbackContextualEngine(cleanMsg, products, context);
}

function findRelevantProducts(query: string, products: Product[]): Product[] {
  const norm = normalize(query);
  const terms = norm.split(/\s+/).filter(w => w.length > 1);

  return products
    .map(p => {
      let score = 0;
      const pName = normalize(p.name);
      const pText = normalize(`${p.name} ${p.category} ${p.description} ${(p.features || []).join(' ')} ${p.keywords || ''}`);

      for (const term of terms) {
        if (pName.includes(term)) score += 4;
        if (normalize(p.category).includes(term)) score += 3;
        if (pText.includes(term)) score += 1;
      }
      return { product: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
}

function fallbackContextualEngine(msg: string, products: Product[], context: BotContext): BotResponse {
  const q = normalize(msg);
  const wa = `+${context.whatsapp}`;

  // Saludos
  if (/(hola|buenas|hey|buenos d|saludos|que tal)/i.test(q)) {
    const destacados = products.filter(p => p.badge).slice(0, 3);
    return {
      text: '¡Hola! 👋 Soy **Chat Bot JY**, tu asesor en velas y jabones artesanales. Estoy aquí para recomendarte el producto ideal según tu gusto, aroma favorito o si buscas un regalo especial para sorprender.\n\n¿Buscas jabones para consentir tu piel o velas aromáticas para ambientar tu hogar?',
      products: toBotProducts(destacados),
      engine: 'contextual'
    };
  }

  // Regalos / Anchetas / Especiales
  if (/(regalo|regalar|detalle|cumplea|ancheta|especial|mama|novi)/i.test(q)) {
    const regalos = products
      .filter(p => isCategory(p, 'Especiales') || isCategory(p, 'Velas'))
      .slice(0, 3);
    return {
      text: '🎁 **¡Para regalo tenemos opciones espectaculares!**\n\nNuestros favoritos más pedidos para obsequios son el **Set Premium** (jabones + vela decorativa) y la **Vela Rosa Decorativa** en vaso con flores preservadas. Vienen en una presentación elegante y lista para entregar.',
      products: toBotProducts(regalos),
      engine: 'contextual'
    };
  }

  // Spa / Cuidado / Relajación
  if (/(spa|relaj|masaje|piel|bano|banera|estres|cansanc)/i.test(q)) {
    const spa = products
      .filter(p => /masaje|azul/i.test(p.name) || isCategory(p, 'Jabones'))
      .slice(0, 3);
    return {
      text: '🌿 **Para tu momento de relajación y spa:**\n\nTe recomiendo el **Jabón Masaje**, que tiene nódulos ergonómicos para activar la circulación y exfoliar suavemente en la ducha, o el **Jabón Azul Marino** con aroma fresco que te ayudará a desconectar después de un día largo.',
      products: toBotProducts(spa),
      engine: 'contextual'
    };
  }

  // Velas / Decoración / Hogar
  if (/(vela|aroma|olor|hogar|sala|decor|ambiente)/i.test(q)) {
    const velas = products.filter(p => isCategory(p, 'Velas')).slice(0, 3);
    return {
      text: '🕯️ **Nuestras Velas Aromáticas Artesanales:**\n\nElaboradas con cera de soya de alta pureza y fragancias finas. No solo huelen increíble, sino que lucen divinas en la sala o habitación. La **Vela Girasol** y la **Vela Rosa** son nuestras consentidas.',
      products: toBotProducts(velas),
      engine: 'contextual'
    };
  }

  // Jabones / Aseo / Piel
  if (/(jabon|jabones|aseo|limpieza|suavizar|hidrata)/i.test(q)) {
    const jabones = products.filter(p => isCategory(p, 'Jabones')).slice(0, 3);
    return {
      text: '🧼 **Nuestros Jabones Artesanales:**\n\nElaborados con glicerina vegetal y aceites puros: exfolian con suavidad, hidratan y dejan un aroma delicado. Tenemos jabones de rosa, uvas, fresa, verde con hierbas y técnicas de masaje.',
      products: toBotProducts(jabones),
      engine: 'contextual'
    };
  }

  // Precios económicos / Presupuesto
  if (/(barato|economico|precio|cuanto cuesta|menos de|presupuesto)/i.test(q)) {
    const baratos = [...products].sort((a, b) => a.price - b.price).slice(0, 3);
    return {
      text: '💸 **Opciones con excelente precio:**\n\nNuestros jabones artesanales individuales empiezan desde **$12.000 COP** y **$15.000 COP**. Además, ¡puedes girar nuestra **Ruleta de Descuentos** para ganar hasta un 20% OFF en tu pedido!',
      products: toBotProducts(baratos),
      engine: 'contextual'
    };
  }

  // Envíos / Pagos
  if (/(envio|domicilio|entrega|donde estan|neiva|colombia|pago|nequi|contraentrega)/i.test(q)) {
    return {
      text: `🚚 **Información de Envíos y Pagos:**\n\n• **Ubicación:** Estamos en **${context.city}**, y despachamos a toda Colombia.\n• **Tiempos de entrega:** 24h en Neiva y 2 a 3 días a nivel nacional.\n• **Métodos de pago:** Puedes pagar por **Nequi, Daviplata, transferencia o Contra Entrega**.\n• **Envío gratis:** A partir de $60.000 COP.`,
      engine: 'contextual'
    };
  }

  // Cómo comprar
  if (/(como compro|como pido|whatsapp|pedido|ordenar)/i.test(q)) {
    return {
      text: `🛒 **Comprar es súper sencillo:**\n\n1. Agrega tus productos favoritos al carrito con el botón **(+)**.\n2. Si tienes un cupón de la ruleta, aplícalo para recibir tu descuento.\n3. Presiona **"Pedir por WhatsApp"** y se enviará el pedido confirmado directamente a nuestro WhatsApp oficial (${wa}).`,
      engine: 'contextual'
    };
  }

  // Búsqueda directa por coincidencia de producto
  const matches = findRelevantProducts(q, products);
  if (matches.length > 0) {
    const top = matches[0];
    return {
      text: `Encontré **${top.name}** (${top.category}) a **$${top.price.toLocaleString('es-CO')} COP**.\n\n${top.description}`,
      products: toBotProducts(matches.slice(0, 3)),
      engine: 'contextual'
    };
  }

  // Respuesta general de ayuda
  const populares = products.slice(0, 3);
  return {
    text: 'Con mucho gusto te asesoro. Puedes preguntarme por **velas aromáticas**, **jabones exfoliantes**, **detalles para regalo** o consultar sobre nuestros **envíos y formas de pago**.\n\nAquí tienes algunos de los favoritos de nuestra colección:',
    products: toBotProducts(populares),
    engine: 'contextual'
  };
}
