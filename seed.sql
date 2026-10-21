-- Datos iniciales para JY Velas y Jabones
-- Aplicar DESPUÉS de schema.sql

-- ---------------------------------------------------------------------------
-- Administradora
-- Usuario: mama   Contraseña: jy2026admin   (cámbiala al primer ingreso)
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, active, token_version)
VALUES (
  'usr_admin_mama',
  'mama',
  '55888d528fa73704adf74d5054e10be754edf11222849a37e4151a780e8f5663',
  'f522ad9adc62e05f3f4e6c406767fda2',
  'Mamá (Administradora)',
  'admin',
  1,
  0
);

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO categories (id, name, slug, display_order) VALUES
  (1, 'Jabones', 'jabones', 1),
  (2, 'Velas', 'velas', 2),
  (3, 'Especiales', 'especiales', 3);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO products
  (id, name, category, price, old_price, stock, rating, sold, badge, badge_type, image, features, description, keywords, is_active, display_order)
VALUES
  (1, 'Jabón Rosa Amarilla', 'Jabones', 15000, 18000, 12, 4.9, 38, 'Más vendido', 'bestseller', '/assets/jy/jabon-rosa-amarilla.svg',
   '["100% hecho a mano","Glicerina vegetal","Aroma suave de rosa","Vela de 90 minutos"]',
   'Jabón artesanal de color amarillo con pétalos de rosa naturales. Su espuma cremosa limpia sin resecar y deja la piel suave y perfumada.',
   'jabon rosa amarillo floral regalo mujer',
   1, 1),

  (2, 'Jabón Rosa Blanca', 'Jabones', 15000, NULL, 9, 4.8, 22, 'Elegante', 'premium', '/assets/jy/jabon-rosa-blanca.svg',
   '["Diseño artesanal","Rosa natural","Empaque para regalo","Ideal para invitadas"]',
   'Blanco rosado suave con pétalos de rosa, elegantemente presentado. Es nuestro jabón más pedido para regalos y eventos especiales.',
   'jabon rosa blanco elegante regalo',
   1, 2),

  (3, 'Jabón Huella', 'Especiales', 12000, NULL, 15, 4.7, 19, 'Nuevo', 'new', '/assets/jy/jabon-huella.svg',
   '["Forma de huella","Vela de 60 minutos","Hecho a mano","Ideal para los más pequeños"]',
   'Jabón con forma de huella de gato, perfecto para iniciar la rutina de los más pequeños. Aromas suaves y un diseño que invita a usarlo.',
   'jabon huella gato infantil amusing',
   1, 3),

  (4, 'Vela Rosa Decorativa', 'Velas', 25000, 30000, 6, 5.0, 41, 'Premium', 'premium', '/assets/jy/vela-rosa-decorativa.svg',
   '["Cera de soya","Vaso de cristal","Flores preservadas","Duración 40 horas","Regalo listo"]',
   'Vela aromática en cera de soya con flores preservadas y detalles hechos a mano. Decora la habitación y perfuma con un toque floral elegante.',
   'vela rosa decorativa premium flor preservada regalo',
   1, 4),

  (5, 'Jabón Uvas', 'Jabones', 18000, NULL, 8, 4.8, 14, 'Artesanal', 'premium', '/assets/jy/jabon-uvas.svg',
   '["Aroma frutal","Con jugo de uva","Hidrata y tonifica","Vela de 90 minutos"]',
   'Jabón artesanal con aroma a uva madura e ingredientes que hidratan y tonifican la piel, dejándola fresca y luminosa.',
   'jabon uvas frutal hidratante',
   1, 5),

  (6, 'Jabón Fresa Azul', 'Jabones', 14000, NULL, 11, 4.6, 17, 'Color intenso', 'new', '/assets/jy/jabon-fresa-azul.svg',
   '["Color intenso","Aroma de fresa","Textura cremosa","Empaque artesanal"]',
   'Jabón de color azul profundo con aroma dulce de fresa. Cada pieza está modelada a mano, por eso ninguna es igual a otra.',
   'jabon fresa azul color intenso',
   1, 6),

  (7, 'Vela Girasol', 'Velas', 22000, 26000, 7, 4.9, 26, 'Regalo', 'bestseller', '/assets/jy/vela-girasol.svg',
   '["Cera de soya","Aroma cítrico","Vaso reutilizable","Duración 35 horas"]',
   'Vela aromática inspirada en girasoles con notas cítricas que levantan el ánimo. Ideal para regalar o para acompañarte en las mañanas.',
   'vela girasol citrico amanecer',
   1, 7),

  (8, 'Jabón Masaje', 'Jabones', 20000, NULL, 10, 4.8, 20, 'Spa', 'premium', '/assets/jy/jabon-masaje.svg',
   '["Nódulos ergonómicos","Exfolia suavemente","Aroma relajante","Para pies y cuerpo"]',
   'Jabón de masaje con nódulos que activan la circulación y exfolian con suavidad. Convierte la ducha en un pequeño spa.',
   'jabon masaje spa exfoliante pies',
   1, 8),

  (9, 'Jabón Verde', 'Jabones', 16000, NULL, 13, 4.7, 16, 'Natural', 'new', '/assets/jy/jabon-verde.svg',
   '["Con hierbas-secas","100% botánico","Aroma herbal","Suave con piel sensible"]',
   'Jabón verde con hierbas secas y aromaterapia suave para pieles sensibles. Elaborado con aceites vegetales puros.',
   'jabon verde herbal natural relajante',
   1, 9),

  (10, 'Set Premium', 'Especiales', 45000, 52000, 5, 5.0, 33, 'Premium', 'premium', '/assets/jy/set-premium.svg',
   '["Combo jabón + vela","Caja de regalo artesanal","Aromaterapia completa","Empaque de lujo"]',
   'Set de regalo que combina dos jabones artesanales con una vela aromática en presentación de lujo. Listo para regalar sin envoltura.',
   'set premium caja regalo combo spa',
   1, 10),

  (11, 'Jabón Azul Marino', 'Jabones', 15000, NULL, 12, 4.6, 12, 'Relax', 'new', '/assets/jy/jabon-azul-marino.svg',
   '["Aroma fresco","Hidratación profunda","Textura con olas","Vela de 90 minutos"]',
   'Jabón azul marino con aroma fresco y textura con olas que envuelve la piel. Un baño profundo y relajante.',
   'jabon azul marino fresco relajante',
   1, 11),

  (12, 'Jabón Ámbar', 'Jabones', 17000, NULL, 9, 4.9, 24, 'Especial', 'bestseller', '/assets/jy/jabon-ambar.svg',
   '["Aroma cálido","Con miel natural","Suaviza la piel","Acabado brillante"]',
   'Jabón color ámbar con aroma cálido y toque de miel. Suaviza la piel y deja un acabado luminoso difícil de olvidar.',
   'jabon ambar miel calido humectante',
   1, 12);

