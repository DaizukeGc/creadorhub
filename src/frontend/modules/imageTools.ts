// Compresión de imágenes en el navegador.
// Las fotos de celular pesan 3-8 MB y D1 admite máximo 1.5 MB por imagen,
// por lo que aquí se redimensionan y recomprimen antes de subirlas.

export interface CompressOptions {
  /** Lado máximo en píxeles (ambos lados). */
  maxDimension?: number;
  /** Calidad JPEG inicial (0-1). */
  quality?: number;
  /** Peso máximo objetivo en bytes. */
  maxBytes?: number;
  /** Formato de salida. */
  mimeType?: string;
  /**
   * 'cover' recorta la foto a la proporción pedida (rellena el cuadro sin
   * deformar). 'contain' conserva toda la foto y completa con el color de fondo.
   */
  fit?: 'cover' | 'contain';
  /** Proporción ancho/alto del resultado. Por defecto 1:1 (cuadrado). */
  aspectRatio?: number;
  /** Color de fondo para el modo 'contain'. */
  background?: string;
}

export interface CompressResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
  fileName: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return readAsDataUrl(blob);
}

/** Carga la imagen respetando la orientación EXIF cuando el navegador lo soporta. */
async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { width: bitmap.width, height: bitmap.height, draw: bitmap, close: () => bitmap.close() };
    } catch {
      /* algunos navegadores no aceptan imageOrientation: usamos el fallback */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Formato de imagen no soportado'));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: img,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Redimensiona y recomprime una imagen hasta que pese menos de `maxBytes`.
 * Si la imagen original ya cumple el límite, se devuelve sin tocar.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<CompressResult> {
  const maxDimension = options.maxDimension ?? 1400;
  const maxBytes = options.maxBytes ?? 1_400_000;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const fit = options.fit ?? 'cover';
  const aspectRatio = options.aspectRatio && options.aspectRatio > 0 ? options.aspectRatio : 1;
  const background = options.background ?? '#ffffff';
  let quality = options.quality ?? 0.86;

  const originalBytes = file.size;
  const bitmap = await loadBitmap(file);

  try {
    // Calcula el lienzo de salida respetando la proporción pedida.
    const sourceRatio = bitmap.width / bitmap.height;
    let width: number;
    let height: number;

    if (fit === 'contain') {
      // Toda la foto entra; se completa con el color de fondo.
      width = Math.round(Math.min(maxDimension, bitmap.width));
      height = Math.round(width / aspectRatio);
    } else {
      // Recorte central: llena el cuadro sin deformar la foto.
      if (sourceRatio > aspectRatio) {
        width = Math.round(bitmap.height * aspectRatio);
        height = bitmap.height;
      } else {
        width = bitmap.width;
        height = Math.round(bitmap.width / aspectRatio);
      }
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no permite procesar la imagen');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (fit === 'contain') {
      // Escala la imagen completa dentro del lienzo, centrada.
      const innerScale = Math.min(width / bitmap.width, height / bitmap.height);
      const drawW = Math.max(1, Math.round(bitmap.width * innerScale));
      const drawH = Math.max(1, Math.round(bitmap.height * innerScale));
      ctx.drawImage(
        bitmap.draw,
        Math.round((width - drawW) / 2),
        Math.round((height - drawH) / 2),
        drawW,
        drawH
      );
    } else {
      // Recorte central: se dibuja la porción central de la foto original.
      const sourceRatio = bitmap.width / bitmap.height;
      let cropW = bitmap.width;
      let cropH = bitmap.height;
      if (sourceRatio > aspectRatio) {
        cropW = Math.round(bitmap.height * aspectRatio);
      } else {
        cropH = Math.round(bitmap.width / aspectRatio);
      }
      const cropX = Math.round((bitmap.width - cropW) / 2);
      const cropY = Math.round((bitmap.height - cropH) / 2);
      ctx.drawImage(bitmap.draw, cropX, cropY, cropW, cropH, 0, 0, width, height);
    }

    const toBlob = (q: number): Promise<Blob> =>
      new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))),
          mimeType,
          q
        );
      });

    let blob = await toBlob(quality);

    // Reduce calidad hasta cumplir el límite de peso.
    while (blob.size > maxBytes && quality > 0.4) {
      quality -= 0.1;
      blob = await toBlob(quality);
    }

    // Si aún no cabe, reduce dimensiones un 20% más y repite.
    let currentWidth = width;
    let currentHeight = height;
    while (blob.size > maxBytes && currentWidth > 400 && currentHeight > 400) {
      currentWidth = Math.round(currentWidth * 0.8);
      currentHeight = Math.round(currentHeight * 0.8);
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, currentWidth, currentHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (fit === 'contain') {
        const innerScale = Math.min(currentWidth / bitmap.width, currentHeight / bitmap.height);
        const drawW = Math.max(1, Math.round(bitmap.width * innerScale));
        const drawH = Math.max(1, Math.round(bitmap.height * innerScale));
        ctx.drawImage(
          bitmap.draw,
          Math.round((currentWidth - drawW) / 2),
          Math.round((currentHeight - drawH) / 2),
          drawW,
          drawH
        );
      } else {
        const sourceRatio = bitmap.width / bitmap.height;
        let cropW = bitmap.width;
        let cropH = bitmap.height;
        if (sourceRatio > aspectRatio) {
          cropW = Math.round(bitmap.height * aspectRatio);
        } else {
          cropH = Math.round(bitmap.width / aspectRatio);
        }
        const cropX = Math.round((bitmap.width - cropW) / 2);
        const cropY = Math.round((bitmap.height - cropH) / 2);
        ctx.drawImage(bitmap.draw, cropX, cropY, cropW, cropH, 0, 0, currentWidth, currentHeight);
      }

      blob = await toBlob(quality);
    }

    const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';

    return {
      blob,
      dataUrl: await blobToDataUrl(blob),
      width: currentWidth,
      height: currentHeight,
      bytes: blob.size,
      originalBytes,
      fileName,
    };
  } finally {
    bitmap.close();
  }
}

/** Formatea bytes de forma legible para mostrar en la interfaz. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
