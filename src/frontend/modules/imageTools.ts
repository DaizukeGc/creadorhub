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
  let quality = options.quality ?? 0.86;

  const originalBytes = file.size;
  const bitmap = await loadBitmap(file);

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no permite procesar la imagen');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap.draw, 0, 0, width, height);

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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, currentWidth, currentHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap.draw, 0, 0, currentWidth, currentHeight);
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
