import { Hono } from 'hono';
import { Env, User } from '../types';
import { processBotMessage } from '../services/botEngine';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/auth';
import { getStoreConfig } from '../services/config';
import { normalizeProduct } from '../services/catalog';

const aiApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

/** Endpoint oficial de Chat Bot JY (15 consultas por minuto por IP). */
aiApp.post('/chat', rateLimit(15, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const userMessage = String(body.message || '').trim();

    if (!userMessage) {
      return c.json({ error: 'Escribe un mensaje para continuar' }, 400);
    }

    // Catálogo en tiempo real para que el bot recomiende productos reales
    const prodsRes = await c.env.JY_DB.prepare(
      'SELECT * FROM products WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    ).all<any>();

    const products = (prodsRes.results || []).map(normalizeProduct);
    const config = await getStoreConfig(c.env);

    const result = await processBotMessage(userMessage, products, c.env.AI, {
      whatsapp: config.whatsapp,
      city: config.city
    });

    return c.json({
      success: true,
      botName: 'Chat Bot JY',
      reply: result.text,
      products: result.products || [],
      engine: result.engine
    });
  } catch (err: any) {
    console.error('Error en /api/ai/chat:', err);
    return c.json({ error: 'No pudimos responder en este momento. Intenta de nuevo.' }, 500);
  }
});

/** Asistente de redacción con IA para la mamá (en el panel admin). */
aiApp.post('/admin/suggest', requireAdmin, rateLimit(20, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const category = String(body.category || 'Jabones');
    const scent = String(body.aroma || 'lavanda').trim().toLowerCase();
    const cap = scent.charAt(0).toUpperCase() + scent.slice(1);

    let suggestedName = '';
    let suggestedDesc = '';
    let suggestedFeatures: string[] = [];
    let suggestedPrice = 15000;

    if (category === 'Velas') {
      suggestedName = `Vela Aromática ${cap} en Vaso`;
      suggestedDesc = `Vela decorativa elaborada en cera de soya natural con esencia pura de ${scent}. Diseñada para transformar tu sala o dormitorio en un espacio de paz y relajación duradera.`;
      suggestedFeatures = ['Cera de soya ecológica', `Aroma envolvente de ${scent}`, 'Vaso decorativo reutilizable', 'Duración +30 horas'];
      suggestedPrice = 25000;
    } else if (category === 'Especiales') {
      suggestedName = `Set Especial ${cap} & Spa`;
      suggestedDesc = `Edición especial que combina jabón artesanal con vela aromática de ${scent} en presentación de lujo, lista para sorprender en cualquier fecha especial.`;
      suggestedFeatures = ['Combo jabón + vela', 'Caja de regalo artesanal', 'Aromaterapia completa', 'Acabados de lujo'];
      suggestedPrice = 45000;
    } else {
      suggestedName = `Jabón Artesanal de ${cap}`;
      suggestedDesc = `Jabón artesanal enriquecido con aceites botánicos de ${scent}. Suave espuma cremosa que hidrata, perfuma delicadamente y revitaliza tu piel en el baño diario.`;
      suggestedFeatures = ['100% Hecho a mano', `Extracto natural de ${scent}`, 'Fórmula humectante', 'Ideal para piel sensible'];
      suggestedPrice = 16000;
    }

    return c.json({
      success: true,
      suggestion: {
        name: suggestedName,
        description: suggestedDesc,
        features: suggestedFeatures,
        price: suggestedPrice
      }
    });
  } catch (err) {
    console.error('Error al generar sugerencias:', err);
    return c.json({ error: 'Error al generar sugerencias' }, 500);
  }
});

export default aiApp;
