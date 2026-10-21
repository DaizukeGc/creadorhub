import { Hono } from 'hono';
import { Env, User, Review } from '../types';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/auth';

const reviewsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

const MAX_NAME = 80;
const MAX_TEXT = 1000;

/** Análisis de sentimiento por palabras clave (usado como respaldo si Workers AI no está disponible). */
function heuristicSentiment(text: string): { sentiment: 'positive' | 'neutral' | 'negative'; score: number } {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const negative = [
    'malo', 'mala', 'mal', 'feo', 'fea', 'roto', 'rota', 'dañ', 'dan', 'decepcion',
    'decepcionante', 'horrible', 'terrible', 'pésimo', 'pesimo', 'no me gusto', 'no mew',
    'retraso', 'tarde', 'frio', 'frio', 'se rompio', 'llego roto', 'no llego', 'reclama',
    'queja', 'decepciono', 'caro', 'carisimo', 'sucio', 'olor raro'
  ];
  const positive = [
    'bueno', 'buena', 'excelente', 'hermoso', 'hermosa', 'lindo', 'linda', 'encanta',
    'encantada', 'amo', 'adore', 'maravilloso', 'maravillosa', 'precio', 'calidad',
    'recomendado', 'recomiendo', 'delicioso', 'delitosa', 'perfecto', 'perfecta', 'ricito',
    'preciosa', 'elegante', 'artesanal'
  ];

  const negHits = negative.filter(w => normalized.includes(w)).length;
  const posHits = positive.filter(w => normalized.includes(w)).length;

  if (negHits > posHits) return { sentiment: 'negative', score: 0.2 };
  if (posHits > negHits) return { sentiment: 'positive', score: 0.9 };
  return { sentiment: 'neutral', score: 0.5 };
}

/**
 * Analiza el sentimiento con Workers AI; si el modelo falla o no está
 * disponible, SIEMPRE se aplica el respaldo heurístico (antes una falla del
 * modelo guardaba reseñas negativas como positivas).
 */
async function analyzeSentiment(
  env: Env,
  text: string
): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number }> {
  if (env.AI) {
    try {
      const res = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text });
      const top = Array.isArray(res) ? res[0] : null;
      if (top && typeof top.label === 'string' && typeof top.score === 'number') {
        const label = top.label.toUpperCase();
        const sentiment = label.startsWith('NEG') ? 'negative' : label.startsWith('POS') ? 'positive' : 'neutral';
        return { sentiment, score: Number(top.score.toFixed(2)) };
      }
    } catch (err) {
      console.error('Workers AI no disponible, usando análisis local:', err);
    }
  }
  return heuristicSentiment(text);
}

reviewsApp.get('/', async (c) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));

    const reviewsRes = await c.env.JY_DB.prepare(
      'SELECT id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, date, created_at FROM reviews ORDER BY created_at DESC LIMIT ?'
    )
      .bind(limit)
      .all<Review>();

    // Las estadísticas se calculan sobre TODAS las reseñas, no solo las listadas
    const statsRes = await c.env.JY_DB.prepare(
      'SELECT COUNT(*) AS total, COALESCE(AVG(stars), 0) AS average FROM reviews'
    ).first<{ total: number; average: number }>();

    const distributionRes = await c.env.JY_DB.prepare(
      'SELECT stars, COUNT(*) AS count FROM reviews GROUP BY stars'
    ).all<{ stars: number; count: number }>();

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const row of distributionRes.results || []) {
      distribution[String(row.stars)] = row.count;
    }

    return c.json({
      success: true,
      reviews: reviewsRes.results || [],
      stats: {
        total: Number(statsRes?.total ?? 0),
        average: Number(Number(statsRes?.average ?? 0).toFixed(2))
      },
      distribution
    });
  } catch (err) {
    console.error('Error al listar reseñas:', err);
    return c.json({ error: 'Error al consultar reseñas' }, 500);
  }
});

reviewsApp.post('/', rateLimit(5, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const name = String(body.name || '').trim();
    const text = String(body.text || '').trim();
    const stars = Math.min(5, Math.max(1, Math.round(Number(body.stars) || 5)));

    if (!name || !text) {
      return c.json({ error: 'Escribe tu nombre y tu opinión' }, 400);
    }
    if (name.length > MAX_NAME || text.length > MAX_TEXT) {
      return c.json({ error: 'Tu reseña es demasiado larga' }, 400);
    }

    const { sentiment, score } = await analyzeSentiment(c.env, text);
    const flagged = stars <= 3 || sentiment === 'negative' ? 1 : 0;

    const id = `rev-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint8Array(4)).join('')}`;

    await c.env.JY_DB.prepare(`
      INSERT INTO reviews (id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), datetime('now'))
    `)
      .bind(id, name, text, stars, sentiment, score, flagged)
      .run();

    return c.json({ success: true, id, sentiment });
  } catch (err) {
    console.error('Error al crear reseña:', err);
    return c.json({ error: 'Error al guardar la reseña' }, 500);
  }
});

reviewsApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT * FROM reviews ORDER BY flagged_for_admin DESC, created_at DESC LIMIT 200'
    ).all<Review>();
    return c.json({ success: true, reviews: res.results || [] });
  } catch (err) {
    console.error('Error al listar reseñas (admin):', err);
    return c.json({ error: 'Error al consultar reseñas' }, 500);
  }
});

reviewsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const res = await c.env.JY_DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
    if (!res.meta.changes) {
      return c.json({ error: 'Reseña no encontrada' }, 404);
    }
    return c.json({ success: true, message: 'Reseña eliminada' });
  } catch (err) {
    console.error('Error al eliminar reseña:', err);
    return c.json({ error: 'Error al eliminar reseña' }, 500);
  }
});

export default reviewsApp;
