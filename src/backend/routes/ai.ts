import { Hono } from 'hono';
import { Env, User, Product } from '../types';
import { processBotMessage } from '../services/botEngine';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/auth';

const aiApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Endpoint oficial de Chat Bot JY (15 consultas por minuto por IP)
aiApp.post('/chat', rateLimit(15, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const userMessage = (body.message || '').trim();

    // Obtener productos activos de D1 para contexto en tiempo real
    const prodsRes = await c.env.JY_DB.prepare(
      'SELECT id, name, category, price, description, badge, image FROM products WHERE is_active = 1'
    ).all<any>();

    const products: Product[] = (prodsRes.results || []).map(p => ({
      ...p,
      features: []
    }));

    // Procesar mensaje con el motor híbrido (Workers AI + fallback robusto)
    const result = await processBotMessage(userMessage, products, c.env.AI);

    return c.json({
      success: true,
      botName: 'Chat Bot JY',
      reply: result.text,
      products: result.products || []
    });
  } catch (err: any) {
    console.error('Error en /api/ai/chat:', err);
    return c.json({
      success: true,
      botName: 'Chat Bot JY',
      reply: '¡Hola! Aquí estoy para ayudarte a elegir tus jabones artesanales o velas aromáticas favoritas. ¿Tienes en mente algún aroma o es para un regalo especial?',
      products: []
    });
  }
});

// Asistente de Redacción con IA para la Mamá (en el panel admin)
aiApp.post('/admin/suggest', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { category, aroma, target } = body;

    const cat = category || 'Jabones';
    const scent = (aroma || 'lavanda').toLowerCase();

    // Generar sugerencias inteligentes
    let suggestedName = '';
    let suggestedDesc = '';
    let suggestedFeatures: string[] = [];
    let suggestedPrice = 15000;

    if (cat === 'Jabones') {
      suggestedName = `Jabón Artesanal de ${scent.charAt(0).toUpperCase() + scent.slice(1)}`;
      suggestedDesc = `Jabón artesanal enriquecido con aceites botánicos de ${scent}. Suave espuma cremosa que hidrata, perfuma delicadamente y revitaliza tu piel en el baño diario.`;
      suggestedFeatures = ['100% Hecho a mano', `Extracto natural de ${scent}`, 'Fórmula humectante', 'Ideal para piel sensible'];
      suggestedPrice = 16000;
    } else if (cat === 'Velas') {
      suggestedName = `Vela Aromática ${scent.charAt(0).toUpperCase() + scent.slice(1)} en Vaso`;
      suggestedDesc = `Vela decorativa elaborada en cera de soya natural con esencia pura de ${scent}. Diseñada para transformar tu sala o dormitorio en un espacio de paz y relajación duradera.`;
      suggestedFeatures = ['Cera de soya ecológica', `Aroma envolvente de ${scent}`, 'Vaso decorativo reutilizable', 'Duración +30 horas'];
      suggestedPrice = 25000;
    } else {
      suggestedName = `Set Especial ${scent.charAt(0).toUpperCase() + scent.slice(1)} & Spa`;
      suggestedDesc = `Edición especial que combina jabón artesanal con vela aromática de ${scent} en presentación de lujo, lista para sorprender en cualquier fecha especial.`;
      suggestedFeatures = ['Combo jabón + vela', 'Caja de regalo artesanal', 'Aromaterapia completa', 'Acabados de lujo'];
      suggestedPrice = 45000;
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
    return c.json({ error: 'Error al generar sugerencias' }, 500);
  }
});

export default aiApp;
