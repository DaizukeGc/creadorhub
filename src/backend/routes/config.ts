import { Hono } from 'hono';
import { Env, User } from '../types';
import { getStoreConfig, whatsappLink } from '../services/config';
import { getCategories } from '../services/catalog';

const configApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

/**
 * Configuración pública de la tienda: la usa el frontend para no tener
 * el número de WhatsApp, el TikTok o los textos del hero duplicados en el
 * código.
 */
configApp.get('/', async (c) => {
  try {
    const config = await getStoreConfig(c.env);
    const categories = await getCategories(c.env);

    return c.json({
      success: true,
      config: {
        ...config,
        whatsappLink: whatsappLink(config.whatsapp),
        categories
      }
    });
  } catch (err) {
    console.error('Error al obtener la configuración:', err);
    return c.json({ error: 'Error al obtener la configuración' }, 500);
  }
});

export default configApp;
