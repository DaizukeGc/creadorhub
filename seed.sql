-- Seed de Datos Iniciales para JY Velas y Jabones

-- Usuario administrador exclusivo para la mamá
-- Usuario: mama
-- Contraseña predeterminada: jy2026admin
INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, active)
VALUES (
  'usr_admin_mama',
  'mama',
  '55888d528fa73704adf74d5054e10be754edf11222849a37e4151a780e8f5663',
  'f522ad9adc62e05f3f4e6c406767fda2',
  'Mamá (Administradora)',
  'admin',
  1
);

-- Categorías
INSERT OR IGNORE INTO categories (id, name, slug, display_order) VALUES
(1, 'Jabones', 'jabones', 1),
(2, 'Velas', 'velas', 2),
(3, 'Especiales', 'especiales', 3);

-- Catálogo de 12 Productos Originales
INSERT OR REPLACE INTO products (id, name, category, price, old_price, stock, rating, sold, badge, badge_type, image, features, description, keywords, is_active, display_order) VALUES
(1, 'Jabón Rosa Amarilla', 'Jabones', 15000, 18000, 12, 4.9, 38, 'Más vendido', 'bestseller', 'assets/jy/rosa-girasol.png', '["Forma de rosa", "Aroma floral", "Acabado brillante"]', 'Jabón en forma de rosa con tono cálido, aceites hidratantes y aroma floral suave.', 'rosa, amarillo, floral, artesanal, baño, cuidado', 1, 1),
(2, 'Jabón Rosa Blanca', 'Jabones', 15000, NULL, 9, 4.8, 22, 'Elegante', 'premium', 'assets/jy/rosa-blanca-masaje.png', '["Color blanco puro", "Presentación fina", "Suave con la piel"]', 'Rosa blanca elegante con fórmula de glicerina pura y extractos humectantes.', 'blanca, elegante, suave, neutro, hidratante', 1, 2),
(3, 'Jabón Huella', 'Especiales', 12000, NULL, 15, 4.7, 19, 'Nuevo', 'new', 'assets/jy/huella-pata.png', '["Diseño único", "Ideal para anchetas", "Colores vivos"]', 'Diseño divertido de huella artesanal, perfecto para regalos y recordatorios especiales.', 'huella, mascota, divertido, ancheta, regalo', 1, 3),
(4, 'Vela Rosa Decorativa', 'Velas', 25000, 30000, 6, 5.0, 41, 'Premium', 'premium', 'assets/jy/vela-rosa-decorativa.png', '["Vaso decorativo", "Flores preservadas", "Cera de soya"]', 'Vela aromática en vaso de vidrio decorativo con flores preservadas y aroma envolvente.', 'vela, decoracion, cera de soya, aroma, hogar', 1, 4),
(5, 'Jabón Uvas', 'Especiales', 18000, NULL, 8, 4.8, 14, 'Artesanal', 'premium', 'assets/jy/mesa-premium.png', '["Racimo de uvas", "Color intenso", "Aroma frutal"]', 'Set de jabones en forma de racimo de uvas moradas con fragancia dulce y frutal.', 'uvas, morado, frutal, dulce, decorativo', 1, 5),
(6, 'Jabón Fresa Azul', 'Jabones', 14000, NULL, 11, 4.6, 17, 'Color intenso', 'new', 'assets/jy/fresa-azul.png', '["Forma realista", "Azul vibrante", "Espuma cremosa"]', 'Jabón artesanal con forma realista y tono azul vibrante, aroma fresco y revitalizante.', 'fresa, azul, fresco, divertido, espuma', 1, 6),
(7, 'Vela Girasol', 'Velas', 22000, 26000, 7, 4.9, 26, 'Regalo', 'bestseller', 'assets/jy/rosa-girasol.png', '["Color amarillo vivo", "Aroma cálido", "Larga duración"]', 'Vela decorativa en forma de girasol brillante con fragancia cálida y relajante.', 'girasol, amarillo, vela, cálido, centro de mesa', 1, 7),
(8, 'Jabón Masaje', 'Jabones', 20000, NULL, 10, 4.8, 20, 'Spa', 'premium', 'assets/jy/rosa-blanca-masaje.png', '["Textura de relieve", "Exfoliación suave", "Efecto relajante"]', 'Jabón con nódulos ergonómicos para masaje y exfoliación en la ducha.', 'masaje, spa, exfoliante, relajante, baño', 1, 8),
(9, 'Jabón Verde', 'Jabones', 16000, NULL, 13, 4.7, 16, 'Natural', 'new', 'assets/jy/verde-hierbas-tela.png', '["Aroma fresco", "Ingredientes naturales", "Extracto herbal"]', 'Jabón enriquecido con extractos de hierbas silvestres y aceites botánicos.', 'verde, hierbas, natural, herbal, fresco', 1, 9),
(10, 'Set Premium', 'Especiales', 45000, 52000, 5, 5.0, 33, 'Premium', 'premium', 'assets/jy/set-jy.png', '["Set completo", "Caja de regalo", "Jabones + Vela"]', 'Combo exclusivo con jabones artesanales seleccionados y vela aromática en caja de lujo.', 'combo, set, ancheta, regalo, vela y jabon', 1, 10),
(11, 'Jabón Azul Marino', 'Jabones', 15000, NULL, 12, 4.6, 12, 'Relax', 'new', 'assets/jy/rosa-azul-marino.png', '["Efecto relajante", "Tono marino profundo", "Aroma a brisa"]', 'Jabón con tono azul marino profundo y fragancia oceánica para desconectar el estrés.', 'azul, marino, relajante, brisa, spa', 1, 11),
(12, 'Jabón Ámbar', 'Jabones', 17000, NULL, 9, 4.9, 24, 'Especial', 'bestseller', 'assets/jy/azul-ambar.png', '["Color ámbar dorado", "Madera y especias", "Fórmula nutritiva"]', 'Jabón artesanal sofisticado con tono ámbar cálido y notas amaderadas y especiadas.', 'ámbar, madera, especias, sofisticado, cálido', 1, 12);

