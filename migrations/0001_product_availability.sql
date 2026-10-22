-- Migración: estado de disponibilidad de los productos (Agotado / Disponible)
-- Para bases de datos creadas antes de esta versión.
-- La app también aplica esta migración sola al arrancar (ensureAvailabilityColumn),
-- así que solo hace falta ejecutarla si quieres hacerlo manualmente.
--
-- Uso:  npx wrangler d1 execute JY_DB --remote --file=./migrations/0001_product_availability.sql

ALTER TABLE products ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1;

-- Todos los productos existentes quedan como disponibles.
UPDATE products SET is_available = 1 WHERE is_available IS NULL;