-- ---------------------------------------------------------------------------
-- Cupones (la ruleta muestra el campo `label`)
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO coupons (id, code, discount_pct, label, active) VALUES
  (1, 'JY10', 10, '10% OFF', 1),
  (2, 'BIENVENIDA', 5, '5% Bienvenida', 1),
  (3, 'JY15', 15, '15% OFF', 1),
  (4, 'JY20', 20, '20% OFF', 1),
  (5, 'JYENVIO', 8, '8% Envío', 1);

-- ---------------------------------------------------------------------------
-- Reseñas iniciales
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO reviews (id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, date) VALUES
  ('rev-1', 'Marcela R.', 'El jabón de rosa es precioso y huele increíble. Mi hija lo pidió para su cumpleaños.', 5, 'positive', 0.98, 0, '2026-08-02'),
  ('rev-2', 'Andrés P.', 'La vela de girasol quedó perfecta en la sala. La entrega fue súper rápida a Neiva.', 5, 'positive', 0.96, 0, '2026-08-11'),
  ('rev-3', 'Laura G.', 'Compré el set premium para regalo y llegó muy bien empacado. Totalmente recomendado.', 5, 'positive', 0.99, 0, '2026-09-04');

-- ---------------------------------------------------------------------------
-- Configuración de la tienda
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO store_config (key, value) VALUES
  ('storeName', 'JY Velas y Jabones'),
  ('tagline', 'Arte y Esencia en Cada Pieza'),
  ('heroCopy', 'Jabones botánicos, velas aromáticas en cera de soya y detalles artesanales con acabados elegantes y aromas que transforman tus momentos.'),
  ('aboutTitle', 'Belleza artesanal con carácter natural'),
  ('aboutText', 'JY nace en Neiva del amor por el detalle: piezas hechas a mano, colores intensos, aromas equilibrados y presentaciones que se sienten especiales al regalar o consentirte en casa.'),
  ('whatsapp', '573150921542'),
  ('tiktok', 'velas_y_jabones_jy'),
  ('city', 'Neiva, Colombia'),
  ('topMsg', '✨ Gira la ruleta y gana hasta 20% OFF · Envíos a todo Colombia'),
  ('logo', '/assets/jy/logo.svg'),
  ('heroImg1', '/assets/jy/hero-1.svg'),
  ('heroImg2', '/assets/jy/hero-2.svg'),
  ('aboutImg', '/assets/jy/coleccion-artesanal.svg');