-- Cupones para la Ruleta de Descuentos
INSERT OR REPLACE INTO coupons (id, code, discount_pct, active) VALUES
(1, 'JY10', 10, 1),
(2, 'BIENVENIDA', 5, 1),
(3, 'JY15', 15, 1),
(4, 'JY20', 20, 1),
(5, 'JYENVIO', 8, 1);

-- Reseñas de Clientes
INSERT OR REPLACE INTO reviews (id, name, text, stars, sentiment, sentiment_score, flagged_for_admin, date) VALUES
('rev-1', 'Marcela R.', 'Los jabones llegaron hermosos a Neiva, con aroma suave y presentación muy fina para regalar.', 5, 'positive', 0.98, 0, '2026-08-02'),
('rev-2', 'Andrés P.', 'Me encantó la vela decorativa, tiene una fragancia elegante que perdura en la sala.', 5, 'positive', 0.96, 0, '2026-08-11'),
('rev-3', 'Laura G.', 'El set premium tiene acabados preciosos. Se nota la dedicación y el amor en cada detalle.', 5, 'positive', 0.99, 0, '2026-09-04');

-- Configuración de Negocio
INSERT OR REPLACE INTO store_config (key, value) VALUES
('storeName', 'JY Velas y Jabones'),
('tagline', 'Arte y Esencia en Cada Pieza'),
('heroCopy', 'Jabones, velas y detalles artesanales con acabados elegantes, aromas suaves y presentación cuidada.'),
('aboutTitle', 'Belleza artesanal con carácter natural y elegante'),
('aboutText', 'JY nace del cuidado por los detalles: piezas hechas a mano en Colombia, colores intensos, aromas equilibrados y presentaciones que se sienten especiales.'),
('whatsapp', '573150921542'),
('tiktok', 'velas_y_jabones_jy'),
('city', 'Neiva, Colombia'),
('topMsg', '✨ Envío gratis desde $60.000 · Gira la ruleta y gana descuentos exclusivos'),
('logo', 'assets/jy/logo.png'),
('heroImg1', 'assets/jy/mesa-premium.png'),
('heroImg2', 'assets/jy/vela-rosa-decorativa.png'),
('aboutImg', 'assets/jy/coleccion-artesanal.png');
