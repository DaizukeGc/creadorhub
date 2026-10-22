# JY Velas y Jabones

Catálogo funcional de **velas aromáticas** y **jabones artesanales** hecho a mano en Neiva, Colombia. Desarrollado con **Hono 4**, **Cloudflare Workers**, **D1**, **Workers AI** y **Vite 6**.

## Características
- Catálogo público con filtros por `Velas`, `Jabones` y `Especiales`.
- **Estado de agotado**: los productos se pueden marcar como *Agotado* desde el panel; en la tienda aparecen en gris con sello rojo y no se pueden comprar (el servidor también lo bloquea).
- **Fotos ajustadas al cuadro**: al subir una foto se puede elegir recorte cuadrado o la foto completa, con color de fondo; las tarjetas usan proporción 1:1 para que el catálogo se vea parejo.
- Carrito con cálculo en cliente + validación/stock vía API.
- Checkout por **WhatsApp** con datos de entrega y cupones.
- Ruleta de descuentos que consume premios desde la API.
- Búsqueda semántica con Workers AI y fallback por palabras clave.
- Chat bot híbrido con contexto del catálogo que **deriva a una asesora real por WhatsApp (+57 315 092 1542)** cuando el cliente lo pide.
- Portal administrativo en `/portal-jy` con buscador y filtros de catálogo, vista previa de productos, edición, duplicado, cambio rápido de stock, panel de **Ayuda** paso a paso, pedidos, reseñas, medios y configuración.
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
2. Ir a **Mis Fotos** (o directamente en **Productos → Nuevo** → Foto).
3. Tocar el recuadro morado, elegir una o varias fotos del celular (también se pueden arrastrar). Se optimizan solas y quedan guardadas en la nube.
4. En el formulario del producto, elegir cómo se ajusta la foto (**Cuadrada** para llenar el cuadro, o **Completa, sin recortar** con fondo de color) y guardar.
5. La imagen se verá inmediatamente en el catálogo público, con la proporción correcta.

### Marcar un producto como agotado
1. En **Productos**, tocar el filtro **Agotados** para ver solo esos productos.
2. Tocar el botón **🚫** del producto: en la tienda aparece en gris con el sello *Agotado* y sin botón de compra.
3. Cuando vuelva a haber stock, tocar el botón **📦** (cajas), escribir las unidades nuevas y listo: el producto vuelve a la tienda solo (si se escriben `0`, se marca como agotado automáticamente).

### Si el cliente pide un asesor real
El bot de la tienda detecta el pedido y muestra un botón verde que abre WhatsApp directo con la asesora (**+57 315 092 1542**).

## Producción
- Configurar secreto: `wrangler secret put JWT_SECRET`
- Inicializar DB remoto: `npm run d1:init:remote`
- Desplegar: `npm run deploy`

## Licencia
Uso interno de **JY Velas y Jabones**. Todos los derechos reservados.
