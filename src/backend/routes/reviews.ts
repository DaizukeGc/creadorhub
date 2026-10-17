import { Hono } from 'hono';
import { Env, User, Review } from '../types';
import { requireAdmin } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const reviewsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Listar reseñas para la tienda
reviewsApp.get('/', async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT id, name, text, stars, sentiment, date FROM reviews ORDER BY created_at DESC LIMIT 20'
    ).all<Review>();

    const reviews = res.results || [];
    const totalStars = reviews.reduce((sum, r) => sum + r.stars, 0);
    const avg = reviews.length > 0 ? (totalStars / reviews.length).toFixed(1) : '5.0';

    return c.json({
      success: true,
      reviews,
      stats: {
        total: reviews.length,
        average: Number(avg)
      }
    });
  } catch (err) {
    return c.json({ error: 'Error al consultar reseñas' }, 500);
  }
});

// Publicar reseña con análisis de sentimiento automático por IA
reviewsApp.post('/', rateLimit(5, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const name = (body.name || '').trim();
    const text = (body.text || '').trim();
    const stars = Math.max(1, Math.min(5, Number(body.stars) || 5));

    if (!name || !text) {
      return c.json({ error: 'Nombre y opinión son requeridos' }, 400);
    }

    let sentiment: 'positive' | 'neutral' | 'negative' = 'positive';
    let sentiment_score = 0.95;
    let flagged_for_admin = stars <= 3 ? 1 : 0;

    // Intentar análisis con Cloudflare Workers AI
    if (c.env.AI && typeof c.env.AI.run === 'function') {
      try {
        const aiRes = await c.env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
          text: text
        });

        if (Array.isArray(aiRes) && aiRes.length > 0) {
          const topResult = aiRes[0];
          if (topResult.label === 'NEGATIVE') {
            sentiment = 'negative';
            sentiment_score = topResult.score || 0.8;
            flagged_for_admin = 1;
          } else {
            sentiment = 'positive';
            sentiment_score = topResult.score || 0.9;
          }
        }
      } catch (aiErr) {
        console.warn('Fallback de análisis de sentimiento:', aiErr);
      }
    }

    // Análisis heurístico fallback si no hubo IA
    if (!c.env.AI && (text.includes('mal') || text.includes('feo') || text.includes('roto') || stars <= 3)) {
      sentiment = 'negative';
      flagged_for_admin = 1;
    }

    const id = `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const today = new Date().toISOString().slice(0, 10);

    await c.env.JY_DB.prepare(`
      INSERT INTO reviews (id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, today).run();

    return c.json({
      success: true,
      review: {
        id,
        name,
        text,
        stars,
        sentiment,
        date: today
      }
    });
  } catch (err: any) {
    console.error('Error al guardar reseña:', err);
    return c.json({ error: 'Error al enviar la reseña' }, 500);
  }
});

// Rutas Administrativas de Reseñas (Solo Mamá)
reviewsApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT * FROM reviews ORDER BY flagged_for_admin DESC, created_at DESC'
    ).all<Review>();
    return c.json({ success: true, reviews: res.results || [] });
  } catch (err) {
    return c.json({ error: 'Error al listar reseñas en admin' }, 500);
  }
});

reviewsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.JY_DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Reseña eliminada' });
  } catch (err) {
    return c.json({ error: 'Error al eliminar reseña' }, 500);
  }
});

export default reviewsApp;
