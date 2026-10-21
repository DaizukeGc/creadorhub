# JY Velas y Jabones

Catálogo funcional de **velas aromáticas** y **jabones artesanales** hecho a mano en Neiva, Colombia. Desarrollado con **Hono 4**, **Cloudflare Workers**, **D1**, **Workers AI** y **Vite 6**.

## Características
- Catálogo público con filtros por `Velas`, `Jabones` y `Especiales`.
- Carrito con cálculo en cliente + validación/stock vía API.
- Checkout por **WhatsApp** con datos de entrega y cupones.
- Ruleta de descuentos que consume premios desde la API.
- Búsqueda semántica con Workers AI y fallback por palabras clave.
- Chat bot híbrido con contexto del catálogo.
- Portal administrativo en `/portal-jy` para subir fotos, crear/editar productos, ver pedidos, reseñas, medios y configuración.
- Almacenamiento de imágenes en D1 (`media`) o R2 (`JY_STORAGE` si está configurado). Las fotos subidas aparecen directamente en el catálogo.
- Cupones, reseñas con análisis de sentimiento, pedidos con código de rastreo público.

## Requisitos
- Node.js 24+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cuenta de Cloudflare (Workers, D1, Workers AI, Vectorize opcional)

## Configuración inicial
1. Instalar dependencias: `npm install`
2. Crear `.dev.vars` a partir de `.dev.vars.example` y definir `JWT_SECRET` (mínimo 16 caracteres).
3. Inicializar la base de datos local: `npm run d1:init:local`
4. Ejecutar en desarrollo: `npm run dev`

## Comandos útiles
| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Vite + Wrangler |
| `npm run check-types` | Verificación TypeScript sin emit |
| `npm run build` | Compilar con esbuild |
| `npm run d1:init:local` | Aplicar `schema.sql` + `seed.sql` a D1 local |
| `npm run d1:init:remote` | Aplicar schema/seed a D1 remoto |
| `npm run deploy` | Desplegar a Cloudflare Workers |

## Flujo para la mamá (subir fotos al catálogo)
1. Ingresar a `/portal-jy` con credenciales de administradora.
2. Ir a **Medios / Subir Imagen** (o directamente en **Productos → Crear/Editar** → Subir foto).
3. Seleccionar/comprimir la foto del teléfono y subirla. La API retorna `/media/<clave>` y queda guardada en la tabla `media`.
4. Usar esa URL en el producto o subirla desde el formulario: la imagen se verá inmediatamente en el catálogo público.

## Producción
- Configurar secreto: `wrangler secret put JWT_SECRET`
- Inicializar DB remoto: `npm run d1:init:remote`
- Desplegar: `npm run deploy`

## Licencia
Uso interno de **JY Velas y Jabones**. Todos los derechos reservados.
