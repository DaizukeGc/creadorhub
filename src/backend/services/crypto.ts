// Criptografía WebCrypto nativa para Cloudflare Workers
// - Contraseñas: PBKDF2-HMAC-SHA256 (100 000 iteraciones) con salt aleatorio por usuario
// - Sesiones: JWT HS256 firmado con un secreto que DEBE venir del entorno (nunca hardcodeado)

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

/**
 * Error de configuración: el secreto de sesión no está definido.
 * Es preferible fallar de forma explícita a firmar tokens con una clave
 * pública en el repositorio (eso permitiría a cualquiera falsificar un
 * token de administradora).
 */
export class AuthConfigError extends Error {
  constructor() {
    super(
      'JWT_SECRET no está configurado. Define el secreto con "wrangler secret put JWT_SECRET" ' +
      '(en local, crea un archivo .dev.vars con JWT_SECRET=...)'
    );
    this.name = 'AuthConfigError';
  }
}

export function resolveSecret(env: { JWT_SECRET?: string }): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new AuthConfigError();
  if (secret.length < 16) {
    throw new Error('JWT_SECRET es demasiado corto. Usa al menos 16 caracteres aleatorios.');
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: KEY_LENGTH_BITS },
    true,
    ['sign']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return {
    hash: bufToHex(new Uint8Array(exported)),
    salt: saltHex || bufToHex(salt)
  };
}

export async function verifyPassword(password: string, expectedHash: string, saltHex: string): Promise<boolean> {
  try {
    const { hash } = await hashPassword(password, saltHex);
    return timingSafeEqual(hash, expectedHash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Codifica bytes crudos a base64url (para firmas). */
function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return atob(b64);
}

/** Codifica bytes a base64 sin usar el operador spread (evita RangeError con archivos grandes). */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decodifica base64 a bytes sin operador spread (seguro para payloads grandes). */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec: number = SESSION_TTL_SECONDS
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const fullPayload = { ...payload, iat: Math.floor(Date.now() / 1000), exp };

  const headerEnc = base64UrlEncode(JSON.stringify(header));
  const payloadEnc = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerEnc}.${payloadEnc}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const sigEnc = base64UrlEncodeBytes(new Uint8Array(signature));

  return `${dataToSign}.${sigEnc}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerEnc, payloadEnc, sigEnc] = parts;

    // Validamos que el algoritmo sea el esperado (evita ataques de confusión de alg)
    const header = JSON.parse(base64UrlDecode(headerEnc));
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const dataToSign = `${headerEnc}.${payloadEnc}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuf = base64ToBytes(sigEnc.replace(/-/g, '+').replace(/_/g, '/'));
    const isValid = await crypto.subtle.verify('HMAC', key, sigBuf as unknown as BufferSource, enc.encode(dataToSign));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadEnc));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null; // Expirado
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const pairs = hex.match(/[\da-f]{2}/gi) || [];
  return new Uint8Array(pairs.map(h => parseInt(h, 16)));
}

/** Comparación en tiempo constante para evitar fugas por temporización. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
